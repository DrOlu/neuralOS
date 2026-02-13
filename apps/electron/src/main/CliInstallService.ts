import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const PATH_BLOCK_START = '# >>> Gyll CLI >>>'
const PATH_BLOCK_END = '# <<< Gyll CLI <<<'

type Logger = Pick<Console, 'info' | 'warn'>

export interface CliInstallOptions {
  isPackaged: boolean
  resourcesPath: string
  projectRoot: string
  homeDir?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  runtimeRootOverride?: string
  force?: boolean
  logger?: Logger
}

export interface CliInstallResult {
  installed: boolean
  reason?: string
  binDir?: string
  runtimeRoot?: string
}

export function installCliLaunchers(options: CliInstallOptions): CliInstallResult {
  const logger = options.logger ?? console
  const platform = options.platform ?? process.platform
  const homeDir = options.homeDir ?? os.homedir()
  const env = options.env ?? process.env

  if (!options.force && !options.isPackaged) {
    return { installed: false, reason: 'skip-non-packaged' }
  }

  const runtimeRoot = resolveRuntimeRoot(options)
  const binaryName = platform === 'win32' ? 'gyll.exe' : 'gyll'
  const gyllBinary = path.join(runtimeRoot, 'bin', binaryName)

  if (!isFile(gyllBinary)) {
    logger.warn(`[CLI] Runtime is incomplete, skipping CLI install. runtimeRoot=${runtimeRoot}`)
    return { installed: false, reason: 'runtime-missing', runtimeRoot }
  }

  const binDir = resolveBinDirectory(platform, homeDir, env)
  fs.mkdirSync(binDir, { recursive: true })

  if (platform === 'win32') {
    const content = buildWindowsLauncherScript(gyllBinary)
    writeFile(path.join(binDir, 'gyll.cmd'), content)
    writeFile(path.join(binDir, 'gyll-tui.cmd'), content)
    ensureWindowsPath(binDir, env, logger)
  } else {
    const content = buildPosixLauncherScript(gyllBinary)
    writeExecutable(path.join(binDir, 'gyll'), content)
    writeExecutable(path.join(binDir, 'gyll-tui'), content)
    ensurePosixPath(binDir, homeDir)
  }

  logger.info(`[CLI] Installed launchers in ${binDir}`)
  return {
    installed: true,
    binDir,
    runtimeRoot,
  }
}

function resolveRuntimeRoot(options: CliInstallOptions): string {
  if (options.runtimeRootOverride) {
    return path.resolve(options.runtimeRootOverride)
  }
  if (options.isPackaged) {
    return path.join(options.resourcesPath, 'cli')
  }
  const generated = path.join(options.projectRoot, 'apps', 'electron', 'cli-runtime')
  if (fs.existsSync(generated)) return generated
  return path.join(options.projectRoot, 'apps', 'electron', 'cli-runtime')
}

function resolveBinDirectory(platform: NodeJS.Platform, homeDir: string, env: NodeJS.ProcessEnv): string {
  if (platform === 'win32') {
    const localAppData = (env.LOCALAPPDATA || '').trim()
    if (localAppData) {
      const windowsApps = path.join(localAppData, 'Microsoft', 'WindowsApps')
      if (isDirectoryWritable(windowsApps)) return windowsApps
    }
  }
  return path.join(homeDir, '.gyll', 'bin')
}

function buildPosixLauncherScript(gyllBinary: string): string {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `GYLL_BIN='${escapeSingleQuotes(gyllBinary)}'`,
    'exec "$GYLL_BIN" "$@"',
    '',
  ].join('\n')
}

function buildWindowsLauncherScript(gyllBinary: string): string {
  const binary = toWindowsPath(gyllBinary)
  return [
    '@echo off',
    'setlocal',
    `set "GYLL_BIN=${binary}"`,
    '"%GYLL_BIN%" %*',
    '',
  ].join('\r\n')
}

function ensurePosixPath(binDir: string, homeDir: string): void {
  const normalized = path.resolve(binDir)
  const defaultDir = path.join(homeDir, '.gyll', 'bin')
  const pathExpr =
    normalized === path.resolve(defaultDir)
      ? '$HOME/.gyll/bin'
      : normalized.replace(/(["\\$`])/g, '\\$1')
  const block = `${PATH_BLOCK_START}\nexport PATH="${pathExpr}:$PATH"\n${PATH_BLOCK_END}\n`
  const profileFiles = ['.zshrc', '.zprofile', '.bashrc', '.bash_profile', '.profile']

  for (const fileName of profileFiles) {
    const filePath = path.join(homeDir, fileName)
    upsertProfileBlock(filePath, block)
  }
}

function ensureWindowsPath(binDir: string, env: NodeJS.ProcessEnv, logger: Logger): void {
  const currentPath = env.PATH || env.Path || ''
  const parts = currentPath
    .split(';')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  if (parts.includes(binDir.trim().toLowerCase())) return

  const nextPath = currentPath ? `${currentPath};${binDir}` : binDir
  const result = spawnSync('setx', ['PATH', nextPath], {
    windowsHide: true,
    stdio: 'ignore',
  })
  if (result.error || result.status !== 0) {
    logger.warn('[CLI] Unable to update Windows user PATH automatically.')
  }
}

function upsertProfileBlock(filePath: string, block: string): void {
  const existing = readOptionalFile(filePath)
  if (existing.includes(PATH_BLOCK_START) && existing.includes(PATH_BLOCK_END)) {
    const next = replaceManagedBlock(existing, block)
    if (next !== existing) {
      writeFile(filePath, next)
    }
    return
  }

  const delimiter = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
  writeFile(filePath, `${existing}${delimiter}${block}`)
}

function replaceManagedBlock(content: string, block: string): string {
  const start = content.indexOf(PATH_BLOCK_START)
  const end = content.indexOf(PATH_BLOCK_END)
  if (start === -1 || end === -1 || end < start) return content
  const afterEnd = end + PATH_BLOCK_END.length
  const newlineSuffix = content.slice(afterEnd).startsWith('\n') ? 1 : 0
  return `${content.slice(0, start)}${block}${content.slice(afterEnd + newlineSuffix)}`
}

function readOptionalFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function writeExecutable(filePath: string, content: string): void {
  writeFile(filePath, content)
  fs.chmodSync(filePath, 0o755)
}

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function isDirectoryWritable(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath)
    if (!stat.isDirectory()) return false
    fs.accessSync(dirPath, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function escapeSingleQuotes(input: string): string {
  return input.replace(/'/g, `'\"'\"'`)
}

function toWindowsPath(input: string): string {
  return path.resolve(input).replace(/\//g, '\\')
}
