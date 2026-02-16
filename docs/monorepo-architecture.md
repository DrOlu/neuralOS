# GyShell Monorepo Architecture

GyShell uses strict layering:

- `packages/*` owns implementation and runtime logic.
- `apps/*` owns composition/bootstrap/build wrappers only.

Frontend implementation must not be placed under `packages/backend`.

## Runtime Surfaces

1. Electron desktop app (`apps/electron`)
2. Standalone backend process (`apps/gybackend`)
3. TUI runtime (`apps/tui` wrapper + `packages/tui` core)
4. Mobile-web runtime (`apps/mobile-web` wrapper + `packages/mobile-web` core)

## Workspace Layout

```text
GyShell/
├── apps/
│   ├── electron/           # thin wrapper: entry/preload/build/package config
│   ├── gybackend/          # thin wrapper: backend process entry
│   ├── mobile-web/         # thin wrapper: vite host + mount entry
│   └── tui/                # thin wrapper: CLI entry + binary build scripts
├── packages/
│   ├── backend/            # core backend runtime (agent/gateway/terminal/services)
│   ├── electron/           # electron-only implementation (main/gateway/settings/theme)
│   ├── mobile-web/         # mobile-web UI implementation
│   ├── tui/                # tui UI implementation
│   ├── ui/                 # desktop renderer UI implementation
│   └── shared/             # shared modules across surfaces
├── docs/
│   ├── monorepo-architecture.md
│   └── build-commands.md
└── package.json
```

## Ownership Boundaries

### `packages/backend`

- Owns transport-agnostic runtime core.
- `GatewayService` is the session orchestrator and event source-of-truth.
- `AgentService_v2`, `TerminalService`, `UIHistoryService`, MCP/skills/policy services live here.
- Websocket transport implementation is in backend:
  - `WebSocketGatewayAdapter` (RPC transport adapter)
  - `WebSocketGatewayControlService` (access policy + lifecycle)
- Standalone bootstrap entry:
  - `packages/backend/src/runtimes/gybackend/startGyBackend.ts`

### `packages/electron`

- Owns Electron-only runtime implementation.
- Main process composition root:
  - `startElectronMain`
- Electron IPC adapter and window transport:
  - `ElectronGatewayIpcAdapter`
  - `ElectronWindowTransport`
- Electron settings/theme migration and stores:
  - `settings/*`, `theme/*`

### `packages/ui`

- Desktop renderer React app.
- UI stores/components consume gateway updates and runtime snapshots.
- Handles profile-lock/readiness sync in chat state.

### `packages/tui`

- TUI runtime core:
  - session state
  - composer/input workflows
  - gateway client integration
- Mirrors profile-lock and readiness events from gateway updates.

### `packages/mobile-web`

- Mobile-first web client implementation.
- Main controller:
  - `useMobileController`
- Includes chat/session/tools/skills/terminal/settings panels.
- Supports tool management via gateway RPC (`tools:*`, `skills:*`, `terminal:*`).

### `packages/shared`

- Shared cross-surface modules (currently theme-centric shared models).

### `apps/*`

- Must stay thin wrappers with no business logic duplication.
- Any reusable runtime logic must be implemented in `packages/*`.

## Runtime Boot Flow (Desktop)

The desktop runtime chain is intentionally layered:

1. `apps/electron/src/main/index.ts`
2. `packages/electron/src/main/startElectronMain.ts`
3. `GatewayService` instance creation
4. Register `ElectronWindowTransport` for desktop renderer bridge
5. Create `WebSocketGatewayControlService`
6. Apply websocket policy and start `WebSocketGatewayAdapter` if enabled
7. TUI/mobile-web connect through websocket RPC surface

## Gateway and Session Invariants

- Session lifecycle is owned by `GatewayService`.
- Profile lock is set at dispatch time and released when session returns to ready state.
- UI synchronization events:
  - `SESSION_PROFILE_LOCKED`
  - `SESSION_READY`
- Terminal tab operations are exposed through transport bridges (`terminal:list`, `terminal:createTab`, `terminal:kill`, etc.).

## WebSocket Access Policy

Policy values:

- `disabled`
- `localhost` (host resolves to `127.0.0.1`)
- `internet` (host resolves to `0.0.0.0`)

Policy is controlled by:

- App settings (`gateway.ws`)
- Environment variables in standalone backend mode (`GYBACKEND_WS_*`)

## MCP Runtime Notes

`McpRuntimeCore` stdio startup hardening:

- merges required PATH entries with existing PATH
- injects absolute command directory when command path is explicit
- uses deterministic CWD fallback:
  1. explicit config `cwd`
  2. `$HOME`
  3. `process.cwd()`

This reduces "command not found" and unstable cwd behavior for MCP servers.

## Packaging / Signing Constraint

`dist:mac` chain must keep the signature workaround sequence:

1. `electron-builder --mac --dir`
2. `apps/electron/scripts/fix-mac-signatures.sh`
3. `electron-builder --mac --prepackaged ...`
