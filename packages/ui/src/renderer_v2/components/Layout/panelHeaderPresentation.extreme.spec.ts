import {
  resolveFilesystemToolbarMode,
  resolvePanelTabBarMode
} from './panelHeaderPresentation'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

runCase('terminal tabs keep strip mode on roomy panels', () => {
  assertEqual(
    resolvePanelTabBarMode('terminal', 520, 3),
    'strip',
    'wide terminal headers should stay in strip mode'
  )
})

runCase('terminal tabs collapse to select mode on narrow headers', () => {
  assertEqual(
    resolvePanelTabBarMode('terminal', 196, 3),
    'select',
    'narrow terminal headers should switch to select mode'
  )
})

runCase('chat tabs stay in strip mode until the hard compact width is crossed', () => {
  assertEqual(
    resolvePanelTabBarMode('chat', 361, 3),
    'strip',
    'chat headers should ignore tab density above the hard compact threshold'
  )
})

runCase('filesystem tabs keep strip mode when there is only one tab', () => {
  assertEqual(
    resolvePanelTabBarMode('filesystem', 220, 1),
    'strip',
    'single filesystem tabs should remain direct-access tabs'
  )
})

runCase('monitor tabs collapse only when the hard compact width is crossed', () => {
  assertEqual(
    resolvePanelTabBarMode('monitor', 188, 4),
    'select',
    'monitor headers should switch modes only at the hard compact threshold'
  )
})

runCase('expanded display mode forces strip tabs even on narrow headers', () => {
  assertEqual(
    resolvePanelTabBarMode('terminal', 180, 4, 'expanded'),
    'strip',
    'expanded mode should keep the horizontal strip regardless of panel width'
  )
})

runCase('select display mode forces select tabs even for a single tab', () => {
  assertEqual(
    resolvePanelTabBarMode('filesystem', 640, 1, 'select'),
    'select',
    'select mode should force the compact selector regardless of panel width'
  )
})

runCase('filesystem toolbar stays inline on medium and large widths', () => {
  assertEqual(
    resolveFilesystemToolbarMode(520),
    'inline',
    'roomy filesystem toolbars should stay single-row'
  )
})

runCase('filesystem toolbar stacks actions below the path row on narrow widths', () => {
  assertEqual(
    resolveFilesystemToolbarMode(180),
    'stacked',
    'narrow filesystem toolbars should move action buttons below the path field'
  )
})
