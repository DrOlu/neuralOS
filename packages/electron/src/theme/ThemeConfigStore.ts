import fs from 'node:fs'
import path from 'node:path'
import { app, shell } from 'electron'
import type { TerminalColorScheme } from '../../../shared/src/theme/terminalColorSchemes'

function normalizeThemeList(raw: unknown): TerminalColorScheme[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item): TerminalColorScheme => ({
      name: String(item.name || '').trim(),
      foreground: String(item.foreground || '').trim(),
      background: String(item.background || '').trim(),
      cursor: String(item.cursor || '').trim(),
      colors: Array.isArray(item.colors) ? item.colors.map((value: unknown) => String(value)) : [],
      selection: item.selection ? String(item.selection) : undefined,
      selectionForeground: item.selectionForeground ? String(item.selectionForeground) : undefined,
      cursorAccent: item.cursorAccent ? String(item.cursorAccent) : undefined
    }))
    .filter(
      (theme) =>
        theme.name.length > 0 &&
        theme.foreground.length > 0 &&
        theme.background.length > 0 &&
        theme.cursor.length > 0 &&
        theme.colors.length >= 16
    )
    .map((theme) => ({
      ...theme,
      colors: theme.colors.slice(0, 16)
    }))
}

export class ThemeConfigStore {
  private customThemes: TerminalColorScheme[] = []

  private getCustomThemesPath(): string {
    const overrideDir = (process.env.GYSHELL_STORE_DIR || '').trim()
    const baseDir = overrideDir || app.getPath('userData')
    return path.join(baseDir, 'custom-themes.json')
  }

  getCustomThemes(): TerminalColorScheme[] {
    return this.customThemes
  }

  async loadCustomThemes(): Promise<TerminalColorScheme[]> {
    const filePath = this.getCustomThemesPath()
    if (!fs.existsSync(filePath)) {
      this.customThemes = []
      return this.customThemes
    }

    try {
      const text = fs.readFileSync(filePath, 'utf8').trim()
      if (!text) {
        this.customThemes = []
        return this.customThemes
      }
      const parsed = JSON.parse(text)
      this.customThemes = normalizeThemeList(parsed)
      return this.customThemes
    } catch (error) {
      console.warn('[ThemeConfigStore] Failed to load custom themes:', error)
      this.customThemes = []
      return this.customThemes
    }
  }

  async openCustomThemeFile(): Promise<void> {
    const filePath = this.getCustomThemesPath()
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]\n', 'utf8')
    }
    await shell.openPath(filePath)
  }
}
