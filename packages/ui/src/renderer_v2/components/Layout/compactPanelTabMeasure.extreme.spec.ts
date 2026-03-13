import { buildCompactPanelTabMeasureSignature } from './compactPanelTabMeasure'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const assertNotEqual = <T>(left: T, right: T, message: string): void => {
  if (left === right) {
    throw new Error(`${message}. both=${String(left)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

runCase('equivalent compact tab layouts keep the same measure signature across rerenders', () => {
  const first = buildCompactPanelTabMeasureSignature({
    panelKind: 'chat',
    resolvedValue: 'chat-a',
    activeLabel: '@mac help me',
    activeMeasureKey: '@mac help me',
    activeLeadingMeasureKey: 'no-leading',
    activeTrailingMeasureKey: 'no-trailing',
    hasActiveLeading: false,
    hasActiveTrailing: false,
    hasTrailingActionRail: true,
    entries: [
      {
        value: 'chat-a',
        label: '@mac help me',
        hasLeading: false,
        hasTrailing: false,
        hasClose: true,
      },
      {
        value: 'chat-b',
        label: '@win inspect this',
        hasLeading: false,
        hasTrailing: false,
        hasClose: true,
      },
    ],
  })

  const second = buildCompactPanelTabMeasureSignature({
    panelKind: 'chat',
    resolvedValue: 'chat-a',
    activeLabel: '@mac help me',
    activeMeasureKey: '@mac help me',
    activeLeadingMeasureKey: 'no-leading',
    activeTrailingMeasureKey: 'no-trailing',
    hasActiveLeading: false,
    hasActiveTrailing: false,
    hasTrailingActionRail: true,
    entries: [
      {
        value: 'chat-a',
        label: '@mac help me',
        hasLeading: false,
        hasTrailing: false,
        hasClose: true,
      },
      {
        value: 'chat-b',
        label: '@win inspect this',
        hasLeading: false,
        hasTrailing: false,
        hasClose: true,
      },
    ],
  })

  assertEqual(
    first,
    second,
    'layout-equivalent compact tabs should not force a new measure signature on rerender',
  )
})

runCase('width-relevant compact tab changes produce a new measure signature', () => {
  const local = buildCompactPanelTabMeasureSignature({
    panelKind: 'terminal',
    resolvedValue: 'term-a',
    activeLabel: 'LOCAL',
    activeMeasureKey: 'LOCAL',
    activeLeadingMeasureKey: 'local',
    activeTrailingMeasureKey: 'ready',
    hasActiveLeading: true,
    hasActiveTrailing: true,
    hasTrailingActionRail: true,
    entries: [
      {
        value: 'term-a',
        label: 'LOCAL',
        leadingMeasureKey: 'local',
        trailingMeasureKey: 'ready',
        hasLeading: true,
        hasTrailing: true,
        hasClose: true,
      },
    ],
  })

  const remote = buildCompactPanelTabMeasureSignature({
    panelKind: 'terminal',
    resolvedValue: 'term-a',
    activeLabel: 'LOCAL',
    activeMeasureKey: 'LOCAL',
    activeLeadingMeasureKey: 'remote',
    activeTrailingMeasureKey: 'ready',
    hasActiveLeading: true,
    hasActiveTrailing: true,
    hasTrailingActionRail: true,
    entries: [
      {
        value: 'term-a',
        label: 'LOCAL',
        leadingMeasureKey: 'remote',
        trailingMeasureKey: 'ready',
        hasLeading: true,
        hasTrailing: true,
        hasClose: true,
      },
    ],
  })

  assertNotEqual(
    local,
    remote,
    'icon-kind changes should invalidate compact width measurements when callers provide measure keys',
  )
})
