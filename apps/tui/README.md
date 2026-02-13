# @gyshell/tui

TUI and CLI runtime workspace for GyShell.

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

## Desktop Bundled CLI

```bash
gyll --help
```

`gyll` is bundled with desktop app packaging. Install and launch GyShell desktop app once, then run `gyll` in terminal.

## Dev mode

```bash
# Run directly from source with watch mode
npm --workspace @gyshell/tui run dev
```

This does not start backend automatically. Start GyShell desktop app first.

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
