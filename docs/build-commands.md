# Build Commands

This page maps root scripts and workspace scripts to their runtime ownership.

## Root Scripts (`package.json`)

### Development

- `npm run dev`
  - Electron dev mode (`apps/electron/electron.vite.config.ts`).
- `npm run dev:electron`
  - Alias of `npm run dev`.
- `npm run dev:mobile-web`
  - Mobile-web dev server (`apps/mobile-web` wrapper, implementation in `packages/mobile-web`).
- `npm run dev:tui`
  - TUI development wrapper (`@gyshell/tui`).
- `npm run start:tui`
  - Start TUI runtime without dev watch mode.
- `npm run start:backend`
  - Start standalone gybackend runtime (`@gyshell/gybackend`).

### Build

- `npm run build`
  - Electron production build.
- `npm run build:electron`
  - Alias of `npm run build`.
- `npm run build:backend`
  - Build `@gyshell/gybackend` wrapper.
- `npm run build:tui`
  - Build `@gyshell/tui` wrapper.
- `npm run build:mobile-web`
  - Build `@gyshell/mobile-web` wrapper.
- `npm run build:all`
  - Build Electron + backend + TUI wrappers.
- `npm run build:cli-binaries`
  - Build platform CLI binaries for `gyll` (`apps/tui/scripts/build-cli-binaries.ts`).
- `npm run prepare:cli-runtime`
  - Prepare desktop-bundled CLI runtime under `apps/electron/cli-runtime`.
  - Optional target override:
    - `npm run prepare:cli-runtime -- --target darwin-arm64`
    - `npm run prepare:cli-runtime -- --target darwin-x64`
    - `npm run prepare:cli-runtime -- --target linux-arm64`
    - `npm run prepare:cli-runtime -- --target linux-x64`
    - `npm run prepare:cli-runtime -- --target windows-x64`

### Quality / Tests

- `npm run typecheck`
  - Combined node/web typecheck (`tsconfig.node.json` + `tsconfig.web.json`).
- `npm run typecheck:all`
  - Root typecheck + backend + TUI + mobile-web.
- `npm run typecheck:backend`
- `npm run typecheck:tui`
- `npm run typecheck:mobile-web`
- `npm run test:backend-regression`
- `npm run test:backend-extreme`
- `npm run test:tui`
- `npm run test:tui-input-automation`

### Packaging

- `npm run dist`
  - Build backend + Electron + bundled CLI runtime, then package via `apps/electron/electron-builder.yml`.
- `npm run dist:mac`
  - macOS packaging chain:
    1. Build backend + Electron + mac CLI runtime
    2. `electron-builder --mac --dir`
    3. `apps/electron/scripts/fix-mac-signatures.sh`
    4. `electron-builder --mac --prepackaged ...`
- `npm run dist:win`
  - Build backend + Electron + Windows CLI runtime, then package Windows targets.

---

## Desktop Bundled CLI (`gyll`)

After desktop runtime setup:

- `gyll --help`
- `gyll --url 127.0.0.1:17888`
- `gyll --url 127.0.0.1:17888 "message"`
- `gyll run --url 127.0.0.1:17888 "message"`
- `gyll hook --url 127.0.0.1:17888 "message"`

If `--url` is omitted, `gyll` attempts local desktop backend on default port `17888`.

---

## Standalone Backend Runtime (gybackend)

Runtime entry: `packages/backend/src/runtimes/gybackend/startGyBackend.ts`

Common environment variables:

- `GYBACKEND_WS_ENABLE`
  - Enable/disable websocket endpoint (`true`/`false`).
- `GYBACKEND_WS_HOST`
  - Host policy input (`127.0.0.1`, `localhost`, `::1`, `0.0.0.0`, etc.).
- `GYBACKEND_WS_PORT`
  - Websocket port (default `17888`).
- `GYBACKEND_DATA_DIR`
  - Data directory override.
- `GYBACKEND_BOOTSTRAP_LOCAL_TERMINAL`
  - Auto-create local terminal at startup (`true` by default).
- `GYBACKEND_TERMINAL_ID`
- `GYBACKEND_TERMINAL_TITLE`
- `GYBACKEND_TERMINAL_CWD`
- `GYBACKEND_TERMINAL_SHELL`

Access policy mapping is handled by `WebSocketGatewayControlService`:

- `disabled`
- `localhost`
- `internet`

---

## Workspace Scripts (Development/Internal)

- `npm --workspace @gyshell/gybackend run build|start|typecheck`
- `npm --workspace @gyshell/tui run build|build:cli-binaries|dev|start|typecheck|test:smoke`
- `npm --workspace @gyshell/mobile-web run dev|build|preview|typecheck`
- `npm --workspace @gyshell/electron run dev|build|preview`
- `npm --workspace @gyshell/backend run build|typecheck`
- `npm --workspace @gyshell/tui-core run build|typecheck`
- `npm --workspace @gyshell/mobile-web-core run build|typecheck`
- `npm --workspace @gyshell/ui run build|typecheck`
- `npm --workspace @gyshell/shared run build|typecheck`
