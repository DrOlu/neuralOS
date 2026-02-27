import React from 'react'
import { observer } from 'mobx-react-lite'
import clsx from 'clsx'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { ImperativePanelGroupHandle } from 'react-resizable-panels'
import type { AppStore } from '../../stores/AppStore'
import {
  MAX_LAYOUT_PANELS,
  computeChildMinSizePercentages,
  determineDropDirection,
  type LayoutNode,
  type LayoutRect,
  type LayoutSplitNode,
  type PanelKind,
  type TabDragPayload
} from '../../layout'
import { renderPanelByKind } from './panelRenderRegistry'

interface LayoutWorkspaceProps {
  store: AppStore
}

const DragOverlay: React.FC<{
  targetRect: LayoutRect | null
  previewRect: LayoutRect | null
}> = ({ targetRect, previewRect }) => {
  if (!targetRect && !previewRect) return null
  return (
    <>
      {targetRect ? (
        <div
          className="gyshell-layout-drop-target-overlay"
          style={{
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height
          }}
        />
      ) : null}
      {previewRect ? (
        <div
          className="gyshell-layout-drop-preview-overlay"
          style={{
            left: previewRect.left,
            top: previewRect.top,
            width: previewRect.width,
            height: previewRect.height
          }}
        />
      ) : null}
    </>
  )
}

const PanelLeaf: React.FC<{
  node: Extract<LayoutNode, { type: 'panel' }>
  store: AppStore
  onHeaderMouseDown: (panelId: string, event: React.MouseEvent<HTMLElement>) => void
  onHeaderContextMenu: (panelId: string, event: React.MouseEvent<HTMLElement>) => void
}> = observer(({ node, store, onHeaderMouseDown, onHeaderContextMenu }) => {
  const panelId = node.panel.id
  const dragSource = store.layout.isDragging && store.layout.draggingPanelId === panelId
  const isDropTarget = store.layout.isDragging && store.layout.dropTargetPanelId === panelId
  const isManagerPanel = store.layout.isManagerPanel(panelId)
  const panelTabIds = store.layout.getPanelTabIds(panelId)

  return (
    <div
      className={clsx('gyshell-layout-leaf', {
        'is-drag-source': dragSource,
        'is-drop-target': isDropTarget
      })}
      data-layout-panel-id={panelId}
      data-layout-panel-kind={node.panel.kind}
    >
      {renderPanelByKind(node.panel.kind, {
        store,
        panelId,
        tabIds: panelTabIds,
        activeTabId: store.layout.getPanelActiveTabId(panelId),
        isManagerPanel,
        onSelectTab: (tabId) => store.layout.setPanelActiveTab(panelId, tabId),
        onLayoutHeaderMouseDown: (event) => onHeaderMouseDown(panelId, event),
        onLayoutHeaderContextMenu: (event) => onHeaderContextMenu(panelId, event)
      })}
    </div>
  )
})

const SplitNodeView: React.FC<{
  node: LayoutSplitNode
  store: AppStore
  onHeaderMouseDown: (panelId: string, event: React.MouseEvent<HTMLElement>) => void
  onHeaderContextMenu: (panelId: string, event: React.MouseEvent<HTMLElement>) => void
}> = observer(({ node, store, onHeaderMouseDown, onHeaderContextMenu }) => {
  const panelGroupRef = React.useRef<ImperativePanelGroupHandle | null>(null)
  const applyingLayoutRef = React.useRef(false)

  const parentRect = store.layout.geometry.nodeRects[node.id] || {
    left: 0,
    top: 0,
    width: store.layout.viewport.width,
    height: store.layout.viewport.height
  }

  const minPercentages = computeChildMinSizePercentages(node, parentRect, store.layout.viewport.height).map((value) =>
    Math.max(0, Math.min(100, value))
  )

  const sizeSignature = React.useMemo(() => node.sizes.map((size) => size.toFixed(3)).join(','), [node.sizes])
  const childSignature = React.useMemo(() => node.children.map((child) => child.id).join('|'), [node.children])

  React.useEffect(() => {
    const group = panelGroupRef.current
    if (!group?.setLayout) return

    applyingLayoutRef.current = true
    group.setLayout(node.sizes)
    requestAnimationFrame(() => {
      applyingLayoutRef.current = false
    })
  }, [sizeSignature, childSignature])

  return (
    <PanelGroup
      ref={panelGroupRef}
      direction={node.direction}
      className="gyshell-layout-split"
      onLayout={(sizes) => {
        if (applyingLayoutRef.current) {
          applyingLayoutRef.current = false
          return
        }
        store.layout.setSplitSizes(node.id, sizes)
      }}
    >
      {node.children.map((child, index) => {
        const defaultSize = node.sizes[index] ?? (100 / Math.max(1, node.children.length))
        const minSize = minPercentages[index] ?? 0
        return (
          <React.Fragment key={child.id}>
            <Panel id={child.id} order={index} defaultSize={defaultSize} minSize={minSize}>
              <LayoutNodeView
                node={child}
                store={store}
                onHeaderMouseDown={onHeaderMouseDown}
                onHeaderContextMenu={onHeaderContextMenu}
              />
            </Panel>
            {index < node.children.length - 1 ? <PanelResizeHandle className="gyshell-resize-handle" /> : null}
          </React.Fragment>
        )
      })}
    </PanelGroup>
  )
})

const LayoutNodeView: React.FC<{
  node: LayoutNode
  store: AppStore
  onHeaderMouseDown: (panelId: string, event: React.MouseEvent<HTMLElement>) => void
  onHeaderContextMenu: (panelId: string, event: React.MouseEvent<HTMLElement>) => void
}> = ({ node, store, onHeaderMouseDown, onHeaderContextMenu }) => {
  if (node.type === 'panel') {
    return (
      <PanelLeaf
        node={node}
        store={store}
        onHeaderMouseDown={onHeaderMouseDown}
        onHeaderContextMenu={onHeaderContextMenu}
      />
    )
  }

  return (
    <SplitNodeView
      node={node}
      store={store}
      onHeaderMouseDown={onHeaderMouseDown}
      onHeaderContextMenu={onHeaderContextMenu}
    />
  )
}

const layoutMenuItems: Array<{
  id: string
  labelKey:
    | 'splitRightTerminal'
    | 'splitDownTerminal'
    | 'splitRightChat'
    | 'splitDownChat'
    | 'closePanel'
  kind?: PanelKind
  direction?: 'horizontal' | 'vertical'
  position?: 'before' | 'after'
  danger?: boolean
  action: 'split' | 'remove'
}> = [
  {
    id: 'split-right-terminal',
    labelKey: 'splitRightTerminal',
    kind: 'terminal',
    direction: 'horizontal',
    position: 'after',
    action: 'split'
  },
  {
    id: 'split-bottom-terminal',
    labelKey: 'splitDownTerminal',
    kind: 'terminal',
    direction: 'vertical',
    position: 'after',
    action: 'split'
  },
  {
    id: 'split-right-chat',
    labelKey: 'splitRightChat',
    kind: 'chat',
    direction: 'horizontal',
    position: 'after',
    action: 'split'
  },
  {
    id: 'split-bottom-chat',
    labelKey: 'splitDownChat',
    kind: 'chat',
    direction: 'vertical',
    position: 'after',
    action: 'split'
  },
  {
    id: 'remove-panel',
    labelKey: 'closePanel',
    action: 'remove',
    danger: true
  }
]

export const LayoutWorkspace: React.FC<LayoutWorkspaceProps> = observer(({ store }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const t = store.i18n.t
  const dragTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [layoutMenu, setLayoutMenu] = React.useState<{
    panelId: string
    x: number
    y: number
  } | null>(null)

  const setSelectionSuppressed = React.useCallback((suppressed: boolean) => {
    document.body?.classList.toggle('chat-drag-selection-suppressed', suppressed)
  }, [])

  const terminalSignature = store.terminalTabs.map((tab) => tab.id).join('|')
  const chatSignature = store.chat.sessions.map((session) => session.id).join('|')

  React.useEffect(() => {
    store.layout.syncPanelBindings({ persist: false })
  }, [chatSignature, store.layout, terminalSignature])

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateViewport = () => {
      const bounds = element.getBoundingClientRect()
      store.layout.setViewport(bounds.width, bounds.height)
    }

    updateViewport()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateViewport) : null
    observer?.observe(element)
    window.addEventListener('resize', updateViewport)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateViewport)
    }
  }, [store.layout])

  React.useEffect(() => {
    if (!layoutMenu) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (target && menuRef.current?.contains(target)) return
      setLayoutMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLayoutMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [layoutMenu])

  const updateDropTarget = React.useCallback(
    (targetElement: HTMLElement | null, clientX: number, clientY: number) => {
      const panelHost = targetElement?.closest?.('[data-layout-panel-id]') as HTMLElement | null
      const targetPanelId = panelHost?.getAttribute('data-layout-panel-id') || null
      const targetPanelKind = panelHost?.getAttribute('data-layout-panel-kind') as PanelKind | null
      if (!panelHost || !targetPanelId) {
        store.layout.setDropTarget(null, null)
        return
      }

      if (store.layout.dragType === 'panel' && targetPanelId === store.layout.draggingPanelId) {
        store.layout.setDropTarget(null, null)
        return
      }

      if (store.layout.dragType === 'tab') {
        const draggingTab = store.layout.draggingTab
        if (!draggingTab || !targetPanelKind || targetPanelKind !== draggingTab.kind) {
          store.layout.setDropTarget(null, null)
          return
        }
      }

      const rect = panelHost.getBoundingClientRect()
      const direction = determineDropDirection(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        },
        clientX,
        clientY
      )
      store.layout.setDropTarget(targetPanelId, direction)
    },
    [store.layout]
  )

  const handleHeaderMouseDown = React.useCallback(
    (panelId: string, event: React.MouseEvent<HTMLElement>) => {
      if (event.button !== 0) return
      if ((event.target as HTMLElement).closest('button')) return
      if ((event.target as HTMLElement).closest('[data-layout-tab-draggable="true"]')) return

      const startX = event.clientX
      const startY = event.clientY
      setSelectionSuppressed(true)

      dragTimerRef.current = setTimeout(() => {
        store.layout.startPanelDragging(panelId, startX, startY)
      }, 260)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        store.layout.setDragPointer(moveEvent.clientX, moveEvent.clientY)
        if (store.layout.isDragging) {
          updateDropTarget(moveEvent.target as HTMLElement | null, moveEvent.clientX, moveEvent.clientY)
        }
      }

      const handleMouseUp = () => {
        if (dragTimerRef.current) {
          clearTimeout(dragTimerRef.current)
          dragTimerRef.current = null
        }

        setSelectionSuppressed(false)
        if (store.layout.isDragging) {
          store.layout.commitDragging()
        } else {
          store.layout.clearDragging()
        }

        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [setSelectionSuppressed, store.layout, updateDropTarget]
  )

  React.useEffect(() => {
    const host = containerRef.current
    if (!host) return

    const readPayload = (target: EventTarget | null): TabDragPayload | null => {
      const tabElement = (target as HTMLElement | null)?.closest?.('[data-layout-tab-id]') as HTMLElement | null
      if (!tabElement) return null
      const tabId = tabElement.getAttribute('data-layout-tab-id')
      const kind = tabElement.getAttribute('data-layout-tab-kind')
      const sourcePanelId = tabElement.getAttribute('data-layout-tab-panel-id')
      if (!tabId || !sourcePanelId || (kind !== 'chat' && kind !== 'terminal')) return null
      return {
        tabId,
        kind,
        sourcePanelId
      }
    }

    const handleDragStart = (event: DragEvent) => {
      const payload = readPayload(event.target)
      if (!payload) return
      event.dataTransfer?.setData('text/plain', payload.tabId)
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
      }
      setSelectionSuppressed(true)
      store.layout.startTabDragging(payload, event.clientX, event.clientY)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!store.layout.isDragging || store.layout.dragType !== 'tab') return
      event.preventDefault()
      store.layout.setDragPointer(event.clientX, event.clientY)
      updateDropTarget(event.target as HTMLElement | null, event.clientX, event.clientY)
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = store.layout.dropPreviewRect ? 'move' : 'none'
      }
    }

    const handleDrop = (event: DragEvent) => {
      if (!store.layout.isDragging || store.layout.dragType !== 'tab') return
      event.preventDefault()
      store.layout.setDragPointer(event.clientX, event.clientY)
      updateDropTarget(event.target as HTMLElement | null, event.clientX, event.clientY)
      store.layout.commitDragging()
      setSelectionSuppressed(false)
    }

    const handleDragEnd = () => {
      if (!store.layout.isDragging || store.layout.dragType !== 'tab') return
      store.layout.clearDragging()
      setSelectionSuppressed(false)
    }

    host.addEventListener('dragstart', handleDragStart)
    host.addEventListener('dragover', handleDragOver)
    host.addEventListener('drop', handleDrop)
    host.addEventListener('dragend', handleDragEnd)

    return () => {
      host.removeEventListener('dragstart', handleDragStart)
      host.removeEventListener('dragover', handleDragOver)
      host.removeEventListener('drop', handleDrop)
      host.removeEventListener('dragend', handleDragEnd)
    }
  }, [setSelectionSuppressed, store.layout, updateDropTarget])

  const handleHeaderContextMenu = React.useCallback((panelId: string, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    setLayoutMenu({ panelId, x: event.clientX, y: event.clientY })
  }, [])

  React.useEffect(() => {
    return () => {
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current)
        dragTimerRef.current = null
      }
      setSelectionSuppressed(false)
      store.layout.clearDragging()
    }
  }, [setSelectionSuppressed, store.layout])

  const targetRect = store.layout.dropTargetPanelId
    ? store.layout.getPanelRect(store.layout.dropTargetPanelId)
    : null

  return (
    <div ref={containerRef} className="gyshell-layout-root">
      <LayoutNodeView
        node={store.layout.tree.root}
        store={store}
        onHeaderMouseDown={handleHeaderMouseDown}
        onHeaderContextMenu={handleHeaderContextMenu}
      />

      {store.layout.isDragging ? (
        <DragOverlay
          targetRect={targetRect}
          previewRect={store.layout.dropPreviewRect}
        />
      ) : null}

      {layoutMenu ? (
        <div
          ref={menuRef}
          className="gyshell-layout-menu"
          style={{ left: layoutMenu.x, top: layoutMenu.y }}
        >
          {layoutMenuItems.map((item) => {
            const disabled =
              (item.action === 'remove' && !store.layout.canRemovePanel(layoutMenu.panelId)) ||
              (item.action === 'split' && store.layout.panelCount >= MAX_LAYOUT_PANELS)
            return (
              <button
                key={item.id}
                className={clsx('gyshell-layout-menu-item', {
                  'is-danger': item.danger,
                  'is-disabled': disabled
                })}
                disabled={disabled}
                onClick={() => {
                  if (item.action === 'split' && item.kind && item.direction && item.position) {
                    store.layout.splitPanel(layoutMenu.panelId, item.kind, item.direction, item.position)
                  } else if (item.action === 'remove') {
                    store.layout.removePanel(layoutMenu.panelId)
                  }
                  setLayoutMenu(null)
                }}
              >
                {t.layout[item.labelKey]}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
