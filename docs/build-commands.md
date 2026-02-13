# Build Commands

## Root (`package.json`)

- `npm run dev`
  - Electron dev mode using `apps/electron/electron.vite.config.ts`.
- `npm run build`
  - Electron build using `apps/electron/electron.vite.config.ts`.
- `npm run build:backend`
  - Build standalone backend workspace `@gyshell/gybackend`.
- `npm run build:tui`
  - Build standalone TUI workspace `@gyshell/tui`.
- `npm run build:cli-binaries`
  - Compile standalone CLI binaries via Bun (`apps/tui/scripts/build-cli-binaries.ts`).
- `npm run build:all`
  - Build Electron + backend + TUI.
- `npm run prepare:cli-runtime`
  - Compile desktop-bundled CLI binary runtime under `apps/electron/cli-runtime`.
  - Optional target override: `npm run prepare:cli-runtime -- --target windows-x64` (also supports `darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`).
- `npm run typecheck:all`
  - Typecheck Electron node/web + backend + TUI.
- `npm run test:backend-regression`
  - Backend regression test suite.
- `npm run test:backend-extreme`
  - Backend extreme-path test suite.

## Dist / Packaging

- `npm run dist`
  - Build backend + Electron + compiled CLI runtime, then package via `apps/electron/electron-builder.yml`.
- `npm run dist:mac`
  - Build backend + Electron, then run macOS packaging flow:
  1. Build bundled CLI runtime
  2. `electron-builder --mac --dir`
  3. `apps/electron/scripts/fix-mac-signatures.sh`
  4. `electron-builder --mac --prepackaged ...`
- `npm run dist:win`
  - Build backend + Electron + compiled Windows CLI runtime, package Windows targets.

## Global CLI Install

- `npm install -g @gyshell/tui`
  - Installs `gyll` / `gyll-tui` command globally.

## Workspace Commands

- `npm --workspace @gyshell/gybackend run build|start|typecheck`
- `npm --workspace @gyshell/tui run build|build:cli-binaries|dev|start|typecheck|test:smoke`
- `npm --workspace @gyshell/backend run build|typecheck`
- `npm --workspace @gyshell/ui run build|typecheck`
- `npm --workspace @gyshell/shared run build|typecheck`
