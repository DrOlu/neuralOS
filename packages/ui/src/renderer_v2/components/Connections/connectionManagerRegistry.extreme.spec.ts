import {
  CONNECTION_MANAGER_SECTIONS,
  getConnectionManagerSectionDefinition,
} from './connectionManagerRegistry'

const assertCondition = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(
      `${message}. expected=${String(expected)} actual=${String(actual)}`
    )
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

runCase('connection manager sections are registered in stable order', () => {
  assertEqual(
    JSON.stringify(CONNECTION_MANAGER_SECTIONS.map((item) => item.id)),
    JSON.stringify(['ssh', 'proxies', 'tunnels']),
    'connection manager sections should stay in the expected navigation order',
  )
})

runCase('ssh section creates a valid default draft', () => {
  const draft = getConnectionManagerSectionDefinition('ssh').createDraft()
  assertCondition(String(draft.id || '').startsWith('ssh-'), 'ssh drafts should use ssh id prefix')
  assertEqual(draft.port, 22, 'ssh drafts should default to port 22')
  assertEqual(draft.authMethod, 'password', 'ssh drafts should default to password auth')
})

runCase('proxy section creates a valid default draft', () => {
  const draft = getConnectionManagerSectionDefinition('proxies').createDraft()
  assertCondition(String(draft.id || '').startsWith('proxy-'), 'proxy drafts should use proxy id prefix')
  assertEqual(draft.port, 1080, 'proxy drafts should default to port 1080')
  assertEqual(draft.type, 'socks5', 'proxy drafts should default to socks5')
})

runCase('tunnel section creates a valid default draft', () => {
  const draft = getConnectionManagerSectionDefinition('tunnels').createDraft()
  assertCondition(String(draft.id || '').startsWith('tunnel-'), 'tunnel drafts should use tunnel id prefix')
  assertEqual(draft.port, 8080, 'tunnel drafts should default to port 8080')
  assertEqual(draft.type, 'Local', 'tunnel drafts should default to local forwarding')
})

runCase('section registry routes to matching settings entries', () => {
  const store = {
    settings: {
      connections: {
        ssh: [{ id: 'ssh-a' }],
        proxies: [{ id: 'proxy-a' }],
        tunnels: [{ id: 'tunnel-a' }],
      },
    },
  } as any

  assertEqual(
    getConnectionManagerSectionDefinition('ssh').getEntries(store)[0]?.id,
    'ssh-a',
    'ssh section should resolve ssh entries from settings',
  )
  assertEqual(
    getConnectionManagerSectionDefinition('proxies').getEntries(store)[0]?.id,
    'proxy-a',
    'proxy section should resolve proxy entries from settings',
  )
  assertEqual(
    getConnectionManagerSectionDefinition('tunnels').getEntries(store)[0]?.id,
    'tunnel-a',
    'tunnel section should resolve tunnel entries from settings',
  )
})

console.log('All connection manager registry extreme tests passed.')

