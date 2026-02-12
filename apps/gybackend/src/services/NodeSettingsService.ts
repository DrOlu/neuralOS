import fs from 'node:fs'
import path from 'node:path'
import type { BackendSettings } from '../../../../src/main/types'
import { BUILTIN_TOOL_INFO } from '../../../../src/main/services/AgentHelper/tools'

const DEFAULT_BUILTIN_TOOLS = BUILTIN_TOOL_INFO.reduce(
  (acc: Record<string, boolean>, tool) => {
    acc[tool.name] = true
    return acc
  },
  {}
)

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge<T>(base: T, patch: Partial<T>): T {
  if (!isObject(base) || !isObject(patch)) {
    return { ...(base as any), ...(patch as any) }
  }

  const output: Record<string, unknown> = { ...(base as any) }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = output[key]
    if (isObject(current) && isObject(value)) {
      output[key] = deepMerge(current, value)
      continue
    }
    output[key] = value
  }

  return output as T
}

function defaultSettingsFromEnv(): BackendSettings {
  const modelName = (process.env.GYBACKEND_MODEL || '').trim()
  const apiKey = (process.env.GYBACKEND_API_KEY || '').trim()
  const baseUrl = (process.env.GYBACKEND_BASE_URL || '').trim()

  const hasBootstrapModel = Boolean(modelName)
  const modelId = hasBootstrapModel ? 'default-model' : ''
  const profileId = hasBootstrapModel ? 'default-profile' : ''

  return {
    schemaVersion: 3,
    commandPolicyMode: 'standard',
    model: modelName,
    baseUrl,
    apiKey,
    models: {
      items: hasBootstrapModel
        ? [
            {
              id: modelId,
              name: modelName,
              model: modelName,
              apiKey,
              baseUrl,
              maxTokens: 200000
            }
          ]
        : [],
      profiles: hasBootstrapModel
        ? [
            {
              id: profileId,
              name: 'Default Profile',
              globalModelId: modelId
            }
          ]
        : [],
      activeProfileId: profileId
    },
    connections: {
      ssh: [],
      proxies: [],
      tunnels: []
    },
    tools: {
      builtIn: DEFAULT_BUILTIN_TOOLS,
      skills: {}
    },
    layout: {
      panelSizes: [30, 70],
      panelOrder: ['chat', 'terminal']
    },
    recursionLimit: 200,
    debugMode: false,
    experimental: {
      runtimeThinkingCorrectionEnabled: true,
      taskFinishGuardEnabled: true,
      firstTurnThinkingModelEnabled: false
    }
  }
}

export class NodeSettingsService {
  private readonly settingsPath: string
  private settings: BackendSettings

  constructor(private readonly dataDir: string) {
    this.settingsPath = path.join(this.dataDir, 'settings.json')
    this.settings = defaultSettingsFromEnv()
    this.loadFromDisk()
  }

  private ensureDir(): void {
    fs.mkdirSync(this.dataDir, { recursive: true })
  }

  private loadFromDisk(): void {
    this.ensureDir()

    if (!fs.existsSync(this.settingsPath)) {
      this.persist()
      return
    }

    try {
      const raw = fs.readFileSync(this.settingsPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<BackendSettings>
      this.settings = this.normalize(deepMerge(defaultSettingsFromEnv(), parsed))
      this.persist()
    } catch (error) {
      console.warn('[NodeSettingsService] Failed to parse settings.json, fallback to defaults:', error)
      this.settings = defaultSettingsFromEnv()
      this.persist()
    }
  }

  private persist(): void {
    this.ensureDir()
    fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8')
  }

  private normalize(settings: BackendSettings): BackendSettings {
    const next = deepMerge(defaultSettingsFromEnv(), settings)

    next.models.items = next.models.items.map((item) => ({
      ...item,
      maxTokens: typeof item.maxTokens === 'number' && item.maxTokens > 0 ? item.maxTokens : 200000
    }))

    next.tools = {
      builtIn: {
        ...DEFAULT_BUILTIN_TOOLS,
        ...(next.tools?.builtIn ?? {})
      },
      skills: {
        ...(next.tools?.skills ?? {})
      }
    }

    if (!next.models.activeProfileId && next.models.profiles.length > 0) {
      next.models.activeProfileId = next.models.profiles[0].id
    }

    const activeProfile = next.models.profiles.find((profile) => profile.id === next.models.activeProfileId)
    const activeModel = activeProfile
      ? next.models.items.find((item) => item.id === activeProfile.globalModelId)
      : undefined

    next.model = activeModel?.model || ''
    next.baseUrl = activeModel?.baseUrl || ''
    next.apiKey = activeModel?.apiKey || ''
    next.schemaVersion = 3

    return next
  }

  getSettingsPath(): string {
    return this.settingsPath
  }

  getSettings(): BackendSettings {
    return this.settings
  }

  setSettings(settingsPatch: Partial<BackendSettings>): void {
    this.settings = this.normalize(deepMerge(this.settings, settingsPatch))
    this.persist()
  }
}
