import {
  broadcastTerminalRecoveryHint,
  isDisplayMetricsRecoveryRelevant,
  type TerminalRecoveryReason,
  type TerminalRecoveryWindowTarget
} from './terminalRecovery'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

const createWindowTarget = (options?: {
  destroyed?: boolean
  webContentsDestroyed?: boolean
}) => {
  const sent: Array<{ channel: string; payload: { reason: TerminalRecoveryReason } }> = []
  const target: TerminalRecoveryWindowTarget = {
    isDestroyed: () => options?.destroyed === true,
    webContents: {
      isDestroyed: () => options?.webContentsDestroyed === true,
      send: (channel, payload) => {
        sent.push({ channel, payload })
      }
    }
  }
  return {
    target,
    sent
  }
}

runCase('broadcastTerminalRecoveryHint only targets live windows with live webContents', () => {
  const active = createWindowTarget()
  const destroyedWindow = createWindowTarget({ destroyed: true })
  const destroyedWebContents = createWindowTarget({ webContentsDestroyed: true })

  const count = broadcastTerminalRecoveryHint(
    [active.target, destroyedWindow.target, destroyedWebContents.target],
    'resume'
  )

  assertEqual(count, 1, 'only one live window should receive the recovery hint')
  assertEqual(active.sent.length, 1, 'live window should receive exactly one recovery hint')
  assertEqual(active.sent[0]?.channel, 'terminal:recoveryHint', 'recovery hint channel should match')
  assertEqual(active.sent[0]?.payload.reason, 'resume', 'recovery hint reason should be preserved')
})

runCase('isDisplayMetricsRecoveryRelevant only reacts to geometry and scale changes', () => {
  assertEqual(
    isDisplayMetricsRecoveryRelevant(['scaleFactor']),
    true,
    'scale factor changes should trigger terminal recovery'
  )
  assertEqual(
    isDisplayMetricsRecoveryRelevant(['bounds']),
    true,
    'display bounds changes should trigger terminal recovery'
  )
  assertEqual(
    isDisplayMetricsRecoveryRelevant(['colorSpace']),
    false,
    'pure color space changes should not trigger terminal recovery'
  )
})

console.log('All terminal recovery extreme tests passed.')
