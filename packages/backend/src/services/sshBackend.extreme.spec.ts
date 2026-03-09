import { SSHBackend } from './SSHBackend'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const assertCondition = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

const runCase = async (name: string, fn: () => Promise<void> | void): Promise<void> => {
  await fn()
  console.log(`PASS ${name}`)
}

const createSession = () =>
  ({
    client: {},
    dataCallbacks: new Set(),
    exitCallbacks: new Set(),
    isInitializing: true,
    buffer: '',
    oscBuffer: '',
    forwardServers: [],
    remoteForwards: [],
    remoteForwardHandlerInstalled: false,
    initializationState: 'initializing',
  }) as any

const run = async (): Promise<void> => {
  await runCase('getSystemInfo schedules a backend retry when remote os is not ready yet', async () => {
    const backend = new SSHBackend()
    const session = createSession()
    ;(backend as any).sessions.set('pty-a', session)
    const originalSetTimeout = globalThis.setTimeout
    const originalClearTimeout = globalThis.clearTimeout
    const scheduled: Array<() => void> = []

    ;(globalThis as any).setTimeout = (callback: () => void) => {
      scheduled.push(callback)
      return { fake: true } as any
    }
    ;(globalThis as any).clearTimeout = () => {}

    let remoteOs: 'windows' | undefined
    let execCallCount = 0
    ;(backend as any).waitForRemoteOs = async () => remoteOs
    ;(backend as any).execCollect = async () => {
      execCallCount += 1
      return {
        stdout: JSON.stringify({
          Version: '10.0.26200',
          CSName: 'QUIET-HOST',
          Arch: 'x64',
        }),
        stderr: '',
      }
    }

    try {
      const info = await backend.getSystemInfo('pty-a')

      assertEqual(info, undefined, 'system info should stay undefined while remote os is unresolved')
      assertEqual(session.systemInfo, undefined, 'unresolved system info should not be cached')
      assertEqual(scheduled.length, 1, 'backend should schedule an independent retry after a miss')

      remoteOs = 'windows'
      scheduled[0]?.()
      await Promise.resolve()
      await Promise.resolve()

      assertEqual(execCallCount, 1, 'scheduled retry should probe system info without more terminal output')
      assertEqual(session.systemInfo?.hostname, 'QUIET-HOST', 'scheduled retry should eventually populate system info')
    } finally {
      ;(globalThis as any).setTimeout = originalSetTimeout
      ;(globalThis as any).clearTimeout = originalClearTimeout
    }
  })

  await runCase('getSystemInfo retries after a temporary windows collection failure', async () => {
    const backend = new SSHBackend()
    const session = createSession()
    session.initializationState = 'ready'
    session.remoteOs = 'windows'
    ;(backend as any).sessions.set('pty-b', session)

    let callCount = 0
    ;(backend as any).execCollect = async () => {
      callCount += 1
      if (callCount === 1) {
        throw new Error('temporary failure')
      }
      return {
        stdout: JSON.stringify({
          Version: '10.0.26200',
          CSName: 'TUOTUO-SERVER',
          Arch: 'x64',
        }),
        stderr: '',
      }
    }

    const first = await backend.getSystemInfo('pty-b')
    const second = await backend.getSystemInfo('pty-b')

    assertEqual(first, undefined, 'failed collections should not cache fallback unknown data')
    assertCondition(second !== undefined, 'subsequent calls should retry and return real system info')
    assertEqual(second.hostname, 'TUOTUO-SERVER', 'retried collection should parse hostname')
    assertEqual(session.systemInfo?.hostname, 'TUOTUO-SERVER', 'successful retry should populate the cache')
  })
}

void run().catch((error) => {
  console.error(error)
  process.exit(1)
})
