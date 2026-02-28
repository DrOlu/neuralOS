import { isTerminalTrackedByBackend } from './runtimeRetention'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = async (name: string, fn: () => Promise<void> | void): Promise<void> => {
  await fn()
  console.log(`PASS ${name}`)
}

const installWindowMock = (listImpl: () => Promise<unknown>): void => {
  ;(globalThis as unknown as { window: unknown }).window = {
    gyshell: {
      terminal: {
        list: listImpl
      }
    }
  }
}

const run = async (): Promise<void> => {
  await runCase('returns true when terminal id exists in backend snapshot', async () => {
    installWindowMock(async () => ({
      terminals: [{ id: 'term-a' }, { id: 'term-b' }]
    }))
    const tracked = await isTerminalTrackedByBackend('term-b')
    assertEqual(tracked, true, 'tracked terminal should return true')
  })

  await runCase('returns false when terminal id is absent in backend snapshot', async () => {
    installWindowMock(async () => ({
      terminals: [{ id: 'term-a' }]
    }))
    const tracked = await isTerminalTrackedByBackend('term-c')
    assertEqual(tracked, false, 'missing terminal should return false')
  })

  await runCase('returns false when backend list throws', async () => {
    installWindowMock(async () => {
      throw new Error('list failed')
    })
    const tracked = await isTerminalTrackedByBackend('term-a')
    assertEqual(tracked, false, 'list failure should be treated as not tracked')
  })
}

void run()
  .then(() => {
    console.log('All runtime retention extreme tests passed.')
  })
  .catch((error) => {
    console.error(error)
    throw error
  })
