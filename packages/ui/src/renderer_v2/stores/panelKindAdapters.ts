import type { AppStore } from './AppStore'
import type { PanelKind } from '../layout'

export interface PanelKindAdapter {
  kind: PanelKind
  getOwnerTabIds: (appStore: AppStore) => string[]
  getGlobalActiveTabId: (appStore: AppStore) => string | null
  isOwnerInventoryHydrated: (appStore: AppStore) => boolean
  setGlobalActiveTab: (appStore: AppStore, tabId: string) => void
}

const createPanelKindAdapter = (
  adapter: PanelKindAdapter
): PanelKindAdapter => adapter

const PANEL_KIND_ADAPTERS: Record<PanelKind, PanelKindAdapter> = {
  terminal: createPanelKindAdapter({
    kind: 'terminal',
    getOwnerTabIds: (appStore) => appStore.terminalTabs.map((tab) => tab.id),
    getGlobalActiveTabId: (appStore) => appStore.activeTerminalId || null,
    isOwnerInventoryHydrated: (appStore) => appStore.terminalTabsHydrated === true,
    setGlobalActiveTab: (appStore, tabId) => {
      appStore.setActiveTerminal(tabId)
    }
  }),
  chat: createPanelKindAdapter({
    kind: 'chat',
    getOwnerTabIds: (appStore) => appStore.chat.sessions.map((session) => session.id),
    getGlobalActiveTabId: (appStore) => appStore.chat.activeSessionId || null,
    isOwnerInventoryHydrated: (appStore) => appStore.chat.sessionInventoryHydrated === true,
    setGlobalActiveTab: (appStore, tabId) => {
      appStore.chat.setActiveSession(tabId)
    }
  })
}

export const PANEL_KIND_LIST: readonly PanelKind[] = Object.freeze(
  Object.keys(PANEL_KIND_ADAPTERS) as PanelKind[]
)

export const getPanelKindAdapter = (kind: PanelKind): PanelKindAdapter =>
  PANEL_KIND_ADAPTERS[kind]
