import path from 'node:path'
import { app } from 'electron'
import { FileMemoryStore, type MemorySnapshot } from '../memory/FileMemoryStore'

export type { MemorySnapshot }

export class MemoryService {
  private readonly core: FileMemoryStore

  constructor() {
    this.core = new FileMemoryStore({
      getMemoryFilePath: () => path.join(this.resolveBaseDir(), 'memory.md')
    })
  }

  private resolveBaseDir(): string {
    const overrideDir = (process.env.GYSHELL_STORE_DIR || '').trim()
    if (overrideDir) {
      return overrideDir
    }
    return app.getPath('userData')
  }

  async ensureMemoryFile(): Promise<string> {
    return await this.core.ensureMemoryFile()
  }

  async getMemoryFilePath(): Promise<string> {
    return await this.core.getMemoryFilePath()
  }

  async getMemorySnapshot(): Promise<MemorySnapshot> {
    return await this.core.getMemorySnapshot()
  }

  async readMemory(): Promise<string> {
    return await this.core.readMemory()
  }

  async writeMemory(content: string): Promise<MemorySnapshot> {
    return await this.core.writeMemory(content)
  }
}
