import React from 'react'
import { GatewayClient } from '../gateway-client'
import { loadGatewayUrlFromStorage, normalizeGatewayUrl, saveGatewayUrlToStorage } from '../lib/gateway-url'
import {
  applyMentionToInput,
  encodeMentions,
  getMentionSuggestions,
  type MentionOption
} from '../lib/mentions'
import { getRenderableMessages } from '../lib/message-view'
import {
  applyUiUpdate,
  cloneMessage,
  cloneSession,
  createSessionState,
  normalizeDisplayText,
  previewFromSession,
  reorderSessionIds,
  type SessionMeta,
  type SessionState
} from '../session-store'
import type {
  ChatMessage,
  GatewayProfileSummary,
  GatewaySessionSnapshot,
  GatewaySessionSummary,
  SkillSummary,
  GatewayTerminalSummary,
  UIUpdateAction
} from '../types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface ViewState {
  terminals: GatewayTerminalSummary[]
  skills: SkillSummary[]
  profiles: GatewayProfileSummary[]
  activeProfileId: string
  activeTerminalTargetId: string | null
  sessions: Record<string, SessionState>
  sessionMeta: Record<string, SessionMeta>
  sessionOrder: string[]
  activeSessionId: string | null
  statusLine: string
}

const INITIAL_VIEW_STATE: ViewState = {
  terminals: [],
  skills: [],
  profiles: [],
  activeProfileId: '',
  activeTerminalTargetId: null,
  sessions: {},
  sessionMeta: {},
  sessionOrder: [],
  activeSessionId: null,
  statusLine: 'Ready'
}

function resolveTerminalId(
  preferredTerminalId: string | undefined,
  terminals: GatewayTerminalSummary[],
  fallbackTerminalId: string
): string {
  if (!preferredTerminalId) return fallbackTerminalId
  const exists = terminals.some((terminal) => terminal.id === preferredTerminalId)
  return exists ? preferredTerminalId : fallbackTerminalId
}

function buildSessionMeta(
  session: SessionState,
  previous: SessionMeta | undefined,
  patch?: Partial<SessionMeta>
): SessionMeta {
  return {
    id: session.id,
    title: session.title,
    updatedAt: Date.now(),
    messagesCount: session.messages.length,
    boundTerminalId: session.terminalId,
    lastMessagePreview: previewFromSession(session),
    loaded: previous?.loaded ?? true,
    ...patch
  }
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function compactStatusLabel(text: string, limit = 28): string {
  const normalized = normalizeDisplayText(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return 'Untitled'
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(1, limit - 3))}...`
}

export interface MobileControllerState {
  gatewayInput: string
  connectionStatus: ConnectionStatus
  connectionError: string
  actionPending: boolean
  composerValue: string
  composerCursor: number
  mentionOptions: MentionOption[]
  terminals: GatewayTerminalSummary[]
  skills: SkillSummary[]
  profiles: GatewayProfileSummary[]
  activeProfileId: string
  activeTerminalTargetId: string | null
  activeSession: SessionState | null
  activeSessionId: string | null
  visibleMessages: ChatMessage[]
  sessionOrder: string[]
  sessionMeta: Record<string, SessionMeta>
  sessions: Record<string, SessionState>
  statusLine: string
  isRunning: boolean
}

export interface MobileControllerActions {
  setGatewayInput: (value: string) => void
  setComposerValue: (value: string, cursor: number) => void
  setComposerCursor: (cursor: number) => void
  pickMention: (option: MentionOption) => void
  connectGateway: () => Promise<void>
  disconnectGateway: () => void
  switchSession: (sessionId: string) => Promise<void>
  createSession: () => Promise<string | null>
  sendMessage: () => Promise<void>
  stopActiveSession: () => Promise<void>
  updateProfile: (profileId: string) => Promise<void>
  setSkillEnabled: (name: string, enabled: boolean) => Promise<void>
  replyAsk: (message: ChatMessage, decision: 'allow' | 'deny') => Promise<void>
  setActiveTerminalTargetId: (terminalId: string) => void
  createTerminalTab: () => Promise<void>
  closeTerminalTab: (terminalId: string) => Promise<void>
}

export function useMobileController(): {
  state: MobileControllerState
  actions: MobileControllerActions
} {
  const clientRef = React.useRef<GatewayClient>()
  if (!clientRef.current) {
    clientRef.current = new GatewayClient()
  }
  const client = clientRef.current

  const [gatewayInput, setGatewayInput] = React.useState<string>(() => loadGatewayUrlFromStorage())
  const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatus>('disconnected')
  const [connectionError, setConnectionError] = React.useState('')
  const [actionPending, setActionPending] = React.useState(false)

  const [composerValue, setComposerValueRaw] = React.useState('')
  const [composerCursor, setComposerCursor] = React.useState(0)

  const [view, setView] = React.useState<ViewState>(INITIAL_VIEW_STATE)
  const viewRef = React.useRef<ViewState>(INITIAL_VIEW_STATE)
  React.useEffect(() => {
    viewRef.current = view
  }, [view])

  const activeSession = React.useMemo(() => {
    if (!view.activeSessionId) return null
    return view.sessions[view.activeSessionId] || null
  }, [view.activeSessionId, view.sessions])

  const visibleMessages = React.useMemo(() => {
    if (!activeSession) return [] as ChatMessage[]
    return getRenderableMessages(activeSession.messages)
  }, [activeSession])

  const mentionState = React.useMemo(() => {
    return getMentionSuggestions(composerValue, composerCursor, view.terminals, view.skills)
  }, [composerCursor, composerValue, view.skills, view.terminals])

  const applyLiveUpdate = React.useCallback((update: UIUpdateAction) => {
    setView((previous) => {
      const sessions = { ...previous.sessions }
      const sessionMeta = { ...previous.sessionMeta }
      const sessionOrder = [...previous.sessionOrder]
      const fallbackTerminalId = previous.terminals[0]?.id || previous.activeTerminalTargetId || ''

      const current = sessions[update.sessionId]
      const nextSession = current
        ? cloneSession(current)
        : createSessionState(update.sessionId, fallbackTerminalId, 'New Chat')

      if (
        update.type === 'ADD_MESSAGE' ||
        update.type === 'APPEND_CONTENT' ||
        update.type === 'APPEND_OUTPUT' ||
        update.type === 'UPDATE_MESSAGE'
      ) {
        nextSession.isBusy = true
      }

      applyUiUpdate(nextSession, update)
      sessions[update.sessionId] = nextSession

      if (!sessionOrder.includes(update.sessionId)) {
        sessionOrder.unshift(update.sessionId)
      }

      const prevMeta = sessionMeta[update.sessionId]
      sessionMeta[update.sessionId] = buildSessionMeta(nextSession, prevMeta, {
        loaded: true,
        updatedAt: Date.now()
      })

      return {
        ...previous,
        sessions,
        sessionMeta,
        sessionOrder: reorderSessionIds(sessionOrder, sessionMeta),
        activeSessionId: previous.activeSessionId || update.sessionId
      }
    })
  }, [])

  React.useEffect(() => {
    const unsubscribers = [
      client.on('status', (status, detail) => {
        setConnectionStatus(status)
        if (status === 'connecting') {
          setConnectionError('')
          setView((previous) => ({ ...previous, statusLine: 'Connecting gateway...' }))
        }
        if (status === 'connected') {
          setConnectionError('')
          setView((previous) => ({ ...previous, statusLine: 'Gateway connected' }))
        }
        if (status === 'disconnected') {
          const reason = detail || 'connection closed'
          setView((previous) => ({ ...previous, statusLine: `Disconnected: ${reason}` }))
        }
      }),
      client.on('error', (message) => {
        setConnectionError(message)
      }),
      client.on('uiUpdate', (update) => {
        applyLiveUpdate(update)
      }),
      client.on('gatewayEvent', (event) => {
        if (event.type !== 'system:notification') return
        const text = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload)
        setView((previous) => ({ ...previous, statusLine: text }))
      }),
      client.on('raw', (channel, payload) => {
        if (channel === 'tools:mcpUpdated') {
          setView((previous) => ({ ...previous, statusLine: 'MCP status updated' }))
          return
        }

        if (channel === 'skills:updated') {
          if (!Array.isArray(payload)) return
          const enabledNames = new Set(
            payload
              .map((item) => {
                if (!item || typeof item !== 'object') return null
                if (!('name' in item) || typeof item.name !== 'string') return null
                return item.name
              })
              .filter((name): name is string => !!name)
          )
          setView((previous) => {
            const updated = previous.skills.map((skill) => ({
              ...skill,
              enabled: enabledNames.has(skill.name)
            }))
            return {
              ...previous,
              skills: updated,
              statusLine: `Skills updated (${enabledNames.size})`
            }
          })
        }
      })
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      client.disconnect()
    }
  }, [applyLiveUpdate, client])

  const connectGateway = React.useCallback(async () => {
    const target = normalizeGatewayUrl(gatewayInput)
    setActionPending(true)
    setConnectionError('')

    try {
      await client.connect(target)
      saveGatewayUrlToStorage(target)

      const terminalPayload = await client.request<{ terminals: GatewayTerminalSummary[] }>('terminal:list', {})
      const terminals = terminalPayload.terminals || []
      if (terminals.length === 0) {
        throw new Error('No terminal is available on backend.')
      }

      let profiles: GatewayProfileSummary[] = []
      let activeProfileId = ''
      let skills: SkillSummary[] = []
      let skillsUnavailable = false
      try {
        const profilePayload = await client.request<{ activeProfileId: string; profiles: GatewayProfileSummary[] }>(
          'models:getProfiles',
          {}
        )
        profiles = profilePayload.profiles || []
        activeProfileId = profilePayload.activeProfileId || ''
      } catch {
        profiles = []
        activeProfileId = ''
      }

      try {
        const skillPayload = await client.request<{ skills: SkillSummary[] }>('skills:list', {})
        skills = (skillPayload.skills || []).map((skill) => ({
          ...skill,
          enabled: skill.enabled !== false
        }))
      } catch {
        skills = []
        skillsUnavailable = true
      }

      const sessionPayload = await client.request<{ sessions: GatewaySessionSummary[] }>('session:list', {})
      let summaries = sessionPayload.sessions || []

      if (summaries.length === 0) {
        const created = await client.request<{ sessionId: string }>('gateway:createSession', {
          terminalId: terminals[0].id
        })
        summaries = [
          {
            id: created.sessionId,
            title: 'New Chat',
            updatedAt: Date.now(),
            messagesCount: 0,
            boundTerminalId: terminals[0].id,
            lastMessagePreview: '',
            isBusy: false
          }
        ]
      }

      const sortedSummaries = [...summaries].sort((left, right) => right.updatedAt - left.updatedAt)
      const initialSummary = sortedSummaries[0]
      if (!initialSummary) {
        throw new Error('No session available from gateway.')
      }

      const snapshotPayload = await client.request<{ session: GatewaySessionSnapshot }>('session:get', {
        sessionId: initialSummary.id
      })
      const snapshot = snapshotPayload.session
      const fallbackTerminalId = terminals[0].id

      const sessions: Record<string, SessionState> = {}
      const sessionMeta: Record<string, SessionMeta> = {}

      for (const summary of sortedSummaries) {
        const terminalId = resolveTerminalId(summary.boundTerminalId, terminals, fallbackTerminalId)
        const loaded = summary.id === snapshot.id
        const session = createSessionState(summary.id, terminalId, summary.title || 'Recovered Session')
        if (loaded) {
          session.title = snapshot.title || session.title
          session.messages = (snapshot.messages || []).map(cloneMessage)
          session.isBusy = snapshot.isBusy === true
          session.isThinking = snapshot.isBusy === true
        } else {
          session.isBusy = summary.isBusy === true
          session.isThinking = summary.isBusy === true
        }
        sessions[summary.id] = session
        sessionMeta[summary.id] = {
          id: summary.id,
          title: loaded ? session.title : summary.title || 'Recovered Session',
          updatedAt: summary.updatedAt || Date.now(),
          messagesCount: loaded ? session.messages.length : summary.messagesCount,
          boundTerminalId: summary.boundTerminalId,
          lastMessagePreview: loaded ? previewFromSession(session) : summary.lastMessagePreview,
          loaded
        }
      }

      const order = reorderSessionIds(
        sortedSummaries.map((summary) => summary.id),
        sessionMeta
      )

      const activeTerminalTargetId = sessions[snapshot.id]?.terminalId || terminals[0]?.id || null

      setView({
        terminals,
        skills,
        profiles,
        activeProfileId,
        activeTerminalTargetId,
        sessions,
        sessionMeta,
        sessionOrder: order,
        activeSessionId: snapshot.id,
        statusLine: skillsUnavailable ? `Connected: ${target} (skills unavailable)` : `Connected: ${target}`
      })
    } catch (error) {
      setConnectionError(safeError(error))
    } finally {
      setActionPending(false)
    }
  }, [client, gatewayInput])

  const disconnectGateway = React.useCallback(() => {
    client.disconnect()
    setConnectionStatus('disconnected')
    setView((previous) => ({ ...previous, statusLine: 'Disconnected by user' }))
  }, [client])

  const ensureSessionLoaded = React.useCallback(
    async (sessionId: string) => {
      const snapshotState = viewRef.current
      const currentMeta = snapshotState.sessionMeta[sessionId]
      if (currentMeta?.loaded) return

      const fallbackTerminalId = snapshotState.terminals[0]?.id || snapshotState.activeTerminalTargetId || ''
      const payload = await client.request<{ session: GatewaySessionSnapshot }>('session:get', { sessionId })
      const snapshot = payload.session

      setView((previous) => {
        const sessions = { ...previous.sessions }
        const sessionMeta = { ...previous.sessionMeta }

        const terminalId = resolveTerminalId(snapshot.boundTerminalId, previous.terminals, fallbackTerminalId)
        const nextSession = createSessionState(sessionId, terminalId, snapshot.title || 'Recovered Session')
        nextSession.messages = (snapshot.messages || []).map(cloneMessage)
        nextSession.isBusy = snapshot.isBusy === true
        nextSession.isThinking = snapshot.isBusy === true
        sessions[sessionId] = nextSession

        sessionMeta[sessionId] = {
          id: sessionId,
          title: nextSession.title,
          updatedAt: snapshot.updatedAt || Date.now(),
          messagesCount: nextSession.messages.length,
          boundTerminalId: snapshot.boundTerminalId,
          lastMessagePreview: previewFromSession(nextSession),
          loaded: true
        }

        return {
          ...previous,
          sessions,
          sessionMeta
        }
      })
    },
    [client]
  )

  const switchSession = React.useCallback(
    async (sessionId: string) => {
      try {
        await ensureSessionLoaded(sessionId)
        setView((previous) => {
          const targetTerminalId = previous.sessions[sessionId]?.terminalId || previous.activeTerminalTargetId
          return {
            ...previous,
            activeSessionId: sessionId,
            activeTerminalTargetId: targetTerminalId,
            statusLine: `Session: ${compactStatusLabel(previous.sessionMeta[sessionId]?.title || sessionId)}`
          }
        })
      } catch (error) {
        setConnectionError(`Failed to load session: ${safeError(error)}`)
      }
    },
    [ensureSessionLoaded]
  )

  const createSessionInternal = React.useCallback(async (): Promise<{ sessionId: string; terminalId: string } | null> => {
    if (!client.isConnected()) {
      setConnectionError('Gateway is not connected')
      return null
    }

    const snapshot = viewRef.current
    const terminalId =
      snapshot.activeTerminalTargetId ||
      (snapshot.activeSessionId ? snapshot.sessions[snapshot.activeSessionId]?.terminalId : undefined) ||
      snapshot.terminals[0]?.id

    if (!terminalId) {
      setConnectionError('No terminal available for new session')
      return null
    }

    try {
      const payload = await client.request<{ sessionId: string }>('gateway:createSession', {
        terminalId
      })

      setView((previous) => {
        const sessions = { ...previous.sessions }
        const sessionMeta = { ...previous.sessionMeta }
        const sessionOrder = [payload.sessionId, ...previous.sessionOrder.filter((id) => id !== payload.sessionId)]
        const nextSession = createSessionState(payload.sessionId, terminalId)
        sessions[payload.sessionId] = nextSession
        sessionMeta[payload.sessionId] = {
          id: payload.sessionId,
          title: nextSession.title,
          updatedAt: Date.now(),
          messagesCount: 0,
          boundTerminalId: terminalId,
          lastMessagePreview: '',
          loaded: true
        }
        return {
          ...previous,
          sessions,
          sessionMeta,
          sessionOrder,
          activeSessionId: payload.sessionId,
          activeTerminalTargetId: terminalId,
          statusLine: `Created session ${payload.sessionId.slice(0, 8)}`
        }
      })

      return { sessionId: payload.sessionId, terminalId }
    } catch (error) {
      setConnectionError(`Failed to create session: ${safeError(error)}`)
      return null
    }
  }, [client])

  const createSession = React.useCallback(async (): Promise<string | null> => {
    const result = await createSessionInternal()
    return result?.sessionId || null
  }, [createSessionInternal])

  const sendMessage = React.useCallback(async () => {
    const content = composerValue.trim()
    if (!content) return

    if (!client.isConnected()) {
      setConnectionError('Connect gateway first')
      return
    }

    let targetSessionId = viewRef.current.activeSessionId
    let targetTerminalId =
      (targetSessionId ? viewRef.current.sessions[targetSessionId]?.terminalId : undefined) ||
      viewRef.current.activeTerminalTargetId ||
      viewRef.current.terminals[0]?.id

    if (!targetSessionId) {
      const created = await createSessionInternal()
      if (!created) return
      targetSessionId = created.sessionId
      targetTerminalId = created.terminalId
    }

    if (!targetTerminalId) {
      setConnectionError('No terminal bound to current session')
      return
    }

    const snapshot = viewRef.current
    const session = snapshot.sessions[targetSessionId]
    const encodedText = encodeMentions(content, snapshot.terminals, snapshot.skills)

    setComposerValueRaw('')
    setComposerCursor(0)

    setView((previous) => {
      const sessions = { ...previous.sessions }
      const current = sessions[targetSessionId!]
      if (current) {
        const copy = cloneSession(current)
        copy.isThinking = true
        copy.isBusy = true
        copy.lockedProfileId = previous.activeProfileId || null
        sessions[targetSessionId!] = copy
      }
      return {
        ...previous,
        sessions,
        statusLine: 'Prompt sent'
      }
    })

    try {
      await client.request('agent:startTaskAsync', {
        sessionId: targetSessionId,
        terminalId: targetTerminalId,
        userText: encodedText,
        options: {
          startMode: session?.isBusy ? 'inserted' : 'normal'
        }
      })
    } catch (error) {
      setConnectionError(`Failed to send prompt: ${safeError(error)}`)
      setView((previous) => {
        const sessions = { ...previous.sessions }
        const current = sessions[targetSessionId!]
        if (current) {
          const copy = cloneSession(current)
          copy.isThinking = false
          copy.isBusy = false
          copy.lockedProfileId = null
          sessions[targetSessionId!] = copy
        }
        return {
          ...previous,
          sessions
        }
      })
    }
  }, [client, composerValue, createSessionInternal])

  const stopActiveSession = React.useCallback(async () => {
    const active = viewRef.current.activeSessionId
    if (!active) return
    try {
      await client.request('agent:stopTask', { sessionId: active })
      setView((previous) => ({ ...previous, statusLine: 'Stop signal sent' }))
    } catch (error) {
      setConnectionError(`Failed to stop: ${safeError(error)}`)
    }
  }, [client])

  const updateProfile = React.useCallback(
    async (profileId: string) => {
      if (!profileId) return
      try {
        const payload = await client.request<{
          activeProfileId: string
          profiles: GatewayProfileSummary[]
        }>('models:setActiveProfile', { profileId })

        setView((previous) => ({
          ...previous,
          profiles: payload.profiles,
          activeProfileId: payload.activeProfileId,
          statusLine: `Profile: ${payload.profiles.find((item) => item.id === payload.activeProfileId)?.name || profileId}`
        }))
      } catch (error) {
        setConnectionError(`Failed to switch profile: ${safeError(error)}`)
      }
    },
    [client]
  )

  const setSkillEnabled = React.useCallback(
    async (name: string, enabled: boolean) => {
      if (!name || !client.isConnected()) return
      try {
        const payload = await client.request<{ skills: SkillSummary[] }>('skills:setEnabled', {
          name,
          enabled
        })
        const nextSkills = (payload.skills || []).map((skill) => ({
          ...skill,
          enabled: skill.enabled !== false
        }))
        setView((previous) => ({
          ...previous,
          skills: nextSkills,
          statusLine: `${enabled ? 'Enabled' : 'Disabled'} skill: ${name}`
        }))
      } catch (error) {
        setConnectionError(`Failed to update skill: ${safeError(error)}`)
      }
    },
    [client]
  )

  const replyAsk = React.useCallback(
    async (message: ChatMessage, decision: 'allow' | 'deny') => {
      const activeSessionId = viewRef.current.activeSessionId
      if (!activeSessionId) return

      try {
        if (message.metadata?.approvalId) {
          await client.request('agent:replyCommandApproval', {
            approvalId: message.metadata.approvalId,
            decision
          })
        } else {
          await client.request('agent:replyMessage', {
            messageId: message.backendMessageId || message.id,
            payload: { decision }
          })
        }

        setView((previous) => {
          const sessions = { ...previous.sessions }
          const current = sessions[activeSessionId]
          if (!current) return previous

          const copy = cloneSession(current)
          copy.messages = copy.messages.map((item) => {
            if (item.id !== message.id) return item
            return {
              ...item,
              metadata: {
                ...(item.metadata ?? {}),
                decision
              }
            }
          })
          sessions[activeSessionId] = copy

          return {
            ...previous,
            sessions,
            statusLine: `Decision sent: ${decision}`
          }
        })
      } catch (error) {
        setConnectionError(`Failed to send decision: ${safeError(error)}`)
      }
    },
    [client]
  )

  const setComposerValue = React.useCallback((value: string, cursor: number) => {
    setComposerValueRaw(value)
    setComposerCursor(cursor)
  }, [])

  const pickMention = React.useCallback(
    (option: MentionOption) => {
      const context = mentionState.context
      if (!context) return
      const next = applyMentionToInput(composerValue, context, option)
      setComposerValueRaw(next.value)
      setComposerCursor(next.cursor)
    },
    [composerValue, mentionState.context]
  )

  const setActiveTerminalTargetId = React.useCallback((terminalId: string) => {
    setView((previous) => ({ ...previous, activeTerminalTargetId: terminalId }))
  }, [])

  const reconcileTerminals = React.useCallback(
    (terminals: GatewayTerminalSummary[], statusLine: string) => {
      setView((previous) => {
        const nextTerminals = terminals
        const nextTerminalIds = new Set(nextTerminals.map((terminal) => terminal.id))
        const fallbackTerminalId = nextTerminals[0]?.id || null
        const nextActiveTerminalTargetId =
          previous.activeTerminalTargetId && nextTerminalIds.has(previous.activeTerminalTargetId)
            ? previous.activeTerminalTargetId
            : fallbackTerminalId

        const sessions = { ...previous.sessions }
        const sessionMeta = { ...previous.sessionMeta }

        for (const sessionId of Object.keys(sessions)) {
          const session = sessions[sessionId]
          if (!session) continue
          if (nextTerminalIds.has(session.terminalId)) continue
          if (!fallbackTerminalId) continue

          const nextSession = cloneSession(session)
          nextSession.terminalId = fallbackTerminalId
          sessions[sessionId] = nextSession

          const meta = sessionMeta[sessionId]
          if (meta) {
            sessionMeta[sessionId] = {
              ...meta,
              boundTerminalId: fallbackTerminalId
            }
          }
        }

        return {
          ...previous,
          terminals: nextTerminals,
          sessions,
          sessionMeta,
          activeTerminalTargetId: nextActiveTerminalTargetId,
          statusLine
        }
      })
    },
    []
  )

  const createTerminalTab = React.useCallback(async () => {
    if (!client.isConnected()) {
      setConnectionError('Gateway is not connected')
      return
    }

    try {
      const snapshot = viewRef.current
      const localCount = snapshot.terminals.filter((terminal) => terminal.type === 'local').length
      const existingIds = new Set(snapshot.terminals.map((terminal) => terminal.id))
      let suffix = Math.max(2, localCount + 1)
      let nextId = `local-${suffix}`
      while (existingIds.has(nextId)) {
        suffix += 1
        nextId = `local-${suffix}`
      }

      const title = `Local (${localCount + 1})`
      await client.request<{ id: string }>('terminal:createTab', {
        config: {
          type: 'local',
          id: nextId,
          title,
          cols: 120,
          rows: 32
        }
      })

      const payload = await client.request<{ terminals: GatewayTerminalSummary[] }>('terminal:list', {})
      reconcileTerminals(payload.terminals || [], `Created terminal ${title}`)
    } catch (error) {
      setConnectionError(`Failed to create terminal: ${safeError(error)}`)
    }
  }, [client, reconcileTerminals])

  const closeTerminalTab = React.useCallback(
    async (terminalId: string) => {
      if (!terminalId) return
      if (!client.isConnected()) {
        setConnectionError('Gateway is not connected')
        return
      }

      const snapshot = viewRef.current
      if (snapshot.terminals.length <= 1) {
        setConnectionError('Cannot close the last terminal tab')
        return
      }

      try {
        await client.request('terminal:kill', { terminalId })
        const payload = await client.request<{ terminals: GatewayTerminalSummary[] }>('terminal:list', {})
        reconcileTerminals(payload.terminals || [], 'Closed terminal tab')
      } catch (error) {
        setConnectionError(`Failed to close terminal: ${safeError(error)}`)
      }
    },
    [client, reconcileTerminals]
  )

  const state: MobileControllerState = {
    gatewayInput,
    connectionStatus,
    connectionError,
    actionPending,
    composerValue,
    composerCursor,
    mentionOptions: mentionState.options,
    terminals: view.terminals,
    skills: view.skills,
    profiles: view.profiles,
    activeProfileId: view.activeProfileId,
    activeTerminalTargetId: view.activeTerminalTargetId,
    activeSession,
    activeSessionId: view.activeSessionId,
    visibleMessages,
    sessionOrder: view.sessionOrder,
    sessionMeta: view.sessionMeta,
    sessions: view.sessions,
    statusLine: view.statusLine,
    isRunning: !!(activeSession?.isBusy || activeSession?.isThinking)
  }

  const actions: MobileControllerActions = {
    setGatewayInput,
    setComposerValue,
    setComposerCursor,
    pickMention,
    connectGateway,
    disconnectGateway,
    switchSession,
    createSession,
    sendMessage,
    stopActiveSession,
    updateProfile,
    setSkillEnabled,
    replyAsk,
    setActiveTerminalTargetId,
    createTerminalTab,
    closeTerminalTab
  }

  return {
    state,
    actions
  }
}
