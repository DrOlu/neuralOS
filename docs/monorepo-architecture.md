# GyShell Monorepo Architecture (Current Stage)

This repository now supports three runtime shapes:

1. Electron app (current core, unchanged build/sign pipeline)
2. Standalone backend service (`@gyshell/gybackend`)
3. Standalone TUI package placeholder (`@gyshell/tui`)

## Workspace Layout

```text
GyShell/
├── apps/
│   ├── gybackend/
│   └── tui/
├── packages/
│   └── shared/
├── src/                    # Existing Electron runtime (kept in place intentionally)
├── package.json            # Workspace root + Electron app package
└── turbo.json              # Task graph scaffold
```

## Why Electron stays at root for now

The macOS distribution flow includes a signature workaround chain:

- `electron-builder --mac --dir`
- `scripts/fix-mac-signatures.sh`
- `electron-builder --mac --prepackaged ...`

Moving Electron into `apps/electron` in this stage would increase risk of breaking notarization/Gatekeeper behavior. The current migration keeps the packaging chain unchanged while adding new app shapes.

## Electron-only migration module

Electron app startup now runs a dedicated migration module before service initialization:

- `src/main/services/settings/ElectronAppSettingsMigrationService.ts`

Responsibilities:

- Read legacy `gyshell-settings`
- Migrate into `gyshell-backend-settings` and `gyshell-ui-settings`
- Persist normalized schema snapshots before the rest of Electron services boot
- Backup legacy file and clean it up after successful migration

This migration module is Electron runtime only. Standalone `gybackend` does not execute this startup migration path.

## gybackend runtime

`gybackend` reuses existing backend runtime components:

- `TerminalService`
- `AgentService_v2`
- `GatewayService`
- `WebSocketGatewayAdapter`

Node-specific adapters were added for:

- Settings persistence (`NodeSettingsService`)
- Command policy (`NodeCommandPolicyService`)
- Skills (`NodeSkillService`)
- MCP compatibility stub (`NodeMcpToolService`)

## Next extraction milestones

- Move reusable backend code from `src/main/services` into dedicated `packages/backend-core`
- Replace MCP stub with full non-Electron MCP runtime in backend-core
- Implement `@gyshell/tui` client on top of websocket gateway protocol
- Add `gybackend`-to-`gybackend` node connection protocol in `packages/shared`
