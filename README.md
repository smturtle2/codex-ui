# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Local First](https://img.shields.io/badge/Workflow-Local%20First-111111?labelColor=ffffff)

Monochrome local chat UI for the real `codex app-server`.

This project keeps Codex close to its native workflow instead of disguising it as a generic chatbot. The shell stays restrained: white background, black type, thin borders, live streaming, hidden diffs by default, and session controls placed directly next to the message box.

## Preview

| Desktop | Mobile |
| --- | --- |
| ![Desktop preview](./docs/preview-desktop.svg) | ![Mobile preview](./docs/preview-mobile.svg) |

## Why This Exists

- Long-running Codex sessions benefit from a readable transcript, not a dashboard full of noise.
- Most wrappers bury model settings, plan mode, and approvals behind unrelated chrome.
- This UI keeps the important controls near the composer and gets out of the way everywhere else.

## Product Direction

- `Session` dropdown inside the composer for `Model`, `Reasoning`, `Transcript`, `Status`, and `Shortcuts`
- direct select controls inside `Session` instead of nested mini-menus
- separate `Plan` toggle button that stays visible even when the dropdown is closed
- inline live status under the message box instead of a second status card
- grouped user and assistant messages with `---` turn separators only
- hidden edited content and hidden reasoning summaries unless you explicitly expand them
- automatic transcript follow mode while live output is streaming
- mobile layout that prioritizes the input area instead of turning controls into a giant settings slab

## Highlights

- Real-time updates over WebSocket. No refresh loop.
- Minimal transcript filtering. Success noise stays hidden; errors and pending approvals stay visible.
- Local thread drawer for resume, search, sort, and new-thread creation.
- Inline approval handling for commands, file edits, permissions, and `request_user_input`.
- Works directly against the local Codex bridge and generated protocol types in this repo.

## Architecture

```text
Browser UI
  ├─ Next.js app router shell
  ├─ WebSocket snapshot stream (/ws)
  └─ HTTP actions (/api/*)

Local bridge
  ├─ server/index.ts
  └─ server/codex-bridge.ts
       └─ codex app-server over stdio JSON-RPC
```

## Quick Start

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Requirements

- Node.js 20+
- `codex` on `PATH`
- an authenticated local Codex session

## Workflow

1. Start the app and open a thread from `Threads`, or create a fresh one.
2. Open `Session` next to the composer to set `Model` and `Reasoning`.
3. Toggle `Plan` if you want plan collaboration mode for the next turn.
4. Send a message and follow the transcript live over WebSocket.
5. Expand diffs only when needed and handle approvals in-place.

## Development

```bash
npm run typecheck
npm run build
npm run check
```

## Notes

- The thread drawer reads local Codex sessions, so threads from other workspaces can appear.
- Default host and port are `127.0.0.1:3000`.
- Override the port with `PORT=3001 node --import tsx server/index.ts` if needed.
