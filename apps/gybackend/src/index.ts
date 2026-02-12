import path from 'node:path'
import process from 'node:process'
import { TerminalService } from '../../../src/main/services/TerminalService'
import { AgentService_v2 } from '../../../src/main/services/AgentService_v2'
import { UIHistoryService } from '../../../src/main/services/UIHistoryService'
import { GatewayService } from '../../../src/main/services/Gateway/GatewayService'
import { WebSocketGatewayAdapter } from '../../../src/main/services/Gateway/WebSocketGatewayAdapter'
import type { CommandPolicyService } from '../../../src/main/services/CommandPolicy/CommandPolicyService'
import type { McpToolService } from '../../../src/main/services/McpToolService'
import type { SettingsService } from '../../../src/main/services/SettingsService'
import { NodeSettingsService } from './services/NodeSettingsService'
import { NodeCommandPolicyService } from './services/NodeCommandPolicyService'
import { NodeMcpToolService } from './services/NodeMcpToolService'
import { NodeSkillService } from './services/NodeSkillService'

function boolFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (!raw) return fallback
  return /^(1|true|yes|on)$/i.test(raw)
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name] || '')
  if (!Number.isInteger(raw) || raw <= 0 || raw >= 65536) {
    return fallback
  }
  return raw
}

function resolveDataDir(): string {
  const custom = (process.env.GYBACKEND_DATA_DIR || '').trim()
  if (custom) {
    return path.resolve(custom)
  }
  return path.join(process.cwd(), '.gybackend-data')
}

async function bootstrap(): Promise<void> {
  const dataDir = resolveDataDir()
  process.env.GYSHELL_STORE_DIR = dataDir
  const host = process.env.GYBACKEND_WS_HOST || '0.0.0.0'
  const port = numberFromEnv('GYBACKEND_WS_PORT', 17888)
  const bootstrapLocalTerminal = boolFromEnv('GYBACKEND_BOOTSTRAP_LOCAL_TERMINAL', true)

  const settingsService = new NodeSettingsService(dataDir)
  const commandPolicyService = new NodeCommandPolicyService(dataDir)
  const mcpToolService = new NodeMcpToolService(dataDir)
  const skillService = new NodeSkillService(dataDir, settingsService)

  const terminalService = new TerminalService()
  const uiHistoryService = new UIHistoryService()
  const agentService = new AgentService_v2(
    terminalService,
    commandPolicyService as unknown as CommandPolicyService,
    mcpToolService as unknown as McpToolService,
    skillService as any,
    uiHistoryService
  )

  const gatewayService = new GatewayService(
    terminalService,
    agentService,
    uiHistoryService,
    commandPolicyService as unknown as CommandPolicyService,
    settingsService as unknown as SettingsService,
    mcpToolService as unknown as McpToolService
  )

  agentService.updateSettings(settingsService.getSettings())
  await skillService.reload()
  await mcpToolService.reloadAll()

  if (bootstrapLocalTerminal) {
    const terminalId = process.env.GYBACKEND_TERMINAL_ID || 'local-main'
    const terminalTitle = process.env.GYBACKEND_TERMINAL_TITLE || 'Local'
    const terminalCwd = process.env.GYBACKEND_TERMINAL_CWD
    const terminalShell = process.env.GYBACKEND_TERMINAL_SHELL

    try {
      await terminalService.createTerminal({
        type: 'local',
        id: terminalId,
        title: terminalTitle,
        cols: 120,
        rows: 32,
        cwd: terminalCwd,
        shell: terminalShell
      })
      console.log(`[gybackend] Bootstrapped terminal: ${terminalId}`)
    } catch (error) {
      console.warn('[gybackend] Failed to bootstrap default terminal:', error)
    }
  }

  const wsAdapter = new WebSocketGatewayAdapter(gatewayService, {
    host,
    port,
    terminalBridge: {
      listTerminals: () =>
        terminalService.getAllTerminals().map((terminal) => ({
          id: terminal.id,
          title: terminal.title,
          type: terminal.type
        }))
    },
    profileBridge: {
      getProfiles: () => {
        const snapshot = settingsService.getSettings()
        const modelNameById = new Map(snapshot.models.items.map((item) => [item.id, item.model]))
        return {
          activeProfileId: snapshot.models.activeProfileId,
          profiles: snapshot.models.profiles.map((profile) => ({
            id: profile.id,
            name: profile.name,
            globalModelId: profile.globalModelId,
            modelName: modelNameById.get(profile.globalModelId)
          }))
        }
      },
      setActiveProfile: (profileId: string) => {
        const snapshot = settingsService.getSettings()
        const exists = snapshot.models.profiles.some((profile) => profile.id === profileId)
        if (!exists) {
          throw new Error(`Profile not found: ${profileId}`)
        }

        settingsService.setSettings({
          models: {
            items: snapshot.models.items,
            profiles: snapshot.models.profiles,
            activeProfileId: profileId
          }
        })

        const next = settingsService.getSettings()
        agentService.updateSettings(next)

        const modelNameById = new Map(next.models.items.map((item) => [item.id, item.model]))
        return {
          activeProfileId: next.models.activeProfileId,
          profiles: next.models.profiles.map((profile) => ({
            id: profile.id,
            name: profile.name,
            globalModelId: profile.globalModelId,
            modelName: modelNameById.get(profile.globalModelId)
          }))
        }
      }
    }
  })

  wsAdapter.start()

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[gybackend] Received ${signal}, shutting down...`)
    try {
      await wsAdapter.stop()
    } catch (error) {
      console.warn('[gybackend] Failed to stop websocket adapter cleanly:', error)
    }

    for (const terminal of terminalService.getAllTerminals()) {
      terminalService.kill(terminal.id)
    }

    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  console.log('[gybackend] Started.')
  console.log(`[gybackend] WebSocket RPC endpoint: ws://${host}:${port}`)
  console.log(`[gybackend] Data directory: ${dataDir}`)
  console.log(`[gybackend] Settings file: ${settingsService.getSettingsPath()}`)
}

void bootstrap().catch((error) => {
  console.error('[gybackend] Fatal startup error:', error)
  process.exit(1)
})
