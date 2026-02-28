export interface TerminalSizeInput {
  cols?: number | null
  rows?: number | null
}

export interface TerminalSize {
  cols: number
  rows: number
}

const DEFAULT_TERMINAL_SIZE: TerminalSize = {
  cols: 80,
  rows: 24
}

const toPositiveInt = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  if (value <= 0) return null
  return Math.max(1, Math.floor(value))
}

export const resolveTerminalSize = (
  preferred?: TerminalSizeInput | null,
  fallback?: TerminalSizeInput | null
): TerminalSize => {
  const resolvedCols = toPositiveInt(preferred?.cols) ?? toPositiveInt(fallback?.cols) ?? DEFAULT_TERMINAL_SIZE.cols
  const resolvedRows = toPositiveInt(preferred?.rows) ?? toPositiveInt(fallback?.rows) ?? DEFAULT_TERMINAL_SIZE.rows
  return {
    cols: resolvedCols,
    rows: resolvedRows
  }
}
