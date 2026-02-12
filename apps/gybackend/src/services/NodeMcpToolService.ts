import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

export type McpServerStatus = 'disabled' | 'connecting' | 'connected' | 'error'

export interface McpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  serverUrl?: string
  headers?: Record<string, string>
  enable?: boolean
}

export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfig>
}

export interface McpServerSummary {
  name: string
  enabled: boolean
  status: McpServerStatus
  error?: string
  toolCount?: number
}

const DEFAULT_CONFIG: McpConfigFile = {
  mcpServers: {}
}

/**
 * Node runtime fallback for MCP service.
 * This keeps protocol compatibility while deferring actual MCP process wiring
 * to a dedicated package in a later milestone.
 */
export class NodeMcpToolService extends EventEmitter {
  private config: McpConfigFile = DEFAULT_CONFIG
  private readonly configPath: string

  constructor(dataDir: string) {
    super()
    this.configPath = path.join(dataDir, 'mcp.json')
    this.ensureConfigFile()
  }

  getConfigPath(): string {
    return this.configPath
  }

  private ensureConfigFile(): void {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true })
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8')
    }
  }

  private loadConfigSync(): McpConfigFile {
    this.ensureConfigFile()
    try {
      const raw = fs.readFileSync(this.configPath, 'utf8')
      const parsed = JSON.parse(raw) as McpConfigFile
      if (parsed && parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        return parsed
      }
      return { ...DEFAULT_CONFIG }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  private writeConfigSync(config: McpConfigFile): void {
    this.ensureConfigFile()
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8')
  }

  async reloadAll(): Promise<McpServerSummary[]> {
    this.config = this.loadConfigSync()
    const summaries = this.getSummaries()
    this.emit('updated', summaries)
    return summaries
  }

  getSummaries(): McpServerSummary[] {
    return Object.entries(this.config.mcpServers || {}).map(([name, cfg]) => ({
      name,
      enabled: Boolean(cfg.enable),
      status: 'disabled',
      error: cfg.enable
        ? 'Node backend MCP runtime is not enabled yet. Configure this in a future backend-core MCP package.'
        : undefined,
      toolCount: 0
    }))
  }

  async setServerEnabled(name: string, enabled: boolean): Promise<McpServerSummary[]> {
    this.config = this.loadConfigSync()
    if (!this.config.mcpServers[name]) {
      throw new Error(`MCP server "${name}" not found in config`)
    }
    this.config.mcpServers[name].enable = enabled
    this.writeConfigSync(this.config)
    const summaries = this.getSummaries()
    this.emit('updated', summaries)
    return summaries
  }

  isMcpToolName(_toolName: string): boolean {
    return false
  }

  getActiveTools(): any[] {
    return []
  }

  async invokeTool(toolName: string, _args: unknown): Promise<unknown> {
    throw new Error(`MCP tool "${toolName}" is unavailable in the current gybackend build`)
  }
}
