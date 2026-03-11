import { app } from 'electron'
import { join } from 'path'
import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import type { TerminalColorScheme } from '../../../../../shared/src/theme/terminalColorSchemes'
import { resolveTheme } from '../../../../../shared/src/theme/themes'

/**
 * Resolve the 512×512 icon PNG path that Electron can use for the taskbar icon.
 *
 * - Packaged build: the icon is placed at <resourcesPath>/icon.png via
 *   electron-builder's extraResources config.
 * - Dev build: the compiled main bundle lives at out/main/, so going up two
 *   directories reaches the project root where the source icon sits.
 */
function resolveLinuxIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon.png')
  }
  // out/main/ -> ../../ -> project root -> apps/electron/materials/icons/512x512.png
  return join(__dirname, '../../apps/electron/materials/icons/512x512.png')
}

export function getLinuxBrowserWindowOptions(
  themeId?: string,
  customThemes: TerminalColorScheme[] = []
): BrowserWindowConstructorOptions {
  const theme = resolveTheme(themeId, customThemes)
  const bg = theme.terminal.background
  return {
    // `frame: false` is the ONLY reliable way to suppress the native GTK/Mutter
    // title bar on Linux (X11 and Wayland). `titleBarStyle: 'hidden'` is a macOS
    // concept and does not remove GTK client-side decorations, resulting in a
    // double-titlebar. Our custom TopBar + linux-wc buttons replace the frame.
    frame: false,
    backgroundColor: bg,
    // Explicitly provide the window icon so the taskbar entry shows the correct
    // GyShell icon rather than the default Electron/system placeholder.
    icon: resolveLinuxIconPath(),
    autoHideMenuBar: true,
  }
}

export function applyLinuxWindowTweaks(win: BrowserWindow): void {
  // Remove the native File/Edit/View menu so it never appears
  win.removeMenu()
}
