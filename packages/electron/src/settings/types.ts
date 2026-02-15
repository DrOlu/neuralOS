export type AppLanguage = 'en' | 'zh-CN'

export interface TerminalUiSettings {
  fontSize: number
  lineHeight: number
  scrollback: number
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  copyOnSelect: boolean
  rightClickToPaste: boolean
}

export interface UiSettings {
  uiSchemaVersion: 1
  language: AppLanguage
  themeId: string
  terminal: TerminalUiSettings
}
