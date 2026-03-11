#!/bin/bash
# Post-install script for the .deb package.
#
# 1. Restore chrome-sandbox SUID permissions (required for Electron's sandbox).
#    electron-builder's default postinst does this, but `afterInstall` replaces
#    it so we must re-include the step here.
# 2. Work around electron-builder's known 0x0 icon-size bug (#5294)
#    by copying the bundled icon into the correct hicolor directory.

# ── Chrome sandbox SUID ─────────────────────────────────────────────────────
SANDBOX="/opt/GyShell/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX"
  chmod 4755 "$SANDBOX"
fi

# ── Icon fix ─────────────────────────────────────────────────────────────────
ICON_SOURCE="/opt/GyShell/resources/icon.png"
ICON_TARGET_DIR="/usr/share/icons/hicolor/512x512/apps"
ICON_TARGET="$ICON_TARGET_DIR/gyshell.png"

if [ -f "$ICON_SOURCE" ]; then
  mkdir -p "$ICON_TARGET_DIR"
  cp "$ICON_SOURCE" "$ICON_TARGET"
fi

# Remove any broken 0x0 icon directory that electron-builder may have created
if [ -d "/usr/share/icons/hicolor/0x0" ]; then
  rm -rf "/usr/share/icons/hicolor/0x0"
fi

# Refresh the icon cache so GNOME picks up the new icon
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor/ 2>/dev/null || true
fi
