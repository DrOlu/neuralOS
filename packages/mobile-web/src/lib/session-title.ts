import { normalizeDisplayText } from '../session-store'

function truncateText(input: string, limit: number): string {
  if (!input) return 'Untitled'
  if (input.length <= limit) return input
  return `${input.slice(0, Math.max(1, limit - 3))}...`
}

export function normalizeSessionTitleText(title: string): string {
  const normalized = normalizeDisplayText(title || '').replace(/\s+/g, ' ').trim()
  return normalized || 'Untitled'
}

export function formatTopBarSessionTitle(title: string): string {
  return truncateText(normalizeSessionTitleText(title), 20)
}

export function formatSessionListTitle(title: string): string {
  return truncateText(normalizeSessionTitleText(title), 36)
}
