export const PANEL_TAB_DISPLAY_MODE_VALUES = [
  'auto',
  'expanded',
  'select',
] as const

export type PanelTabDisplayModePreference =
  (typeof PANEL_TAB_DISPLAY_MODE_VALUES)[number]

export const DEFAULT_PANEL_TAB_DISPLAY_MODE: PanelTabDisplayModePreference =
  'auto'

export const isPanelTabDisplayModePreference = (
  value: unknown,
): value is PanelTabDisplayModePreference =>
  typeof value === 'string' &&
  (PANEL_TAB_DISPLAY_MODE_VALUES as readonly string[]).includes(value)
