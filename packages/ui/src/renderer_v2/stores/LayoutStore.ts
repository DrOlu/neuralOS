import { makeObservable, observable, action, computed, toJS, runInAction } from 'mobx'
import type { AppStore } from './AppStore'
import { PANEL_KIND_LIST, getPanelKindAdapter } from './panelKindAdapters'
import {
  MAX_LAYOUT_PANELS,
  buildLayoutTree,
  deriveLegacyLayoutSnapshot,
  getFirstPanelId,
  getPanelCount,
  listPanels,
  makeLayoutId,
  movePanel,
  removePanel,
  setSplitSizes,
  splitPanel,
  splitPanelWithPanelId,
  swapPanels,
  type DropDirection,
  type LayoutPanelTabBinding,
  type LayoutRect,
  type LayoutTree,
  type LayoutViewport,
  type PanelKind,
  type SplitDirection,
  type TabDragPayload
} from '../layout'
import { computeLayoutGeometry, validateLayoutTree } from '../layout'

const DEFAULT_VIEWPORT: LayoutViewport = {
  width: 0,
  height: 0
}

const PREVIEW_PANEL_ID = '__layout-preview-panel__'

const toSplitPlacement = (
  direction: DropDirection
): { direction: SplitDirection; position: 'before' | 'after' } | null => {
  if (direction === 'left') return { direction: 'horizontal', position: 'before' }
  if (direction === 'right') return { direction: 'horizontal', position: 'after' }
  if (direction === 'top') return { direction: 'vertical', position: 'before' }
  if (direction === 'bottom') return { direction: 'vertical', position: 'after' }
  return null
}

const unique = (items: string[]): string[] => {
  const seen = new Set<string>()
  const next: string[] = []
  items.forEach((item) => {
    if (!item || seen.has(item)) return
    seen.add(item)
    next.push(item)
  })
  return next
}

type DragType = 'panel' | 'tab' | null

export class LayoutStore {
  tree: LayoutTree = buildLayoutTree(undefined)
  isReady = false

  viewport: LayoutViewport = { ...DEFAULT_VIEWPORT }

  // Drag state
  isDragging = false
  dragType: DragType = null
  draggingPanelId: string | null = null
  draggingTab: TabDragPayload | null = null
  dragX = 0
  dragY = 0
  dropTargetPanelId: string | null = null
  dropDirection: DropDirection | null = null
  dropPreviewRect: LayoutRect | null = null

  private appStore: AppStore
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private pinnedEmptyPanelIds = new Set<string>()

  constructor(appStore: AppStore) {
    this.appStore = appStore
    makeObservable(this, {
      tree: observable,
      isReady: observable,
      viewport: observable,
      isDragging: observable,
      dragType: observable,
      draggingPanelId: observable,
      draggingTab: observable,
      dragX: observable,
      dragY: observable,
      dropTargetPanelId: observable,
      dropDirection: observable,
      dropPreviewRect: observable,
      panelOrder: computed,
      panelSizes: computed,
      panelNodes: computed,
      panelCount: computed,
      geometry: computed,
      bootstrap: action,
      syncPanelBindings: action,
      setViewport: action,
      setSplitSizes: action,
      splitPanel: action,
      removePanel: action,
      setFocusedPanel: action,
      setPanelActiveTab: action,
      startPanelDragging: action,
      startTabDragging: action,
      setDragPointer: action,
      setDropTarget: action,
      clearDragging: action,
      commitDragging: action,
      swapPanels: action
    })
  }

  get panelNodes() {
    return listPanels(this.tree)
  }

  get panelCount(): number {
    return this.panelNodes.length
  }

  get geometry() {
    return computeLayoutGeometry(this.tree, this.viewport)
  }

  /**
   * Compatibility projection for legacy code paths.
   */
  get panelOrder(): PanelKind[] {
    return this.panelNodes.map((node) => node.panel.kind)
  }

  /**
   * Compatibility projection for legacy code paths.
   */
  get panelSizes(): number[] {
    return deriveLegacyLayoutSnapshot(this.tree).panelSizes
  }

  get panelTabs(): Record<string, LayoutPanelTabBinding> {
    return this.tree.panelTabs || {}
  }

  bootstrap() {
    const settings = this.appStore.settings
    const tree = buildLayoutTree(settings?.layout)
    this.tree = tree

    if (!this.tree.focusedPanelId) {
      this.tree.focusedPanelId = getFirstPanelId(this.tree) ?? undefined
    }
    this.syncPanelBindings({ persist: false })
    this.isReady = true
  }

  syncPanelBindings(options?: { persist?: boolean }) {
    const persist = options?.persist !== false
    const currentPanelIds = new Set(this.panelNodes.map((node) => node.panel.id))
    Array.from(this.pinnedEmptyPanelIds).forEach((panelId) => {
      if (!currentPanelIds.has(panelId)) {
        this.pinnedEmptyPanelIds.delete(panelId)
      }
    })

    let nextTree = this.tree
    let pass = 0
    while (pass < MAX_LAYOUT_PANELS + 2) {
      pass += 1
      const { panelTabs, managerPanels } = this.computeBindingsForTree(nextTree)
      nextTree = {
        ...nextTree,
        panelTabs,
        managerPanels
      }
      Object.entries(panelTabs).forEach(([panelId, binding]) => {
        if ((binding.tabIds || []).length > 0) {
          this.pinnedEmptyPanelIds.delete(panelId)
        }
      })
      const removableEmptyPanelId = this.findAutoRemovableEmptyPanelId(nextTree, panelTabs)
      if (!removableEmptyPanelId) {
        break
      }
      const pruned = removePanel(nextTree, removableEmptyPanelId)
      if (pruned === nextTree) {
        break
      }
      nextTree = pruned
    }

    this.tree = nextTree
    const nextPanelIds = new Set(listPanels(nextTree).map((panel) => panel.panel.id))
    Array.from(this.pinnedEmptyPanelIds).forEach((panelId) => {
      if (!nextPanelIds.has(panelId)) {
        this.pinnedEmptyPanelIds.delete(panelId)
      }
    })
    if (this.isDragging) {
      this.dropPreviewRect = this.computeDropPreviewRect()
    }

    if (persist) {
      this.saveLayoutDebounced()
    }
  }

  setViewport(width: number, height: number) {
    this.viewport = {
      width: Number.isFinite(width) ? Math.max(0, width) : 0,
      height: Number.isFinite(height) ? Math.max(0, height) : 0
    }
    if (this.isDragging) {
      this.dropPreviewRect = this.computeDropPreviewRect()
    }
  }

  setSplitSizes(splitNodeId: string, sizes: number[]) {
    const nextTree = setSplitSizes(this.tree, splitNodeId, sizes)
    this.applyTree(nextTree)
  }

  splitPanel(targetPanelId: string, kind: PanelKind, direction: 'horizontal' | 'vertical', position: 'before' | 'after') {
    const nextTree = splitPanel(this.tree, targetPanelId, kind, direction, position)
    if (nextTree !== this.tree && nextTree.focusedPanelId) {
      this.pinnedEmptyPanelIds.add(nextTree.focusedPanelId)
    }
    this.applyTree(nextTree)
  }

  removePanel(panelId: string) {
    if (!this.canRemovePanel(panelId)) return
    this.pinnedEmptyPanelIds.delete(panelId)
    const nextTree = removePanel(this.tree, panelId)
    this.applyTree(nextTree)
  }

  swapPanels(panelAId: string, panelBId: string) {
    const nextTree = swapPanels(this.tree, panelAId, panelBId)
    this.applyTree(nextTree)
  }

  canRemovePanel(panelId: string): boolean {
    if (this.panelCount <= 1) return false
    const kind = this.getPanelKind(panelId)
    if (!kind) return false
    const sameKindCount = this.panelNodes.filter((node) => node.panel.kind === kind).length
    return sameKindCount > 1
  }

  setFocusedPanel(panelId: string) {
    this.tree = {
      ...this.tree,
      focusedPanelId: panelId
    }
    this.saveLayoutDebounced()
  }

  isManagerPanel(panelId: string): boolean {
    const kind = this.getPanelKind(panelId)
    if (!kind) return false
    return this.tree.managerPanels?.[kind] === panelId
  }

  getManagerPanelId(kind: PanelKind): string | null {
    const managerId = this.tree.managerPanels?.[kind]
    if (managerId && this.panelNodes.some((node) => node.panel.id === managerId)) {
      return managerId
    }
    return this.panelNodes.find((node) => node.panel.kind === kind)?.panel.id || null
  }

  getPanelTabIds(panelId: string): string[] {
    return this.tree.panelTabs?.[panelId]?.tabIds || []
  }

  getPanelActiveTabId(panelId: string): string | null {
    const binding = this.tree.panelTabs?.[panelId]
    if (!binding) return null
    if (binding.activeTabId && binding.tabIds.includes(binding.activeTabId)) {
      return binding.activeTabId
    }
    return binding.tabIds[0] || null
  }

  setPanelActiveTab(panelId: string, tabId: string) {
    const kind = this.getPanelKind(panelId)
    if (!kind) return
    const current = this.tree.panelTabs?.[panelId]
    if (!current || !current.tabIds.includes(tabId)) return

    this.tree = {
      ...this.tree,
      panelTabs: {
        ...this.tree.panelTabs,
        [panelId]: {
          ...current,
          activeTabId: tabId
        }
      },
      focusedPanelId: panelId
    }
    this.saveLayoutDebounced()
    this.syncGlobalActiveFromPanel(kind, tabId)
  }

  attachTabToManager(kind: PanelKind, tabId: string) {
    const managerPanelId = this.getManagerPanelId(kind)
    if (!managerPanelId) return
    this.moveTabBinding(kind, tabId, managerPanelId)
  }

  startPanelDragging(panelId: string, x: number, y: number) {
    this.isDragging = true
    this.dragType = 'panel'
    this.draggingPanelId = panelId
    this.draggingTab = null
    this.dragX = x
    this.dragY = y
    this.dropTargetPanelId = null
    this.dropDirection = null
    this.dropPreviewRect = null
  }

  startTabDragging(payload: TabDragPayload, x: number, y: number) {
    this.isDragging = true
    this.dragType = 'tab'
    this.draggingPanelId = null
    this.draggingTab = payload
    this.dragX = x
    this.dragY = y
    this.dropTargetPanelId = null
    this.dropDirection = null
    this.dropPreviewRect = null
  }

  setDragPointer(x: number, y: number) {
    this.dragX = x
    this.dragY = y
  }

  setDropTarget(panelId: string | null, direction: DropDirection | null) {
    this.dropTargetPanelId = panelId
    this.dropDirection = direction
    this.dropPreviewRect = this.computeDropPreviewRect()
  }

  clearDragging() {
    this.isDragging = false
    this.dragType = null
    this.draggingPanelId = null
    this.draggingTab = null
    this.dropTargetPanelId = null
    this.dropDirection = null
    this.dropPreviewRect = null
  }

  commitDragging() {
    if (!this.isDragging || !this.dropTargetPanelId || !this.dropDirection) {
      this.clearDragging()
      return
    }

    if (this.dragType === 'panel' && this.draggingPanelId) {
      const nextTree = movePanel(this.tree, this.draggingPanelId, this.dropTargetPanelId, this.dropDirection)
      this.clearDragging()
      this.applyTree(nextTree)
      return
    }

    if (this.dragType === 'tab' && this.draggingTab) {
      const payload = this.draggingTab
      const targetPanelId = this.dropTargetPanelId
      const dropDirection = this.dropDirection
      this.clearDragging()
      this.commitTabDrop(payload, targetPanelId, dropDirection)
      return
    }

    this.clearDragging()
  }

  getPanelRect(panelId: string): LayoutRect | null {
    return this.geometry.panelRects[panelId] || null
  }

  private commitTabDrop(payload: TabDragPayload, targetPanelId: string, direction: DropDirection) {
    if (!this.canAcceptTabDrop(payload, targetPanelId, direction)) {
      return
    }

    if (direction === 'center') {
      this.moveTabBinding(payload.kind, payload.tabId, targetPanelId)
      this.setPanelActiveTab(targetPanelId, payload.tabId)
      return
    }

    const splitPlacement = toSplitPlacement(direction)
    if (!splitPlacement) {
      return
    }

    const newPanelId = makeLayoutId(`panel-${payload.kind}`)
    const nextTree = splitPanelWithPanelId(
      this.tree,
      targetPanelId,
      {
        kind: payload.kind,
        panelId: newPanelId
      },
      splitPlacement.direction,
      splitPlacement.position
    )
    const nextWithBinding = this.createTreeWithMovedTab(nextTree, payload.kind, payload.tabId, newPanelId)
    if (!nextWithBinding) {
      return
    }
    this.applyTree(nextWithBinding)
    this.syncGlobalActiveFromPanel(payload.kind, payload.tabId)
  }

  private computeDropPreviewRect(): LayoutRect | null {
    if (!this.isDragging || !this.dropTargetPanelId || !this.dropDirection) {
      return null
    }

    if (this.dragType === 'panel' && this.draggingPanelId) {
      const projectedTree = movePanel(this.tree, this.draggingPanelId, this.dropTargetPanelId, this.dropDirection)
      if (projectedTree === this.tree) return null
      if (!validateLayoutTree(projectedTree, this.viewport).valid) return null
      const projectedGeometry = computeLayoutGeometry(projectedTree, this.viewport)
      return projectedGeometry.panelRects[this.draggingPanelId] || null
    }

    if (this.dragType === 'tab' && this.draggingTab) {
      if (!this.canAcceptTabDrop(this.draggingTab, this.dropTargetPanelId, this.dropDirection)) {
        return null
      }
      if (this.dropDirection === 'center') {
        return this.geometry.panelRects[this.dropTargetPanelId] || null
      }
      const splitPlacement = toSplitPlacement(this.dropDirection)
      if (!splitPlacement) return null
      const projectedTree = splitPanelWithPanelId(
        this.tree,
        this.dropTargetPanelId,
        {
          kind: this.draggingTab.kind,
          panelId: PREVIEW_PANEL_ID
        },
        splitPlacement.direction,
        splitPlacement.position
      )
      if (!validateLayoutTree(projectedTree, this.viewport).valid) return null
      const projectedGeometry = computeLayoutGeometry(projectedTree, this.viewport)
      return projectedGeometry.panelRects[PREVIEW_PANEL_ID] || null
    }

    return null
  }

  private canAcceptTabDrop(payload: TabDragPayload, targetPanelId: string, direction: DropDirection): boolean {
    const targetKind = this.getPanelKind(targetPanelId)
    if (!targetKind || targetKind !== payload.kind) return false

    if (direction === 'center') {
      return true
    }

    if (this.panelCount >= MAX_LAYOUT_PANELS) {
      return false
    }

    const splitPlacement = toSplitPlacement(direction)
    if (!splitPlacement) {
      return false
    }

    const projectedTree = splitPanelWithPanelId(
      this.tree,
      targetPanelId,
      {
        kind: payload.kind,
        panelId: PREVIEW_PANEL_ID
      },
      splitPlacement.direction,
      splitPlacement.position
    )
    return validateLayoutTree(projectedTree, this.viewport).valid
  }

  private getPanelKind(panelId: string): PanelKind | null {
    return this.panelNodes.find((node) => node.panel.id === panelId)?.panel.kind || null
  }

  private computeBindingsForTree(tree: LayoutTree): {
    panelTabs: Record<string, LayoutPanelTabBinding>
    managerPanels: Partial<Record<PanelKind, string>>
  } {
    const panelNodes = listPanels(tree)
    const panelTabs: Record<string, LayoutPanelTabBinding> = {}
    const managerPanels: Partial<Record<PanelKind, string>> = {
      ...tree.managerPanels
    }

    PANEL_KIND_LIST.forEach((kind) => {
      const adapter = getPanelKindAdapter(kind)
      const inventoryHydrated = adapter.isOwnerInventoryHydrated(this.appStore)
      const panelIds = panelNodes.filter((node) => node.panel.kind === kind).map((node) => node.panel.id)
      if (panelIds.length === 0) {
        delete managerPanels[kind]
        return
      }

      const existingManager = managerPanels[kind]
      const managerPanelId = existingManager && panelIds.includes(existingManager) ? existingManager : panelIds[0]
      managerPanels[kind] = managerPanelId

      if (!inventoryHydrated) {
        panelIds.forEach((panelId) => {
          const existing = tree.panelTabs?.[panelId]
          const tabIds = unique(existing?.tabIds || [])
          const activeTabId = existing?.activeTabId && tabIds.includes(existing.activeTabId) ? existing.activeTabId : tabIds[0]
          panelTabs[panelId] = {
            tabIds,
            ...(activeTabId ? { activeTabId } : {})
          }
        })
        return
      }

      const ownerTabIds = adapter.getOwnerTabIds(this.appStore)
      const ownerSet = new Set(ownerTabIds)
      const consumed = new Set<string>()

      panelIds.forEach((panelId) => {
        const existing = tree.panelTabs?.[panelId]
        const tabIds = unique((existing?.tabIds || []).filter((id) => ownerSet.has(id) && !consumed.has(id)))
        tabIds.forEach((id) => consumed.add(id))
        panelTabs[panelId] = {
          tabIds,
          ...(existing?.activeTabId ? { activeTabId: existing.activeTabId } : {})
        }
      })

      const missing = ownerTabIds.filter((tabId) => !consumed.has(tabId))
      if (missing.length > 0) {
        panelTabs[managerPanelId] = {
          ...panelTabs[managerPanelId],
          tabIds: unique([...(panelTabs[managerPanelId]?.tabIds || []), ...missing])
        }
      }

      panelIds.forEach((panelId) => {
        const binding = panelTabs[panelId]
        if (!binding) return
        const activeTabId = binding.activeTabId
        if (!activeTabId || !binding.tabIds.includes(activeTabId)) {
          panelTabs[panelId] = {
            ...binding,
            ...(binding.tabIds[0] ? { activeTabId: binding.tabIds[0] } : {})
          }
          if (binding.tabIds.length === 0) {
            delete panelTabs[panelId].activeTabId
          }
        }
      })

      const globalActiveTabId = adapter.getGlobalActiveTabId(this.appStore)
      if (globalActiveTabId) {
        const activeOwnerPanelId = panelIds.find((panelId) => panelTabs[panelId]?.tabIds.includes(globalActiveTabId))
        if (activeOwnerPanelId) {
          panelTabs[activeOwnerPanelId] = {
            ...panelTabs[activeOwnerPanelId],
            activeTabId: globalActiveTabId
          }
        }
      }
    })

    return {
      panelTabs,
      managerPanels
    }
  }

  private findAutoRemovableEmptyPanelId(
    tree: LayoutTree,
    panelTabs: Record<string, LayoutPanelTabBinding>
  ): string | null {
    const panels = listPanels(tree)
    const eligible = panels.filter((panel) => {
      if (!getPanelKindAdapter(panel.panel.kind).isOwnerInventoryHydrated(this.appStore)) {
        return false
      }
      if (this.pinnedEmptyPanelIds.has(panel.panel.id)) {
        return false
      }
      const tabIds = panelTabs[panel.panel.id]?.tabIds || []
      if (tabIds.length > 0) return false
      const sameKindCount = panels.filter((entry) => entry.panel.kind === panel.panel.kind).length
      return sameKindCount > 1
    })
    if (eligible.length === 0) return null

    const nonManager = eligible.find((panel) => tree.managerPanels?.[panel.panel.kind] !== panel.panel.id)
    return (nonManager || eligible[0])?.panel.id || null
  }

  private moveTabBinding(kind: PanelKind, tabId: string, targetPanelId: string) {
    const nextTree = this.createTreeWithMovedTab(this.tree, kind, tabId, targetPanelId)
    if (!nextTree) return
    this.tree = nextTree
    this.syncPanelBindings({ persist: false })
    this.saveLayoutDebounced()
    this.syncGlobalActiveFromPanel(kind, tabId)
  }

  private createTreeWithMovedTab(
    tree: LayoutTree,
    kind: PanelKind,
    tabId: string,
    targetPanelId: string
  ): LayoutTree | null {
    const panelIds = listPanels(tree)
      .filter((node) => node.panel.kind === kind)
      .map((node) => node.panel.id)
    if (!panelIds.includes(targetPanelId)) return null

    const nextPanelTabs: Record<string, LayoutPanelTabBinding> = {
      ...(tree.panelTabs || {})
    }

    panelIds.forEach((panelId) => {
      const current = nextPanelTabs[panelId] || { tabIds: [] }
      const tabIds = current.tabIds.filter((id) => id !== tabId)
      const nextBinding: LayoutPanelTabBinding = {
        tabIds,
        ...(current.activeTabId ? { activeTabId: current.activeTabId } : {})
      }
      if (!nextBinding.activeTabId || !tabIds.includes(nextBinding.activeTabId)) {
        if (tabIds[0]) {
          nextBinding.activeTabId = tabIds[0]
        } else {
          delete nextBinding.activeTabId
        }
      }
      nextPanelTabs[panelId] = nextBinding
    })

    const target = nextPanelTabs[targetPanelId] || { tabIds: [] }
    nextPanelTabs[targetPanelId] = {
      ...target,
      tabIds: unique([...target.tabIds, tabId]),
      activeTabId: tabId
    }

    return {
      ...tree,
      panelTabs: nextPanelTabs,
      focusedPanelId: targetPanelId
    }
  }

  private syncGlobalActiveFromPanel(kind: PanelKind, tabId: string) {
    getPanelKindAdapter(kind).setGlobalActiveTab(this.appStore, tabId)
  }

  private applyTree(nextTree: LayoutTree) {
    if (nextTree === this.tree) return

    if (getPanelCount(nextTree) <= 0) {
      return
    }

    const validation = validateLayoutTree(nextTree, this.viewport)
    if (!validation.valid) {
      return
    }

    const focused = nextTree.focusedPanelId
    if (!focused || !nextTree.root) {
      nextTree.focusedPanelId = getFirstPanelId(nextTree) ?? undefined
    }

    this.tree = nextTree
    this.syncPanelBindings({ persist: false })
    this.saveLayoutDebounced()
  }

  private saveLayoutDebounced() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.saveLayout()
    }, 120)
  }

  private async saveLayout() {
    const legacy = deriveLegacyLayoutSnapshot(this.tree)
    const treeSnapshot = toJS(this.tree)

    await window.gyshell.settings.set({
      layout: {
        panelOrder: legacy.panelOrder,
        panelSizes: legacy.panelSizes,
        v2: treeSnapshot
      }
    })

    runInAction(() => {
      if (this.appStore.settings) {
        this.appStore.settings = {
          ...this.appStore.settings,
          layout: {
            ...this.appStore.settings.layout,
            panelOrder: legacy.panelOrder,
            panelSizes: legacy.panelSizes,
            v2: treeSnapshot
          }
        }
      }
    })
  }
}
