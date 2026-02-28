import type { LucideIcon } from 'lucide-react'
import { MessageSquare, SquareTerminal } from 'lucide-react'
import type { PanelKind } from '../../layout'
import type { AppStore } from '../../stores/AppStore'

type LayoutPanelKindLabelKey = 'chatKind' | 'terminalKind'
export type RailClickIntent = 'open-panel-only' | 'create-new-tab'

export interface RailClickContext {
  panelCount: number
  ownerTabCount: number
}

export const resolveDefaultRailClickIntent = (context: RailClickContext): RailClickIntent => {
  if (context.panelCount === 0 && context.ownerTabCount > 0) {
    return 'open-panel-only'
  }
  return 'create-new-tab'
}

export interface PanelKindUiRegistryItem {
  kind: PanelKind
  icon: LucideIcon
  labelKey: LayoutPanelKindLabelKey
  resolveRailClickIntent: (context: RailClickContext) => RailClickIntent
  getOwnerTabCount: (store: AppStore) => number
  createDefaultTab: (store: AppStore, panelId: string) => void
}

const createPanelKindUiItem = (item: PanelKindUiRegistryItem): PanelKindUiRegistryItem => item

export const PANEL_KIND_UI_REGISTRY: Record<PanelKind, PanelKindUiRegistryItem> = {
  chat: createPanelKindUiItem({
    kind: 'chat',
    icon: MessageSquare,
    labelKey: 'chatKind',
    resolveRailClickIntent: resolveDefaultRailClickIntent,
    getOwnerTabCount: (store) => store.chat.sessions.length,
    createDefaultTab: (store, panelId) => {
      const sessionId = store.chat.createSession()
      store.layout.attachTabToPanel('chat', sessionId, panelId)
    }
  }),
  terminal: createPanelKindUiItem({
    kind: 'terminal',
    icon: SquareTerminal,
    labelKey: 'terminalKind',
    resolveRailClickIntent: resolveDefaultRailClickIntent,
    getOwnerTabCount: (store) => store.terminalTabs.length,
    createDefaultTab: (store, panelId) => {
      store.createLocalTab(panelId)
    }
  })
}

export const PANEL_KIND_UI_ORDER: readonly PanelKind[] = Object.freeze(
  Object.keys(PANEL_KIND_UI_REGISTRY) as PanelKind[]
)

export const getPanelKindUiItem = (kind: PanelKind): PanelKindUiRegistryItem =>
  PANEL_KIND_UI_REGISTRY[kind]
