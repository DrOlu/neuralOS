import { isRuntimeOwnedByUi } from './runtimeOwnership'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

runCase('returns true when no ownership check is provided', () => {
  assertEqual(isRuntimeOwnedByUi(undefined), true, 'missing ownership check should default to true')
})

runCase('returns false when ownership check reports false', () => {
  assertEqual(isRuntimeOwnedByUi(() => false), false, 'false ownership check should dispose runtime')
})

runCase('returns true when ownership check throws', () => {
  assertEqual(
    isRuntimeOwnedByUi(() => {
      throw new Error('ownership check failed')
    }),
    true,
    'ownership check failures should fail open to avoid accidental disposal'
  )
})

console.log('All runtime ownership extreme tests passed.')
