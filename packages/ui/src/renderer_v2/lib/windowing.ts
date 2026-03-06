import type { LayoutPanelTabBinding, LayoutTree, PanelKind } from '../layout'
import {
  normalizeFileEditorSnapshot,
  type FileEditorSnapshot
} from './fileEditorSnapshot'

export type RendererWindowRole = 'main' | 'detached'

const DETACHED_STATE_KEY_PREFIX = 'gyshell.detachedState.'
const PANEL_DRAG_STATE_KEY_PREFIX = 'gyshell.panelDragState.'
const WINDOW_CLIENT_ID_KEY = 'gyshell.windowClientId'
export const WINDOWING_BROADCAST_CHANNEL = 'gyshell-windowing-v1'
const WINDOWING_STORAGE_CHANNEL_KEY_PREFIX = 'gyshell.windowingChannel.'
export const WINDOWING_STORAGE_CHANNEL_KEY = `${WINDOWING_STORAGE_CHANNEL_KEY_PREFIX}${WINDOWING_BROADCAST_CHANNEL}`

export interface RendererWindowContext {
  role: RendererWindowRole
  detachedStateToken: string | null
  sourceClientId: string | null
  clientId: string
}

export interface DetachedWindowState {
  sourceClientId: string
  layoutTree: LayoutTree
  createdAt: number
  fileEditorSnapshot?: FileEditorSnapshot
}

export interface WindowingMergePanelPayload {
  kind: PanelKind
  tabBinding?: LayoutPanelTabBinding
}

export interface WindowingTabMovedMessage {
  type: 'tab-moved'
  sourceClientId: string
  targetClientId: string
  kind: PanelKind
  tabId: string
}

export interface WindowingPanelMovedMessage {
  type: 'panel-moved'
  sourceClientId: string
  targetClientId: string
  sourcePanelId: string
  kind: PanelKind
  tabIds: string[]
}

export interface WindowingMergeToMainMessage {
  type: 'merge-to-main'
  sourceClientId: string
  mode: 'tab' | 'panel'
  kind: PanelKind
  tabId?: string
  panel?: WindowingMergePanelPayload
}

export interface WindowingDetachedClosingMessage {
  type: 'detached-closing'
  sourceClientId: string
  tabsByKind: Partial<Record<Extract<PanelKind, 'chat' | 'terminal' | 'filesystem'>, string[]>>
}

/**
 * Broadcast when a drag starts in any window, so other windows can accept
 * the drop even when DataTransfer.getData() is restricted during dragover.
 */
export interface WindowingTabDragPayload {
  sourceClientId: string
  tabId: string
  kind: PanelKind
  sourcePanelId: string
}

export interface WindowingPanelDragPayload {
  sourceClientId: string
  sourcePanelId: string
  kind: PanelKind
  /**
   * When present, the native drag payload only carries this token. The full
   * transferable panel state must be rehydrated from storage before import.
   */
  stateToken?: string
  tabBinding?: LayoutPanelTabBinding
  fileEditorSnapshot?: FileEditorSnapshot
}

export interface WindowingDragStartMessage {
  type: 'drag-start'
  sourceClientId: string
  dragKind: 'tab' | 'panel'
  tabPayload?: WindowingTabDragPayload
  panelPayload?: WindowingPanelDragPayload
}

/**
 * Broadcast when a drag ends (drop or cancel) so other windows can clean up.
 */
export interface WindowingDragEndMessage {
  type: 'drag-end'
  sourceClientId: string
}

export type WindowingMessage =
  | WindowingPanelMovedMessage
  | WindowingTabMovedMessage
  | WindowingMergeToMainMessage
  | WindowingDetachedClosingMessage
  | WindowingDragStartMessage
  | WindowingDragEndMessage

const safeRandomId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`
}

const readSearchParams = (): URLSearchParams => {
  try {
    const search = typeof window !== 'undefined' ? window.location?.search || '' : ''
    return new URLSearchParams(search)
  } catch {
    return new URLSearchParams()
  }
}

const ensureClientId = (): string => {
  try {
    const existing = window.sessionStorage?.getItem(WINDOW_CLIENT_ID_KEY)
    if (existing && existing.trim().length > 0) {
      return existing
    }
    const next = `win-${safeRandomId()}`
    window.sessionStorage?.setItem(WINDOW_CLIENT_ID_KEY, next)
    return next
  } catch {
    return `win-${safeRandomId()}`
  }
}

const readWindowContext = (): RendererWindowContext => {
  const params = readSearchParams()
  const role = params.get('windowRole') === 'detached' ? 'detached' : 'main'
  const detachedStateToken = params.get('detachedStateToken')
  const sourceClientId = params.get('sourceClientId')
  return {
    role,
    detachedStateToken: detachedStateToken && detachedStateToken.trim().length > 0 ? detachedStateToken : null,
    sourceClientId: sourceClientId && sourceClientId.trim().length > 0 ? sourceClientId : null,
    clientId: ensureClientId()
  }
}

export const WINDOW_CONTEXT: RendererWindowContext = readWindowContext()

export const stashDetachedWindowState = (token: string, state: DetachedWindowState): boolean => {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) return false
  try {
    window.localStorage?.setItem(`${DETACHED_STATE_KEY_PREFIX}${normalizedToken}`, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export const consumeDetachedWindowState = (token: string): DetachedWindowState | null => {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) return null
  const key = `${DETACHED_STATE_KEY_PREFIX}${normalizedToken}`
  try {
    const raw = window.localStorage?.getItem(key)
    if (!raw) return null
    window.localStorage?.removeItem(key)
    const parsed = JSON.parse(raw) as Partial<DetachedWindowState>
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.layoutTree || typeof parsed.layoutTree !== 'object') return null
    const sourceClientId = typeof parsed.sourceClientId === 'string' ? parsed.sourceClientId.trim() : ''
    if (!sourceClientId) return null
    const fileEditorSnapshot = normalizeFileEditorSnapshot((parsed as any).fileEditorSnapshot)
    return {
      sourceClientId,
      layoutTree: parsed.layoutTree as LayoutTree,
      createdAt: Number.isFinite(parsed.createdAt) ? Number(parsed.createdAt) : Date.now(),
      ...(fileEditorSnapshot ? { fileEditorSnapshot } : {})
    }
  } catch {
    return null
  }
}

const readLocalStorage = (): Storage | null => {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

const normalizePanelTabBinding = (value: unknown): LayoutPanelTabBinding | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const rawBinding = value as Partial<LayoutPanelTabBinding>
  const tabIds = Array.isArray(rawBinding.tabIds)
    ? rawBinding.tabIds.filter((tabId): tabId is string => typeof tabId === 'string' && tabId.trim().length > 0)
    : []
  const activeTabId =
    typeof rawBinding.activeTabId === 'string' && tabIds.includes(rawBinding.activeTabId)
      ? rawBinding.activeTabId
      : tabIds[0]
  return {
    tabIds,
    ...(activeTabId ? { activeTabId } : {})
  }
}

const normalizePanelDragState = (value: unknown): WindowingPanelDragPayload | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const parsed = value as Partial<WindowingPanelDragPayload>
  const sourceClientId = typeof parsed.sourceClientId === 'string' ? parsed.sourceClientId.trim() : ''
  const sourcePanelId = typeof parsed.sourcePanelId === 'string' ? parsed.sourcePanelId.trim() : ''
  const kind = parsed.kind
  const stateToken = typeof parsed.stateToken === 'string' ? parsed.stateToken.trim() : ''
  if (!sourceClientId || !sourcePanelId) {
    return null
  }
  if (kind !== 'chat' && kind !== 'terminal' && kind !== 'filesystem' && kind !== 'fileEditor') {
    return null
  }
  const tabBinding = normalizePanelTabBinding(parsed.tabBinding)
  const fileEditorSnapshot = normalizeFileEditorSnapshot(parsed.fileEditorSnapshot)
  return {
    sourceClientId,
    sourcePanelId,
    kind,
    ...(stateToken ? { stateToken } : {}),
    ...(tabBinding ? { tabBinding } : {}),
    ...(fileEditorSnapshot ? { fileEditorSnapshot } : {})
  }
}

const getPanelDragStateStorageKey = (token: string): string | null => {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) {
    return null
  }
  return `${PANEL_DRAG_STATE_KEY_PREFIX}${normalizedToken}`
}

/**
 * Electron cross-window native drag sessions are far more reliable when the
 * drag payload stays small. For panels, stash the full transferable state in
 * localStorage and only put a lightweight token into DataTransfer/windowing.
 */
export const stashPanelDragState = (token: string, payload: WindowingPanelDragPayload): boolean => {
  const key = getPanelDragStateStorageKey(token)
  const storage = readLocalStorage()
  const normalizedPayload = normalizePanelDragState(payload)
  if (!key || !storage || !normalizedPayload) {
    return false
  }
  try {
    storage.setItem(key, JSON.stringify(normalizedPayload))
    return true
  } catch {
    return false
  }
}

/**
 * Resolve the full stashed panel drag state for a transport token. This keeps
 * cross-window drag payloads small while preserving the complete panel state.
 */
export const readPanelDragState = (token: string): WindowingPanelDragPayload | null => {
  const key = getPanelDragStateStorageKey(token)
  const storage = readLocalStorage()
  if (!key || !storage) {
    return null
  }
  try {
    const raw = storage.getItem(key)
    return normalizePanelDragState(raw ? JSON.parse(raw) : null)
  } catch {
    return null
  }
}

/**
 * The source window owns the stashed drag state and is responsible for removing
 * it after drag-end or once the target confirms the move.
 */
export const clearPanelDragState = (token: string): void => {
  const key = getPanelDragStateStorageKey(token)
  const storage = readLocalStorage()
  if (!key || !storage) {
    return
  }
  try {
    storage.removeItem(key)
  } catch {
    // ignore cleanup failures
  }
}

/**
 * A channel interface compatible with BroadcastChannel for cross-window messaging.
 * For file:// renderer windows, BroadcastChannel is not reliable because those
 * documents are usually treated as opaque origins. In that case we fall back to
 * localStorage + the storage event, similar to VS Code's renderer-side channel.
 */
export interface WindowingChannel {
  postMessage(message: WindowingMessage): void
  onmessage: ((event: { data: WindowingMessage }) => void) | null
  close(): void
}

const createStorageWindowingChannel = (): WindowingChannel | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = readLocalStorage()
  if (!storage) {
    return null
  }

  let messageHandler: ((event: { data: WindowingMessage }) => void) | null = null
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== WINDOWING_STORAGE_CHANNEL_KEY || !event.newValue) {
      return
    }
    try {
      const payload = JSON.parse(event.newValue) as WindowingMessage
      messageHandler?.({ data: payload })
    } catch {
      // ignore malformed windowing payloads
    }
  }

  window.addEventListener('storage', handleStorage)
  return {
    postMessage(message: WindowingMessage) {
      try {
        storage?.removeItem(WINDOWING_STORAGE_CHANNEL_KEY)
        storage?.setItem(WINDOWING_STORAGE_CHANNEL_KEY, JSON.stringify(message))
      } catch {
        // ignore storage broadcast errors
      }
    },
    get onmessage() {
      return messageHandler
    },
    set onmessage(handler: ((event: { data: WindowingMessage }) => void) | null) {
      messageHandler = handler
    },
    close() {
      window.removeEventListener('storage', handleStorage)
      messageHandler = null
    }
  }
}

export const createWindowingChannel = (): WindowingChannel | null => {
  const isFileProtocol = (() => {
    try {
      return window.location?.protocol === 'file:'
    } catch {
      return false
    }
  })()

  if (!isFileProtocol && typeof BroadcastChannel !== 'undefined') {
    try {
      return new BroadcastChannel(WINDOWING_BROADCAST_CHANNEL) as unknown as WindowingChannel
    } catch {
      return createStorageWindowingChannel()
    }
  }

  return createStorageWindowingChannel()
}
