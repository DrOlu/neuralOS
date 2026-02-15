# GyShell Monorepo Architecture

This repository uses strict layering:

- `packages/*` owns implementation logic.
- `apps/*` owns composition/bootstrap/build wrappers only.

Frontend implementation does not belong to `packages/backend`.

## Runtime Surfaces

1. Electron desktop app (`apps/electron`)  
2. Standalone backend process (`apps/gybackend`, internal/development bootstrap)  
3. TUI/CLI runtime (`apps/tui`, wrapper for core TUI package)
4. Mobile web runtime (`apps/mobile-web`, wrapper for core mobile-web package)

## Workspace Layout

```text
GyShell/
├── apps/
│   ├── electron/           # Electron wrapper: entrypoints, preload, build/package configs
│   ├── gybackend/          # gybackend wrapper: process entry only
│   ├── mobile-web/         # mobile-web wrapper: vite host + thin mount entry
│   └── tui/                # tui wrapper: CLI/package entry + automation/build scripts
├── packages/
│   ├── backend/            # Backend domain/runtime core (gateway/agent/services/adapters)
│   ├── electron/           # Electron-only implementation (main bootstrap/ipc/theme/settings)
│   ├── mobile-web/         # Mobile web frontend implementation
│   ├── tui/                # TUI frontend implementation
│   ├── ui/                 # Electron renderer implementation
│   └── shared/             # Cross-surface shared modules (e.g. theme models)
├── package.json            # Workspace orchestrator scripts
└── turbo.json              # Task graph scaffold
```

## Ownership Boundaries

- `packages/backend`
  - Backend runtime logic only
  - Agent/gateway/terminal services
  - Command policy / skills / MCP core and node adapters
  - Backend types and runtime contracts
  - gybackend reusable bootstrap in `packages/backend/src/runtimes/gybackend`
- `packages/electron`
  - Electron-only runtime implementation
  - Main process bootstrap (`startElectronMain`)
  - IPC adapter / window transport
  - Electron settings/theme stores and migration
- `packages/ui`
  - Electron renderer React app
  - UI stores/components/platform views
- `packages/tui`
  - TUI/CLI implementation logic
  - Session/input/mention/slash workflows
- `packages/mobile-web`
  - Mobile web implementation logic
  - Chat/terminal/skills/settings panels and controller
- `packages/shared`
  - Shared modules used by multiple surfaces
  - Theme model and built-in scheme resolution
- `apps/electron`
  - Thin composition root (`apps/electron/src/main/index.ts`)
  - Preload bridge (`apps/electron/src/preload/*`)
  - Electron build/package config (`apps/electron/electron.vite.config.ts`, `apps/electron/electron-builder.yml`)
  - macOS signature workaround script (`apps/electron/scripts/fix-mac-signatures.sh`)
- `apps/gybackend`
  - Thin entry wrapper that calls backend package bootstrap
- `apps/tui`
  - Thin CLI wrapper entry
  - TUI automation and CLI binary build scripts
- `apps/mobile-web`
  - Thin mount entry and vite runtime config only

## Packaging/Signing Constraint

`dist:mac` keeps the existing signature workaround chain unchanged in behavior:

- `electron-builder --mac --dir`
- `apps/electron/scripts/fix-mac-signatures.sh`
- `electron-builder --mac --prepackaged ...`

This preserves the previous macOS packaging behavior while moving configuration ownership into `apps/electron`.

## Next Milestones

- Move more protocol contracts from `packages/backend` into `packages/shared`
- Add package-level unit tests for `packages/electron`, `packages/tui`, and `packages/mobile-web`
- Keep `apps/*` as pure composition shells with zero business logic duplication
