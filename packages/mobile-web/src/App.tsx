import React from 'react'
import { MessageList } from './components/chat/MessageList'
import { ComposerBar } from './components/composer/ComposerBar'
import { BottomNav, type MobileTabKey } from './components/layout/BottomNav'
import { TopBar } from './components/layout/TopBar'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { SkillsPanel } from './components/panels/SkillsPanel'
import { TerminalPanel } from './components/panels/TerminalPanel'
import { SessionSheet, type SessionSheetItem } from './components/sheets/SessionSheet'
import { useMobileController } from './hooks/useMobileController'
import { formatSessionListTitle, formatTopBarSessionTitle } from './lib/session-title'

export const App: React.FC = () => {
  const { state, actions } = useMobileController()
  const [activeTab, setActiveTab] = React.useState<MobileTabKey>('chat')
  const [sessionSheetOpen, setSessionSheetOpen] = React.useState(false)

  const messageListRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (activeTab !== 'chat') return
    const element = messageListRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [activeTab, state.activeSessionId, state.visibleMessages.length])

  const sessionItems = React.useMemo<SessionSheetItem[]>(() => {
    return state.sessionOrder.map((sessionId) => {
      const meta = state.sessionMeta[sessionId]
      const session = state.sessions[sessionId]
      return {
        id: sessionId,
        title: formatSessionListTitle(meta?.title || session?.title || 'Untitled'),
        updatedAt: meta?.updatedAt || Date.now(),
        preview: meta?.lastMessagePreview || '',
        messagesCount: meta?.messagesCount || 0,
        isRunning: !!(session?.isBusy || session?.isThinking)
      }
    })
  }, [state.sessionMeta, state.sessionOrder, state.sessions])

  const sessionTitle = formatTopBarSessionTitle(state.activeSession?.title || 'No Session')
  const sessionShortId = state.activeSessionId ? state.activeSessionId.slice(0, 8) : undefined
  const canSend = state.connectionStatus === 'connected' && state.composerValue.trim().length > 0
  const sessionHint = state.activeSessionId
    ? `Session ${state.activeSessionId.slice(0, 8)} · @ mention`
    : 'No active session'
  const activeSessionTerminalId = state.activeSession?.terminalId

  const topTitle =
    activeTab === 'chat'
      ? sessionTitle
      : activeTab === 'terminal'
        ? 'Terminal Tabs'
        : activeTab === 'skills'
          ? 'Skill Manager'
          : 'Settings'

  return (
    <div className="mobile-app-shell">
      <div className="mobile-app modern">
        <TopBar
          title={topTitle}
          sessionId={activeTab === 'chat' ? sessionShortId : undefined}
          connectionStatus={state.connectionStatus}
          onOpenSessions={() => {
            setSessionSheetOpen(true)
          }}
          showSessionMeta={activeTab === 'chat'}
          showSessionAction={activeTab === 'chat'}
        />

        {state.connectionError ? <section className="error-strip-modern">{state.connectionError}</section> : null}

        {activeTab === 'chat' ? (
          <>
            <MessageList messages={state.visibleMessages} onAskDecision={actions.replyAsk} listRef={messageListRef} />

            <ComposerBar
              value={state.composerValue}
              cursor={state.composerCursor}
              onChange={actions.setComposerValue}
              onCursorChange={actions.setComposerCursor}
              onSend={() => void actions.sendMessage()}
              onStop={() => void actions.stopActiveSession()}
              canSend={canSend}
              isRunning={state.isRunning}
              sessionHint={sessionHint}
              mentionOptions={state.mentionOptions}
              onPickMention={actions.pickMention}
            />
          </>
        ) : null}

        {activeTab === 'terminal' ? (
          <TerminalPanel
            terminals={state.terminals}
            activeTerminalTargetId={state.activeTerminalTargetId}
            activeSessionTerminalId={activeSessionTerminalId}
            onSelectTerminalTarget={actions.setActiveTerminalTargetId}
            onCreateTerminal={() => void actions.createTerminalTab()}
            onCloseTerminal={(terminalId) => void actions.closeTerminalTab(terminalId)}
          />
        ) : null}

        {activeTab === 'skills' ? (
          <SkillsPanel
            skills={state.skills}
            onSetSkillEnabled={(name, enabled) => void actions.setSkillEnabled(name, enabled)}
          />
        ) : null}

        {activeTab === 'settings' ? (
          <SettingsPanel
            gatewayInput={state.gatewayInput}
            connectionStatus={state.connectionStatus}
            actionPending={state.actionPending}
            connectionError={state.connectionError}
            profiles={state.profiles}
            activeProfileId={state.activeProfileId}
            onGatewayInputChange={actions.setGatewayInput}
            onConnect={() => void actions.connectGateway()}
            onDisconnect={actions.disconnectGateway}
            onUpdateProfile={(profileId) => void actions.updateProfile(profileId)}
          />
        ) : null}

        <BottomNav
          activeTab={activeTab}
          onChange={(nextTab) => {
            setSessionSheetOpen(false)
            setActiveTab(nextTab)
          }}
        />

        <SessionSheet
          open={sessionSheetOpen && activeTab === 'chat'}
          activeSessionId={state.activeSessionId}
          items={sessionItems}
          onClose={() => setSessionSheetOpen(false)}
          onCreateSession={async () => {
            await actions.createSession()
            setSessionSheetOpen(false)
          }}
          onSwitchSession={async (sessionId) => {
            await actions.switchSession(sessionId)
            setSessionSheetOpen(false)
          }}
        />
      </div>
    </div>
  )
}
