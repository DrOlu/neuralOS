import { MonitorWindowRegistry, type MonitorWindowTarget } from './MonitorWindowRegistry'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

const createTarget = (id: number) => {
  const sent: Array<{ channel: string; data: unknown }> = []
  let destroyed = false
  let onDestroyed: (() => void) | null = null
  const target: MonitorWindowTarget = {
    id,
    isDestroyed: () => destroyed,
    send: (channel, data) => {
      sent.push({ channel, data })
    },
    once: (_event, listener) => {
      onDestroyed = listener
    },
  }

  return {
    target,
    sent,
    destroy: () => {
      destroyed = true
      onDestroyed?.()
    },
  }
}

runCase('retain is idempotent per window and destroy releases retained terminals', () => {
  const starts: Array<{ terminalId: string; ownerId: string }> = []
  const stops: Array<{ terminalId: string; ownerId: string }> = []
  const registry = new MonitorWindowRegistry({
    start: (terminalId, ownerId) => {
      starts.push({ terminalId, ownerId })
    },
    stop: (terminalId, ownerId) => {
      stops.push({ terminalId, ownerId })
    },
  })

  const windowA = createTarget(11)
  registry.retain(windowA.target, 'term-a')
  registry.retain(windowA.target, 'term-a')
  registry.retain(windowA.target, 'term-b')

  assertEqual(starts.length, 2, 'duplicate retain calls from the same window should not double-start')

  windowA.destroy()
  assertEqual(stops.length, 2, 'destroy should release every retained terminal exactly once')
  assertEqual(stops[0].ownerId, 'window:11', 'owner id should be scoped to the destroyed window')
})

runCase('publish only fans snapshots out to subscribed windows', () => {
  const registry = new MonitorWindowRegistry({
    start: () => {},
    stop: () => {},
  })

  const windowA = createTarget(21)
  const windowB = createTarget(22)
  registry.subscribe(windowA.target, 'term-a')
  registry.subscribe(windowB.target, 'term-b')

  registry.publish('monitor:snapshot', { terminalId: 'term-a', cpu: { usagePercent: 42 } })

  assertEqual(windowA.sent.length, 1, 'subscribed window should receive matching snapshots')
  assertEqual(windowB.sent.length, 0, 'unsubscribed windows should not receive unrelated snapshots')
})
