import path from 'node:path'
import {
  FileAccessTokenStore,
  type AccessTokenInfo,
  type CreateAccessTokenResult
} from '../../access-token/FileAccessTokenStore'

export class NodeAccessTokenService {
  private readonly store: FileAccessTokenStore

  constructor(dataDir: string) {
    this.store = new FileAccessTokenStore({
      filePath: path.join(dataDir, 'access-tokens.json')
    })
  }

  getStorageFilePath(): string {
    return this.store.getStorageFilePath()
  }

  async listTokens(): Promise<AccessTokenInfo[]> {
    return await this.store.list()
  }

  async createToken(name: string): Promise<CreateAccessTokenResult> {
    return await this.store.create(name)
  }

  async deleteToken(id: string): Promise<boolean> {
    return await this.store.delete(id)
  }

  async verifyToken(token: string): Promise<boolean> {
    return await this.store.verify(token)
  }
}
