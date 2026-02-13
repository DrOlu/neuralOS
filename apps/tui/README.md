# @gyshell/tui

Standalone terminal UI client for GyShell gateway.

## Features

- Chat-first TUI workflow (no terminal tab content rendering)
- Gateway websocket auto-discovery on localhost (`ws://127.0.0.1:17888`)
- Fallback manual endpoint prompt when local gateway is unavailable
- Startup session recovery picker (list recovered sessions and choose one to restore)
- Profile switching, session switching, and slash-command actions
- Compact tool-call rendering optimized for small terminal viewports

## Run

```bash
npm --workspace @gyshell/tui run start
```

## Install as CLI (npm global)

```bash
npm install -g @gyshell/tui
```

Then use:

```bash
gyll --help
```

The npm entry package is a thin wrapper. It resolves and executes the current platform binary package (`@gyshell/tui-<platform>-<arch>`).

## Dev mode

```bash
# Run directly from source with watch mode
npm --workspace @gyshell/tui run dev
```

This does not start backend automatically. Start Electron app or backend service manually.

## Smoke test

```bash
npm --workspace @gyshell/tui run test:smoke
```

## CLI usage

- `gyll [--url 127.0.0.1:17888] [--timeout 3000] [--sessionid <id>]`
- `gyll [--url 127.0.0.1:17888] [--timeout 3000] "message"`
- `gyll run [--url 127.0.0.1:17888] [--timeout 3000] "message"`
- `gyll hook [--url 127.0.0.1:17888] [--timeout 3000] "message"`

## CLI options

- `--url`: gateway websocket endpoint (`ip:port` or `ws://ip:port`)
- `--sessionid`: prefer this session id when entering TUI
- `--timeout`: probe/connect timeout in milliseconds (default `3000`)
- `--help`, `-h`: print help

Notes:
- If `--url` is not provided, TUI probes localhost endpoints first, then prompts for manual input if no endpoint responds.
- `run` mode does not enter TUI and streams AI output directly to terminal.
- `hook` mode does not enter TUI; it sends one message and exits immediately while the backend continues running.
