#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')
const runtimeRoot = path.join(repoRoot, 'apps', 'electron', 'cli-runtime')

function parseTargetArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--target' && argv[i + 1]) {
      return String(argv[i + 1]).trim()
    }
  }
  return ''
}

function inferDefaultTarget() {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64'
  if (platform === 'linux' && arch === 'x64') return 'linux-x64'
  if (platform === 'win32' && arch === 'x64') return 'windows-x64'

  throw new Error(`Unsupported host for default CLI target: ${platform}/${arch}`)
}

function parseTarget(target) {
  const trimmed = String(target || '').trim()
  const match = /^(darwin|linux|windows)-(arm64|x64)$/.exec(trimmed)
  if (!match) {
    throw new Error(`Unsupported CLI target: ${target}`)
  }
  const platform = match[1] === 'windows' ? 'win32' : match[1]
  const arch = match[2]
  return { platform, arch }
}

function shouldEnableCrossPlatformInstall(target) {
  const parsed = parseTarget(target)
  return parsed.platform !== process.platform || parsed.arch !== process.arch
}

function runBuild(target) {
  const args = [
    '--workspace',
    '@gyshell/tui',
    'run',
    'build:cli-binaries',
    '--',
    '--layout',
    'electron',
    '--target',
    target,
    '--output-root',
    runtimeRoot,
  ]
  if (shouldEnableCrossPlatformInstall(target)) {
    args.push('--with-install')
  }
  const result = spawnSync('npm', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`CLI binary build failed with exit code ${result.status}`)
  }
}

function validateRuntime(target) {
  const binary = target.startsWith('windows-') ? 'gyll.exe' : 'gyll'
  const binaryPath = path.join(runtimeRoot, 'bin', binary)
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Missing compiled CLI binary after build: ${binaryPath}`)
  }
  fs.writeFileSync(
    path.join(runtimeRoot, 'README.txt'),
    `Generated runtime bundle for GyShell desktop CLI.\nTarget: ${target}\n`,
    'utf8',
  )
}

function main() {
  const targetFromArg = parseTargetArg(process.argv.slice(2))
  const target = targetFromArg || (process.env.GYLL_CLI_TARGET || '').trim() || inferDefaultTarget()

  fs.rmSync(runtimeRoot, { recursive: true, force: true })
  fs.mkdirSync(runtimeRoot, { recursive: true })

  runBuild(target)
  validateRuntime(target)

  console.log(`[prepare-cli-runtime] Prepared runtime at: ${runtimeRoot}`)
  console.log(`[prepare-cli-runtime] Target: ${target}`)
}

main()
