# @gyshell/mobile-web

Standalone mobile-first web frontend for GyShell.

## Purpose

- Track progress of multiple sessions
- Send prompts from phone with `@` terminal/skill mention suggestions
- Reply permission asks (allow / deny)
- No terminal rendering
- Mobile-first HCI with bottom tabs: `Chat / Terminal / Skills / Settings`

## Run

```bash
npm run dev:mobile-web
```

Then open `http://<your-host-ip>:5174` on mobile.

## Build

```bash
npm run build:mobile-web
```

## Gateway requirement

- WebSocket gateway must be reachable by mobile device.
- For desktop app runtime, set gateway access to `internet` and confirm the port (default `17888`).
- Configure gateway URL inside the in-app `Settings` sheet.
