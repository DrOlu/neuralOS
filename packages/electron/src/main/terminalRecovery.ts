export type TerminalRecoveryReason = 'resume' | 'unlock-screen' | 'display-metrics-changed'

export interface TerminalRecoveryWebContentsTarget {
  isDestroyed: () => boolean
  send: (channel: string, payload: { reason: TerminalRecoveryReason }) => void
}

export interface TerminalRecoveryWindowTarget {
  isDestroyed: () => boolean
  webContents: TerminalRecoveryWebContentsTarget
}

const DISPLAY_METRICS_RECOVERY_KEYS = new Set(['bounds', 'workArea', 'scaleFactor', 'rotation'])

export const isDisplayMetricsRecoveryRelevant = (changedMetrics: readonly string[]): boolean =>
  changedMetrics.some((metric) => DISPLAY_METRICS_RECOVERY_KEYS.has(metric))

export const broadcastTerminalRecoveryHint = (
  windows: Iterable<TerminalRecoveryWindowTarget>,
  reason: TerminalRecoveryReason
): number => {
  let broadcastCount = 0
  for (const win of windows) {
    if (!win || win.isDestroyed()) {
      continue
    }
    const webContents = win.webContents
    if (!webContents || webContents.isDestroyed()) {
      continue
    }
    webContents.send('terminal:recoveryHint', { reason })
    broadcastCount += 1
  }
  return broadcastCount
}
