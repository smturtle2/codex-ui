# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

Minimal black-and-white local WebUI for Codex, backed by the real `codex app-server`.

Codex UI keeps the Codex workflow visible instead of hiding it behind a generic chat wrapper. Threads, turns, approvals, diffs, review, model selection, reasoning level, and plan mode stay in the browser while updates stream live over WebSocket.

## Why This Exists

- The terminal workflow is strong, but some tasks benefit from a persistent visual transcript.
- Existing chat UIs often flatten Codex into a generic assistant and bury the real execution flow.
- This project aims for a restrained browser shell: white background, black text, thin borders, no ornamental chrome.

## Highlights

- Live updates over WebSocket without page refreshes
- Monochrome transcript with `---` turn separators
- Inline composer controls for model, reasoning level, and plan mode
- Collapsed edited-content blocks that can be expanded on demand
- Thread drawer for browsing and resuming local Codex sessions
- Approval and `request_user_input` flows handled directly in the UI
- Review trigger, thread fork, interrupt, and slash commands

## Quick Start

```bash
npm run up
```

Open `http://127.0.0.1:3000` after startup.

`npm run up` installs dependencies if needed, boots the local bridge, and starts the Next.js app.

## Requirements

- Node.js 20+
- `codex` available on `PATH`
- an authenticated local Codex session

If `codex` is missing or not authenticated, the UI cannot function because it talks to the real local app-server.

## Workflow

1. Start the app with `npm run up`.
2. Open the browser UI and either create a new thread or resume an existing one from `Threads`.
3. Set `Model`, `Reasoning`, and `Plan` directly inside the composer.
4. Send a message and watch the transcript update live.
5. Expand diffs only when you want to inspect edited content.
6. Handle approvals in the modal instead of switching back to the terminal.

## Interface Map

- Header: current thread identity, workspace context, runtime state
- Transcript: user messages, assistant messages, turn boundaries, and collapsible execution events
- Composer: message input, model dropdown, reasoning dropdown, plan toggle, send and interrupt controls
- Thread Drawer: search, sort, create, and resume threads
- Overlays: transcript mirror, status summary, keyboard shortcut help
- Approval Modal: command approval, file approval, permissions, and user input

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
- `server/codex-bridge.ts` translates browser actions into real Codex app-server RPC calls over stdio
- vendored generated types keep the UI aligned with the actual Codex protocol

## Notes

- The thread drawer reads the local Codex home, so sessions from other repositories may appear.
- Default host and port are `127.0.0.1:3000`.
- Override the port with `PORT=3001 npm run up`.
