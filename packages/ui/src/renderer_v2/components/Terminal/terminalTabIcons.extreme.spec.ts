import { Laptop, Server, SquareTerminal } from 'lucide-react'
import { resolveTerminalTabIcon } from './terminalTabIcons'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

runCase('remote terminal tabs use the server icon', () => {
  assertEqual(
    resolveTerminalTabIcon('remote'),
    Server,
    'remote terminal tabs should keep the server icon in every layout mode',
  )
})

runCase('local terminal tabs use the laptop icon', () => {
  assertEqual(
    resolveTerminalTabIcon('local'),
    Laptop,
    'local terminal tabs should keep the laptop icon in every layout mode',
  )
})

runCase('generic terminal tabs use the square terminal icon', () => {
  assertEqual(
    resolveTerminalTabIcon('generic'),
    SquareTerminal,
    'generic terminal tabs should keep the square terminal icon in every layout mode',
  )
})
