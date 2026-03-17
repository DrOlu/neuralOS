const DEFAULT_COMMAND_DRAFT_SHORTCUT = 'Mod+O'

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift'])
const SHORTCUT_MODIFIERS = new Set(['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'])
const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Escape: 'Esc',
  Esc: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  '+': 'Plus'
}

type ParsedShortcut = {
  modifiers: Set<string>
  key: string
}

function isMacPlatform(): boolean {
  const platform = String((window as any)?.gyshell?.system?.platform || '').toLowerCase()
  if (platform) {
    return platform === 'darwin'
  }
  const userAgent = navigator.userAgent.toLowerCase()
  return userAgent.includes('mac') || userAgent.includes('darwin')
}

function normalizeShortcutKey(rawKey: string): string | null {
  const key = String(rawKey || '').trim()
  if (!key) {
    return null
  }
  if (KEY_ALIASES[key]) {
    return KEY_ALIASES[key]
  }
  if (/^f\d{1,2}$/i.test(key)) {
    return key.toUpperCase()
  }
  if (key.length === 1) {
    return /[a-z]/i.test(key) ? key.toUpperCase() : key
  }
  return key[0].toUpperCase() + key.slice(1)
}

function serializeShortcut(modifiers: Set<string>, key: string): string {
  const orderedModifiers = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'].filter((item) =>
    modifiers.has(item)
  )
  return [...orderedModifiers, key].join('+')
}

function parseShortcut(rawShortcut: string): ParsedShortcut | null {
  const parts = String(rawShortcut || '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return null
  }

  const modifiers = new Set<string>()
  for (const rawPart of parts.slice(0, -1)) {
    const part = rawPart[0].toUpperCase() + rawPart.slice(1)
    if (!SHORTCUT_MODIFIERS.has(part) || modifiers.has(part)) {
      return null
    }
    modifiers.add(part)
  }

  const key = normalizeShortcutKey(parts[parts.length - 1])
  if (!key) {
    return null
  }
  return { modifiers, key }
}

function resolveModifierState(event: KeyboardEvent): Set<string> {
  const modifiers = new Set<string>()
  const isMac = isMacPlatform()
  if (isMac ? event.metaKey : event.ctrlKey) {
    modifiers.add('Mod')
  }
  if (isMac && event.ctrlKey) {
    modifiers.add('Ctrl')
  }
  if (!isMac && event.metaKey) {
    modifiers.add('Meta')
  }
  if (event.altKey) {
    modifiers.add('Alt')
  }
  if (event.shiftKey) {
    modifiers.add('Shift')
  }
  return modifiers
}

export function getDefaultCommandDraftShortcut(): string {
  return DEFAULT_COMMAND_DRAFT_SHORTCUT
}

export function resolveCommandDraftShortcut(rawShortcut: string | null | undefined): string {
  const shortcut = String(rawShortcut || '').trim()
  if (!shortcut) {
    return ''
  }
  const parsed = parseShortcut(shortcut)
  if (!parsed) {
    return DEFAULT_COMMAND_DRAFT_SHORTCUT
  }
  return serializeShortcut(parsed.modifiers, parsed.key)
}

export function formatCommandDraftShortcut(
  rawShortcut: string | null | undefined,
  disabledLabel: string
): string {
  const shortcut = resolveCommandDraftShortcut(rawShortcut)
  if (!shortcut) {
    return disabledLabel
  }
  const parsed = parseShortcut(shortcut)
  if (!parsed) {
    return disabledLabel
  }

  const isMac = isMacPlatform()
  const labels = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift']
    .filter((item) => parsed.modifiers.has(item))
    .map((item) => {
      if (item === 'Mod') {
        return isMac ? 'Cmd' : 'Ctrl'
      }
      return item
    })

  return [...labels, parsed.key].join('+')
}

export function captureCommandDraftShortcut(event: KeyboardEvent): string | null {
  if (event.key === 'Escape') {
    return ''
  }
  if (MODIFIER_KEYS.has(event.key)) {
    return null
  }
  const key = normalizeShortcutKey(event.key)
  if (!key) {
    return null
  }
  return serializeShortcut(resolveModifierState(event), key)
}

export function matchesCommandDraftShortcut(
  event: KeyboardEvent,
  rawShortcut: string | null | undefined
): boolean {
  const shortcut = resolveCommandDraftShortcut(rawShortcut)
  if (!shortcut) {
    return false
  }
  const parsed = parseShortcut(shortcut)
  const key = normalizeShortcutKey(event.key)
  if (!parsed || !key || parsed.key !== key) {
    return false
  }

  const eventModifiers = resolveModifierState(event)
  const expected = serializeShortcut(parsed.modifiers, parsed.key)
  const actual = serializeShortcut(eventModifiers, key)
  return expected === actual
}
