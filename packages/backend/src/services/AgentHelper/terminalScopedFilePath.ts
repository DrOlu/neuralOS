export interface TerminalScopedFilePath {
  terminalId: string
  filePath: string
}

const TERMINAL_SCOPED_FILE_PATH_REGEX = /^@terminal\(([^)]+)\):(.*)$/

export const parseTerminalScopedFilePath = (rawPath: string): TerminalScopedFilePath | null => {
  const normalized = String(rawPath || '').trim()
  if (!normalized) return null
  const matched = normalized.match(TERMINAL_SCOPED_FILE_PATH_REGEX)
  if (!matched) return null
  const encodedTerminalId = String(matched[1] || '').trim()
  const filePath = String(matched[2] || '').trim()
  if (!encodedTerminalId || !filePath) return null
  try {
    const terminalId = decodeURIComponent(encodedTerminalId)
    if (!terminalId) return null
    return {
      terminalId,
      filePath
    }
  } catch {
    return null
  }
}
