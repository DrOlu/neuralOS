import { resolveTerminalSize } from './terminalDimensions'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

runCase('uses preferred positive integer dimensions when valid', () => {
  const size = resolveTerminalSize({ cols: 132, rows: 41 }, { cols: 80, rows: 24 })
  assertEqual(size.cols, 132, 'cols should use preferred value')
  assertEqual(size.rows, 41, 'rows should use preferred value')
})

runCase('floors preferred floating dimensions to positive integers', () => {
  const size = resolveTerminalSize({ cols: 119.8, rows: 35.2 }, { cols: 80, rows: 24 })
  assertEqual(size.cols, 119, 'cols should be floored to integer')
  assertEqual(size.rows, 35, 'rows should be floored to integer')
})

runCase('falls back when preferred contains NaN', () => {
  const size = resolveTerminalSize({ cols: Number.NaN, rows: Number.NaN }, { cols: 96, rows: 30 })
  assertEqual(size.cols, 96, 'cols should fallback when preferred is NaN')
  assertEqual(size.rows, 30, 'rows should fallback when preferred is NaN')
})

runCase('falls back to defaults when both preferred and fallback are invalid', () => {
  const size = resolveTerminalSize({ cols: -2, rows: 0 }, { cols: Number.NaN, rows: Infinity })
  assertEqual(size.cols, 80, 'cols should fallback to default')
  assertEqual(size.rows, 24, 'rows should fallback to default')
})

console.log('All terminal dimension extreme tests passed.')
