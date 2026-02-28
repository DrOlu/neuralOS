import { AppStore } from './AppStore'
import { ChatStore } from './ChatStore'
import type { LayoutTree } from '../layout'

const assertCondition = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = async (name: string, fn: () => Promise<void> | void): Promise<void> => {
  await fn()
  console.log(`PASS ${name}`)
}

const buildPersistedTree = (options?: {
  focusedPanelId?: string
}): LayoutTree => ({
  schemaVersion: 2,
  root: {
    type: 'split',
    id: 'root',
    direction: 'horizontal',
    children: [
      { type: 'panel', id: 'node-chat-a', panel: { id: 'panel-chat-a', kind: 'chat' } },
      { type: 'panel', id: 'node-chat-b', panel: { id: 'panel-chat-b', kind: 'chat' } },
      { type: 'panel', id: 'node-terminal', panel: { id: 'panel-terminal', kind: 'terminal' } }
    ],
    sizes: [34, 33, 33]
  },
  focusedPanelId: options?.focusedPanelId || 'panel-chat-b',
  panelTabs: {
    'panel-chat-a': {
      tabIds: ['chat-a'],
      activeTabId: 'chat-a'
    },
    'panel-chat-b': {
      tabIds: ['chat-b', 'chat-c'],
      activeTabId: 'chat-c'
    },
    'panel-terminal': {
      tabIds: ['term-a'],
      activeTabId: 'term-a'
    }
  }
})

const installBootstrapWindowMock = (layoutTree: LayoutTree): void => {
  const versionPayload = {
    status: 'up-to-date',
    currentVersion: '1.0.0',
    latestVersion: '1.0.0'
  }

  ;(globalThis as unknown as { document: unknown }).document = {
    documentElement: {
      style: {
        setProperty: () => {}
      }
    }
  }

  ;(globalThis as unknown as { window: unknown }).window = {
    gyshell: {
      settings: {
        get: async () => ({
          themeId: 'gyshell-dark',
          language: 'en',
          layout: {
            v2: layoutTree
          }
        }),
        set: async () => {}
      },
      uiSettings: {
        get: async () => ({})
      },
      themes: {
        getCustom: async () => []
      },
      agent: {
        onUiUpdate: () => {}
      },
      terminal: {
        onExit: () => {},
        onTabsUpdated: () => {},
        list: async () => ({
          terminals: [
            {
              id: 'term-a',
              title: 'Local',
              type: 'local',
              cols: 80,
              rows: 24,
              runtimeState: 'ready'
            }
          ]
        })
      },
      tools: {
        onMcpUpdated: () => {},
        onBuiltInUpdated: () => {}
      },
      skills: {
        onUpdated: () => {}
      },
      memory: {
        get: async () => ({
          filePath: '',
          content: ''
        })
      },
      accessTokens: {
        list: async () => []
      },
      version: {
        getState: async () => versionPayload,
        check: async () => versionPayload
      }
    }
  }
}

const run = async (): Promise<void> => {
  await runCase('collectPersistedChatInventoryState preserves focused chat active tab', async () => {
    const store = new AppStore()
    const layoutTree = buildPersistedTree({
      focusedPanelId: 'panel-chat-b'
    })

    const state = (store as any).collectPersistedChatInventoryState({ v2: layoutTree })
    assertEqual(
      JSON.stringify(state.tabIds),
      JSON.stringify(['chat-a', 'chat-b', 'chat-c']),
      'chat tab ids should preserve persisted ordering by panel binding'
    )
    assertEqual(
      state.preferredActiveTabId,
      'chat-c',
      'focused chat panel active tab should be restored as preferred active tab'
    )
  })

  await runCase('collectPersistedChatInventoryState falls back to first available active chat tab', async () => {
    const store = new AppStore()
    const layoutTree = buildPersistedTree({
      focusedPanelId: 'panel-terminal'
    })

    const state = (store as any).collectPersistedChatInventoryState({ v2: layoutTree })
    assertEqual(
      state.preferredActiveTabId,
      'chat-a',
      'first available active chat tab should be used when focused panel is not chat'
    )
  })

  await runCase('ChatStore hydration honors preferred active session id', async () => {
    const chatStore = new ChatStore()
    chatStore.hydrateSessionInventoryFromLayout(['chat-a', 'chat-b', 'chat-c'], 'chat-c')
    assertEqual(chatStore.activeSessionId, 'chat-c', 'preferred active chat session should win over default first tab fallback')
  })

  await runCase('AppStore bootstrap passes preferred active chat id into hydration', async () => {
    const layoutTree = buildPersistedTree({
      focusedPanelId: 'panel-chat-b'
    })
    installBootstrapWindowMock(layoutTree)

    const store = new AppStore()
    ;(store.layout as any).bootstrap = () => {}
    ;(store.layout as any).syncPanelBindings = () => {}
    ;(store as any).loadTools = async () => {}
    ;(store as any).loadSkills = async () => {}
    ;(store as any).loadMemory = async () => {}
    ;(store as any).loadCommandPolicyLists = async () => {}
    ;(store as any).loadAccessTokens = async () => {}
    ;(store as any).loadVersionState = async () => {}
    ;(store as any).checkVersion = async () => {}

    const originalHydrate = store.chat.hydrateSessionInventoryFromLayout.bind(store.chat)
    let capturedHydrationArgs: { tabIds: string[]; preferredActiveSessionId: string | null } | null = null
    store.chat.hydrateSessionInventoryFromLayout = ((tabIds: string[], preferredActiveSessionId?: string | null) => {
      capturedHydrationArgs = {
        tabIds: [...tabIds],
        preferredActiveSessionId: preferredActiveSessionId ?? null
      }
      originalHydrate(tabIds, preferredActiveSessionId)
    }) as ChatStore['hydrateSessionInventoryFromLayout']

    await store.bootstrap()
    assertCondition(!!capturedHydrationArgs, 'bootstrap should hydrate chat inventory exactly once')
    const hydrationArgs = capturedHydrationArgs || {
      tabIds: [],
      preferredActiveSessionId: null
    }
    assertEqual(
      JSON.stringify(hydrationArgs.tabIds),
      JSON.stringify(['chat-a', 'chat-b', 'chat-c']),
      'bootstrap should pass persisted chat tab ids in deterministic order'
    )
    assertEqual(
      hydrationArgs.preferredActiveSessionId,
      'chat-c',
      'bootstrap should pass preferred active chat session id to hydration'
    )
  })
}

void run()
  .then(() => {
    console.log('All AppStore extreme tests passed.')
  })
  .catch((error) => {
    console.error(error)
    throw error
  })
