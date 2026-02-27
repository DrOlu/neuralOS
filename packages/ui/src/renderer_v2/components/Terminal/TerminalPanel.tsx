import React from 'react'
import { Laptop, Plus, Server, X } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import type { AppStore, TerminalTabModel } from '../../stores/AppStore'
import './terminal.scss'
import { XTermView } from './XTermView'
import { ConfirmDialog } from '../Common/ConfirmDialog'

interface TerminalPanelProps {
  store: AppStore
  panelId: string
  tabs: TerminalTabModel[]
  activeTabId: string | null
  isManagerPanel: boolean
  onSelectTab: (tabId: string) => void
  onLayoutHeaderMouseDown?: (event: React.MouseEvent<HTMLElement>) => void
  onLayoutHeaderContextMenu?: (event: React.MouseEvent<HTMLElement>) => void
}

export const TerminalPanel: React.FC<TerminalPanelProps> = observer(({
  store,
  panelId,
  tabs,
  activeTabId,
  isManagerPanel,
  onSelectTab,
  onLayoutHeaderMouseDown,
  onLayoutHeaderContextMenu
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [confirmCloseId, setConfirmCloseId] = React.useState<string | null>(null)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const t = store.i18n.t
  const isLayoutDragSource = store.layout.isDragging && store.layout.draggingPanelId === panelId
  const layoutSignature = `${store.layout.panelOrder.join(',')}|${store.layout.panelSizes
    .map((size) => size.toFixed(3))
    .join(',')}`

  React.useEffect(() => {
    if (!menuOpen) return

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (menuRef.current?.contains(target)) return
      if (rootRef.current?.contains(target) && (target as HTMLElement).closest('.tab-add-btn')) return
      setMenuOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const closeableTabIds = new Set(tabs.map((tab) => tab.id))

  return (
    <div className={`panel panel-terminal${isLayoutDragSource ? ' is-dragging-source' : ''}`} ref={rootRef}>
      <ConfirmDialog
        open={!!confirmCloseId}
        title={t.terminal.confirmCloseTitle}
        message={t.terminal.confirmCloseMessage}
        confirmText={t.common.close}
        cancelText={t.common.cancel}
        danger
        onConfirm={() => {
          if (confirmCloseId && closeableTabIds.has(confirmCloseId)) {
            void store.closeTab(confirmCloseId)
          }
          setConfirmCloseId(null)
        }}
        onCancel={() => setConfirmCloseId(null)}
      />

      <div
        className="terminal-tabs-container is-draggable"
        onMouseDown={onLayoutHeaderMouseDown}
        onContextMenu={onLayoutHeaderContextMenu}
      >
        {isManagerPanel ? <div className="panel-manager-badge">{t.layout.managerBadge}</div> : null}
        <div className="terminal-tabs-bar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const Icon = tab.config.type === 'ssh' ? Server : Laptop
            const runtimeState = tab.runtimeState || 'initializing'
            const runtimeIndicatorState =
              tab.config.type === 'ssh'
                ? runtimeState === 'ready'
                  ? 'ready'
                  : 'inactive'
                : runtimeState

            return (
              <div
                key={tab.id}
                className={isActive ? 'tab is-active' : 'tab'}
                onClick={() => onSelectTab(tab.id)}
                role="button"
                tabIndex={0}
                draggable
                data-layout-tab-draggable="true"
                data-layout-tab-id={tab.id}
                data-layout-tab-kind="terminal"
                data-layout-tab-panel-id={panelId}
              >
                <span className="tab-icon">
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span className="tab-title">{tab.title}</span>
                <span
                  className={`tab-runtime-state tab-runtime-state-${runtimeIndicatorState}`}
                  title={runtimeState}
                />
                <button
                  className="tab-close"
                  title={t.common.close}
                  onClick={(event) => {
                    event.stopPropagation()
                    setConfirmCloseId(tab.id)
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            )
          })}
        </div>

        {isManagerPanel ? (
          <button className="icon-btn-sm tab-add-btn" title={t.terminal.newTab} onClick={() => setMenuOpen((v) => !v)}>
            <Plus size={14} strokeWidth={2} />
          </button>
        ) : null}

        {isManagerPanel && menuOpen ? (
          <div className="tab-menu" role="menu" ref={menuRef}>
            <button
              className="tab-menu-item"
              onClick={() => {
                store.createLocalTab()
                setMenuOpen(false)
              }}
            >
              <Laptop size={14} strokeWidth={2} />
              <span>{t.terminal.local}</span>
            </button>

            {store.settings?.connections?.ssh?.length ? <div className="tab-menu-sep" /> : null}

            {store.settings?.connections?.ssh?.map((entry) => (
              <button
                key={entry.id}
                className="tab-menu-item"
                onClick={() => {
                  store.createSshTab(entry.id)
                  setMenuOpen(false)
                }}
              >
                <Server size={14} strokeWidth={2} />
                <span>{entry.name || `${entry.username}@${entry.host}`}</span>
              </button>
            ))}

            <div className="tab-menu-sep" />
            <button
              className="tab-menu-item"
              onClick={() => {
                store.openConnections()
                setMenuOpen(false)
              }}
            >
              <Server size={14} strokeWidth={2} />
              <span>{t.connections.manage}</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel-body">
        {tabs.length ? (
          <div className="terminal-stack">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId
              return (
                <div key={tab.id} className={isActive ? 'terminal-layer is-active' : 'terminal-layer'}>
                  <XTermView
                    config={tab.config}
                    theme={store.xtermTheme}
                    terminalSettings={store.settings?.terminal}
                    isActive={isActive}
                    layoutSignature={layoutSignature}
                    onSelectionChange={(text) => store.setTerminalSelection(tab.id, text)}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="placeholder">No Terminal</div>
        )}
      </div>
    </div>
  )
})
