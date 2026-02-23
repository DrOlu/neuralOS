import path from 'node:path'
import { FileMemoryStore, type MemorySnapshot } from '../../memory/FileMemoryStore'

export type { MemorySnapshot }

export class NodeMemoryService {
  private readonly core: FileMemoryStore

  constructor(private readonly dataDir: string) {
    this.core = new FileMemoryStore({
      getMemoryFilePath: () => path.join(this.dataDir, 'memory.md')
    })
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
