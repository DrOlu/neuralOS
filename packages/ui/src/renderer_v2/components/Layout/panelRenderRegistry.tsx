import React from 'react'
import type { AppStore } from '../../stores/AppStore'
import { ChatPanel } from '../Chat/ChatPanel'
import { TerminalPanel } from '../Terminal/TerminalPanel'
import type { PanelKind } from '../../layout'

export interface LayoutPanelRenderProps {
  store: AppStore
  panelId: string
  tabIds: string[]
  activeTabId: string | null
  isManagerPanel: boolean
  onSelectTab: (tabId: string) => void
  onLayoutHeaderMouseDown?: (event: React.MouseEvent<HTMLElement>) => void
  onLayoutHeaderContextMenu?: (event: React.MouseEvent<HTMLElement>) => void
}

type LayoutPanelRenderer = React.FC<LayoutPanelRenderProps>

const TerminalPanelRenderer: LayoutPanelRenderer = ({
  store,
  panelId,
  tabIds,
  activeTabId,
  isManagerPanel,
  onSelectTab,
  onLayoutHeaderMouseDown,
  onLayoutHeaderContextMenu
}) => (
  <TerminalPanel
    store={store}
    panelId={panelId}
    tabs={tabIds
      .map((tabId) => store.terminalTabs.find((tab) => tab.id === tabId))
      .filter((tab): tab is NonNullable<typeof tab> => !!tab)}
    activeTabId={activeTabId}
    isManagerPanel={isManagerPanel}
    onSelectTab={onSelectTab}
    onLayoutHeaderMouseDown={onLayoutHeaderMouseDown}
    onLayoutHeaderContextMenu={onLayoutHeaderContextMenu}
  />
)

const ChatPanelRenderer: LayoutPanelRenderer = ({
  store,
  panelId,
  tabIds,
  activeTabId,
  isManagerPanel,
  onSelectTab,
  onLayoutHeaderMouseDown,
  onLayoutHeaderContextMenu
}) => (
  <ChatPanel
    store={store}
    panelId={panelId}
    sessionIds={tabIds}
    activeSessionId={activeTabId}
    isManagerPanel={isManagerPanel}
    onSelectSession={onSelectTab}
    onLayoutHeaderMouseDown={onLayoutHeaderMouseDown}
    onLayoutHeaderContextMenu={onLayoutHeaderContextMenu}
  />
)

const PANEL_RENDERERS: Record<PanelKind, LayoutPanelRenderer> = {
  terminal: TerminalPanelRenderer,
  chat: ChatPanelRenderer
}

export const renderPanelByKind = (
  kind: PanelKind,
  props: LayoutPanelRenderProps
): React.ReactElement => {
  const Renderer = PANEL_RENDERERS[kind]
  return <Renderer {...props} />
}
