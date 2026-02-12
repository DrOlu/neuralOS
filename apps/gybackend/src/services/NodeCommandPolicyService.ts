import fs from 'node:fs'
import path from 'node:path'

export type CommandPolicyMode = 'safe' | 'standard' | 'smart'

export interface CommandPolicyLists {
  allowlist: string[]
  denylist: string[]
  asklist: string[]
}

export type CommandPolicyListName = keyof CommandPolicyLists

const DEFAULT_LISTS: CommandPolicyLists = {
  allowlist: [],
  denylist: [],
  asklist: []
}

export class NodeCommandPolicyService {
  private feedbackWaiter: ((messageId: string, timeoutMs?: number) => Promise<any | null>) | null = null
  private readonly policyPath: string

  constructor(private readonly dataDir: string) {
    this.policyPath = path.join(this.dataDir, 'command-policy.json')
    this.ensurePolicyFile()
  }

  setFeedbackWaiter(waiter: (messageId: string, timeoutMs?: number) => Promise<any | null>): void {
    this.feedbackWaiter = waiter
  }

  getPolicyFilePath(): string {
    return this.policyPath
  }

  private ensurePolicyFile(): void {
    fs.mkdirSync(this.dataDir, { recursive: true })
    if (!fs.existsSync(this.policyPath)) {
      fs.writeFileSync(this.policyPath, JSON.stringify(DEFAULT_LISTS, null, 2), 'utf8')
    }
  }

  private loadListsSync(): CommandPolicyLists {
    this.ensurePolicyFile()
    try {
      const raw = fs.readFileSync(this.policyPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<CommandPolicyLists>
      return {
        allowlist: Array.isArray(parsed.allowlist) ? parsed.allowlist.map(String) : [],
        denylist: Array.isArray(parsed.denylist) ? parsed.denylist.map(String) : [],
        asklist: Array.isArray(parsed.asklist) ? parsed.asklist.map(String) : []
      }
    } catch {
      return { ...DEFAULT_LISTS }
    }
  }

  private saveLists(lists: CommandPolicyLists): void {
    this.ensurePolicyFile()
    fs.writeFileSync(this.policyPath, JSON.stringify(lists, null, 2), 'utf8')
  }

  async getLists(): Promise<CommandPolicyLists> {
    return this.loadListsSync()
  }

  async addRule(listName: CommandPolicyListName, rule: string): Promise<CommandPolicyLists> {
    const trimmed = String(rule || '').trim()
    if (!trimmed) return this.loadListsSync()

    const lists = this.loadListsSync()
    const existing = new Set(lists[listName])
    existing.add(trimmed)
    lists[listName] = Array.from(existing).sort((a, b) => a.localeCompare(b))
    this.saveLists(lists)
    return lists
  }

  async deleteRule(listName: CommandPolicyListName, rule: string): Promise<CommandPolicyLists> {
    const trimmed = String(rule || '').trim()
    const lists = this.loadListsSync()
    lists[listName] = lists[listName].filter((item) => item !== trimmed)
    this.saveLists(lists)
    return lists
  }

  async evaluate(command: string, mode: CommandPolicyMode): Promise<'allow' | 'deny' | 'ask'> {
    const lists = this.loadListsSync()
    const commandEntries = this.splitCommand(command)

    if (this.matchAny(commandEntries, lists.denylist)) {
      return 'deny'
    }

    if (this.matchAny(commandEntries, lists.asklist)) {
      return 'ask'
    }

    if (this.matchAny(commandEntries, lists.allowlist)) {
      return 'allow'
    }

    if (mode === 'safe') return 'deny'
    if (mode === 'standard') return 'ask'
    return 'allow'
  }

  async requestApproval(params: {
    sessionId: string
    messageId: string
    command: string
    toolName: string
    sendEvent: (sessionId: string, event: any) => void
    signal?: AbortSignal
  }): Promise<boolean> {
    if (!this.feedbackWaiter) {
      throw new Error('Feedback waiter is not initialized')
    }

    return new Promise<boolean>((resolve, reject) => {
      const onAbort = () => reject(new Error('AbortError'))

      if (params.signal) {
        if (params.signal.aborted) {
          onAbort()
          return
        }
        params.signal.addEventListener('abort', onAbort, { once: true })
      }

      params.sendEvent(params.sessionId, {
        type: 'command_ask',
        approvalId: params.messageId,
        command: params.command,
        toolName: params.toolName,
        messageId: params.messageId,
        decision: undefined
      })

      this.feedbackWaiter!(params.messageId)
        .then((feedback) => {
          if (params.signal) {
            params.signal.removeEventListener('abort', onAbort)
          }
          resolve(Boolean(feedback && feedback.decision === 'allow'))
        })
        .catch(reject)
    })
  }

  private splitCommand(command: string): string[] {
    return String(command || '')
      .split(/&&|\|\||;|\n/g)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  private matchAny(commands: string[], rules: string[]): boolean {
    if (!rules.length) return false

    for (const command of commands) {
      const firstToken = command.split(/\s+/)[0] || ''
      for (const rule of rules) {
        const normalizedRule = String(rule || '').trim()
        if (!normalizedRule) continue
        if (this.matchWildcard(command, normalizedRule)) return true
        if (firstToken && this.matchWildcard(firstToken, normalizedRule)) return true
      }
    }

    return false
  }

  private matchWildcard(text: string, pattern: string): boolean {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    const regexPattern = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$$`
    return new RegExp(regexPattern).test(text)
  }
}
