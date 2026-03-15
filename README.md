# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

Monochrome local WebUI for Codex, backed by the real `codex app-server`.

Codex UI keeps Codex closer to its native workflow instead of flattening it into a generic chat shell. Threads, approvals, model selection, reasoning level, plan mode, and live transcript updates stay visible in one restrained black-and-white interface.

## Preview

| Desktop | Mobile |
| --- | --- |
| ![Desktop preview](./docs/preview-desktop.png) | ![Mobile preview](./docs/preview-mobile.png) |

## Why

- The terminal workflow is strong, but long-running sessions benefit from a readable visual transcript.
- Many chat wrappers hide the actual execution flow behind decorative UI and noisy activity cards.
- This project aims for the opposite: white background, black text, thin borders, compact density, live streaming, and no unnecessary chrome.

## Highlights

- Live updates over WebSocket with no page refresh workflow
- Composer-level controls for `Model`, `Reasoning`, and `Plan`
- `---` turn separators with grouped chat messages instead of repetitive per-message cards
- Hidden diffs that stay collapsed until you open them
- Success command logs suppressed from the main transcript to keep the conversation readable
- Thread drawer with internal scrolling and mobile-friendly layout
- Approval and `request_user_input` handling directly in the browser

## Interface

| Surface | Purpose |
| --- | --- |
| Header | Current thread, workspace context, connection/runtime state |
| Transcript | Grouped user/assistant messages, turn boundaries, collapsible plan/diff events |
| Composer | Message input plus model dropdown, reasoning dropdown, and plan toggle |
| Thread Drawer | Search, sort, create, and resume local Codex sessions |
| Approval Modal | Command approval, file edits, permission requests, and user input |

## Quick Start

```bash
npm run up
```

Open `http://127.0.0.1:3000` after startup.

`npm run up` installs dependencies if needed, starts the local bridge, and boots the Next.js app.

## Requirements

- Node.js 20+
- `codex` available on `PATH`
- an authenticated local Codex session

If `codex` is missing or not authenticated, the UI cannot function because it talks to the real local app-server.

## Workflow

1. Start the app with `npm run up`.
2. Open an existing thread from `Threads` or start a new one.
3. Set `Model`, `Reasoning`, and `Plan` directly in the composer.
4. Send a message and watch the transcript update over WebSocket.
5. Expand diffs only when needed and handle approvals inside the modal.

## Keyboard Shortcuts

- `Enter` sends the current turn
- `Shift+Enter` inserts a newline
- `Esc` closes overlays, hides slash suggestions, or interrupts the active turn
- `Ctrl/Cmd+T` opens the transcript overlay
- `?` opens shortcut help

## Development

```bash
npm run dev
npm run typecheck
npm run build
npm run check
```

## Architecture

- Next.js renders the client UI
- a local Node server exposes browser-facing HTTP and WebSocket endpoints
- [`server/codex-bridge.ts`](./server/codex-bridge.ts) translates browser actions into real Codex app-server RPC calls over stdio
- vendored generated types keep the UI aligned with the current Codex protocol

## Notes

- The thread drawer reads the local Codex home, so sessions from other repositories may appear.
- Default host and port are `127.0.0.1:3000`.
- Override the port with `PORT=3001 npm run up`.
