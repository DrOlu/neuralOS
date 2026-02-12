import fs from 'node:fs/promises'
import path from 'node:path'
import type { NodeSettingsService } from './NodeSettingsService'

export interface SkillInfo {
  name: string
  description: string
  fileName: string
  filePath: string
  baseDir: string
  scanRoot: string
  isNested: boolean
  supportingFiles?: string[]
}

type ParsedMarkdown = {
  frontmatter: Record<string, string>
  content: string
}

function parseFrontmatter(raw: string): ParsedMarkdown {
  const normalized = raw.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, content: raw }
  }

  const endIdx = normalized.indexOf('\n---', 4)
  if (endIdx === -1) {
    return { frontmatter: {}, content: raw }
  }

  const fmBlock = normalized.slice(4, endIdx).trimEnd()
  const rest = normalized.slice(endIdx + '\n---'.length)
  const content = rest.replace(/^\n+/, '')
  const lines = fmBlock.split('\n')
  const frontmatter: Record<string, string> = {}

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    const value = String(match[2] || '').trim().replace(/^['"]|['"]$/g, '')
    frontmatter[key] = value
  }

  return { frontmatter, content }
}

async function listSupportingFiles(dir: string, skillFilePath: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (fullPath === skillFilePath) continue
      files.push(path.relative(dir, fullPath))
    }
  }

  await walk(dir)
  return files.sort((a, b) => a.localeCompare(b))
}

function toSafeSkillFileName(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill'}.md`
}

export class NodeSkillService {
  private cache: SkillInfo[] = []
  private readonly skillsDir: string

  constructor(dataDir: string, private readonly settingsService?: NodeSettingsService) {
    this.skillsDir = path.join(dataDir, 'skills')
  }

  getSkillsDir(): string {
    return this.skillsDir
  }

  private async ensureSkillsDir(): Promise<void> {
    await fs.mkdir(this.skillsDir, { recursive: true })
  }

  async reload(): Promise<SkillInfo[]> {
    await this.ensureSkillsDir()

    const result: SkillInfo[] = []
    const seenNames = new Set<string>()
    const entries = await fs.readdir(this.skillsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const filePath = path.join(this.skillsDir, entry.name)
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '')
        const parsed = parseFrontmatter(raw)
        const name = String(parsed.frontmatter.name || '').trim()
        const description = String(parsed.frontmatter.description || '').trim()
        if (!name || !description || seenNames.has(name)) continue

        result.push({
          name,
          description,
          fileName: entry.name,
          filePath,
          baseDir: this.skillsDir,
          scanRoot: this.skillsDir,
          isNested: false
        })
        seenNames.add(name)
        continue
      }

      if (entry.isDirectory()) {
        const skillDir = path.join(this.skillsDir, entry.name)
        const skillFilePath = path.join(skillDir, 'SKILL.md')
        const exists = await fs
          .access(skillFilePath)
          .then(() => true)
          .catch(() => false)
        if (!exists) continue

        const raw = await fs.readFile(skillFilePath, 'utf8').catch(() => '')
        const parsed = parseFrontmatter(raw)
        const name = String(parsed.frontmatter.name || '').trim()
        const description = String(parsed.frontmatter.description || '').trim()
        if (!name || !description || seenNames.has(name)) continue

        const supportingFiles = await listSupportingFiles(skillDir, skillFilePath)
        result.push({
          name,
          description,
          fileName: 'SKILL.md',
          filePath: skillFilePath,
          baseDir: skillDir,
          scanRoot: this.skillsDir,
          isNested: true,
          supportingFiles
        })
        seenNames.add(name)
      }
    }

    this.cache = result.sort((a, b) => a.name.localeCompare(b.name))
    return this.cache
  }

  async getAll(): Promise<SkillInfo[]> {
    if (this.cache.length === 0) {
      await this.reload()
    }
    return this.cache
  }

  async getEnabledSkills(): Promise<SkillInfo[]> {
    const all = await this.getAll()
    if (!this.settingsService) return all

    const skillStates = this.settingsService.getSettings().tools?.skills ?? {}
    return all.filter((skill) => skillStates[skill.name] !== false)
  }

  async readSkillContentByName(name: string): Promise<{ info: SkillInfo; content: string }> {
    const skills = await this.getAll()
    const info = skills.find((item) => item.name === name)
    if (!info) {
      throw new Error(`Skill "${name}" not found`)
    }

    const raw = await fs.readFile(info.filePath, 'utf8')
    const parsed = parseFrontmatter(raw)
    let content = parsed.content.trim()

    if (info.isNested && info.supportingFiles && info.supportingFiles.length > 0) {
      const list = info.supportingFiles
        .map((relativeFile) => `- ${path.join(info.baseDir, relativeFile)}`)
        .join('\n')
      content += `\n\n## Supporting Files\n\nSkill directory: ${info.baseDir}\n\n${list}`
    }

    return { info, content }
  }

  async createOrRewriteSkill(
    name: string,
    description: string,
    content: string
  ): Promise<{ skill: SkillInfo; action: 'created' | 'rewritten' }> {
    await this.ensureSkillsDir()
    await this.reload()

    const existing = this.cache.find((item) => item.name === name && item.scanRoot === this.skillsDir)
    const body = ['---', `name: ${name}`, `description: ${description}`, '---', '', content].join('\n')

    if (existing) {
      await fs.writeFile(existing.filePath, body, 'utf8')
      await this.reload()
      const updated = this.cache.find((item) => item.filePath === existing.filePath) || existing
      return { skill: updated, action: 'rewritten' }
    }

    const fileName = toSafeSkillFileName(name)
    const filePath = path.join(this.skillsDir, fileName)
    await fs.writeFile(filePath, body, 'utf8')
    await this.reload()

    const created = this.cache.find((item) => item.filePath === filePath)
    if (created) {
      return { skill: created, action: 'created' }
    }

    return {
      skill: {
        name,
        description,
        fileName,
        filePath,
        baseDir: this.skillsDir,
        scanRoot: this.skillsDir,
        isNested: false
      },
      action: 'created'
    }
  }
}
