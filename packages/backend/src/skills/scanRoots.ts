import path from 'node:path'
import os from 'node:os'

export interface SkillScanRootOptions {
  primaryRoot: string
  homeDir?: string
  platform?: NodeJS.Platform
  appData?: string
  codexHome?: string
}

export function resolveDefaultSkillScanRoots(options: SkillScanRootOptions): string[] {
  const primaryRoot = path.resolve(options.primaryRoot)
  const homeDir = (options.homeDir || os.homedir() || '').trim()
  const platform = options.platform || process.platform
  const appData = (options.appData || process.env.APPDATA || '').trim()
  const codexHome = (options.codexHome || process.env.CODEX_HOME || '').trim()

  const roots: string[] = [primaryRoot]

  if (homeDir) {
    roots.push(path.join(homeDir, '.claude', 'skills'))
    roots.push(path.join(homeDir, '.agents', 'skills'))
    roots.push(path.join(homeDir, '.codex', 'skills'))

    if (platform === 'win32') {
      if (appData) {
        roots.push(path.join(appData, 'agents', 'skills'))
      }
    } else {
      roots.push(path.join(homeDir, '.config', 'agents', 'skills'))
    }
  }

  if (codexHome) {
    roots.push(path.join(codexHome, 'skills'))
  }

  return [...new Set(roots.map((root) => path.resolve(root)))]
}
