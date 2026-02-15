import type { GatewayTerminalSummary, SkillSummary } from '../types'

export interface MentionOption {
  key: string
  label: string
  insertText: string
  description: string
  token: string
  kind: 'skill' | 'terminal'
}

export interface MentionContext {
  start: number
  end: number
  query: string
}

export function normalizeTerminalMentionBase(title: string): string {
  const normalized = String(title || '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .toUpperCase()
  return normalized || 'TERMINAL'
}

export function buildTerminalMentionAliases(terminals: GatewayTerminalSummary[]): MentionOption[] {
  const counts = new Map<string, number>()

  return terminals.map((terminal) => {
    const base = normalizeTerminalMentionBase(terminal.title)
    const index = (counts.get(base) || 0) + 1
    counts.set(base, index)
    const alias = index === 1 ? base : `${base}_${index}`
    const mention = `@${alias}`

    return {
      key: `terminal:${terminal.id}`,
      label: mention,
      insertText: mention,
      description: `${terminal.title} (${terminal.type})`,
      token: `[MENTION_TAB:#${terminal.title}##${terminal.id}#]`,
      kind: 'terminal'
    }
  })
}

export function buildSkillMentionAliases(skills: SkillSummary[]): MentionOption[] {
  return skills
    .filter((skill) => skill.enabled !== false)
    .map((skill) => ({
      key: `skill:${skill.name}`,
      label: `@${skill.name}`,
      insertText: `@${skill.name}`,
      description: skill.description || 'Skill',
      token: `[MENTION_SKILL:#${skill.name}#]`,
      kind: 'skill' as const
    }))
}

export function parseMentionContext(text: string, cursorOffset: number): MentionContext | null {
  if (!text) return null

  const safeOffset = Math.max(0, Math.min(cursorOffset, text.length))
  const head = text.slice(0, safeOffset)
  if (!head) return null

  let cursor = head.length - 1
  while (cursor >= 0 && isMentionQueryChar(head[cursor])) {
    cursor -= 1
  }

  if (cursor < 0 || head[cursor] !== '@') return null
  if (cursor > 0 && isMentionQueryChar(head[cursor - 1])) return null

  const query = head.slice(cursor + 1)
  return {
    start: safeOffset - query.length - 1,
    end: safeOffset,
    query
  }
}

export function getMentionSuggestions(
  text: string,
  cursorOffset: number,
  terminals: GatewayTerminalSummary[],
  skills: SkillSummary[]
): {
  context: MentionContext | null
  options: MentionOption[]
} {
  const context = parseMentionContext(text, cursorOffset)
  if (!context) return { context: null, options: [] }

  const query = context.query.toLowerCase()
  const options = [...buildSkillMentionAliases(skills), ...buildTerminalMentionAliases(terminals)]
    .filter((item) => {
      return item.label.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
    })
    .sort((left, right) => {
      const a = left.label.toLowerCase()
      const b = right.label.toLowerCase()
      if (a === `@${query}` && b !== `@${query}`) return -1
      if (b === `@${query}` && a !== `@${query}`) return 1
      const aStarts = a.startsWith(`@${query}`)
      const bStarts = b.startsWith(`@${query}`)
      if (aStarts && !bStarts) return -1
      if (bStarts && !aStarts) return 1
      return a.localeCompare(b)
    })
    .slice(0, 8)

  return { context, options }
}

export function applyMentionToInput(
  input: string,
  context: MentionContext,
  option: MentionOption
): {
  value: string
  cursor: number
} {
  const before = input.slice(0, context.start)
  const after = input.slice(context.end)
  const insert = `${option.insertText} `
  const value = `${before}${insert}${after}`
  return {
    value,
    cursor: before.length + insert.length
  }
}

export function encodeMentions(input: string, terminals: GatewayTerminalSummary[], skills: SkillSummary[]): string {
  let output = input

  const terminalMap = new Map(terminals.map((item) => [item.id.toLowerCase(), item]))
  output = output.replace(/@terminal:([A-Za-z0-9_.:-]+)/g, (full, rawId: string) => {
    const terminal = terminalMap.get(rawId.toLowerCase())
    if (!terminal) return full
    return `[MENTION_TAB:#${terminal.title}##${terminal.id}#]`
  })

  const aliasMap = new Map(
    [...buildSkillMentionAliases(skills), ...buildTerminalMentionAliases(terminals)].map((item) => [
      item.insertText.toLowerCase(),
      item.token
    ])
  )

  output = output.replace(/@[A-Za-z0-9_.-]+/g, (full) => aliasMap.get(full.toLowerCase()) ?? full)

  return output
}

export function consumeMentionBackspace(
  input: string,
  selectionStart: number,
  selectionEnd: number
): {
  value: string
  cursor: number
} | null {
  if (selectionStart !== selectionEnd) return null
  if (selectionStart <= 0) return null

  const cursor = selectionStart
  const before = input.slice(0, cursor)
  const trailingWhitespace = before.match(/\s+$/)?.[0] ?? ''
  const checkpoints = [cursor]
  if (trailingWhitespace.length > 0) {
    checkpoints.push(cursor - trailingWhitespace.length)
  }

  for (const checkpoint of checkpoints) {
    const head = input.slice(0, checkpoint)
    const match = head.match(/(^|\s)(@[A-Za-z0-9_.-]+)$/)
    if (!match) continue
    const mention = match[2]
    if (!mention) continue

    const mentionStart = checkpoint - mention.length
    const nextValue = `${input.slice(0, mentionStart)}${input.slice(cursor)}`
    return {
      value: nextValue,
      cursor: mentionStart
    }
  }

  return null
}

function isMentionQueryChar(char: string | undefined): boolean {
  if (!char) return false
  return /[A-Za-z0-9_.:-]/.test(char)
}
