# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Local First](https://img.shields.io/badge/Workflow-Local%20First-111111?labelColor=ffffff)

Monochrome, chat-first local UI for the real `codex app-server`.

This project keeps Codex close to its native workflow instead of disguising it as a generic chatbot. The shell stays restrained: white background, black type, thin borders, live streaming, hidden diffs by default, language-aware UI copy, and session controls placed directly next to the message box.

## Preview

| Desktop | Mobile |
| --- | --- |
| ![Desktop preview](./docs/preview-desktop.png) | ![Mobile preview](./docs/preview-mobile.png) |

## Why This Exists

- Long-running Codex sessions benefit from a readable transcript, not a dashboard full of noise.
- Most wrappers bury model settings, plan mode, and approvals behind unrelated chrome.
- This UI keeps the important controls near the composer and gets out of the way everywhere else.

## Product Direction

- `Session` dropdown inside the composer for `Model`, `Reasoning`, and `Language`, with `Status` and `Shortcuts` as lightweight overlays
- dedicated `Plan` toggle button next to the dropdown so planning mode is still one click away
- transcript stays on the main surface instead of duplicating it in another overlay
- grouped user and assistant messages with `---` turn separators only
- edited content stays folded by default, and noisy reasoning or runtime events stay visually de-emphasized
- automatic follow mode while live output is streaming over WebSocket
- mobile layout keeps the transcript taller than the composer while stacking controls cleanly on narrow screens

## Highlights

- Real-time updates over WebSocket. No refresh loop.
- Chat-first layout with restrained chrome on both desktop and mobile.
- Persistent UI language switch with `System`, `English`, and `Korean`, including `<html lang>` updates.
- Minimal transcript filtering. Success noise stays hidden; errors and pending approvals stay visible.
- Local thread drawer for resume, search, sort, and new-thread creation.
- Inline session controls for model, reasoning, language, plan mode, runtime status, and shortcuts.
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
2. Open `Session` beside the composer to set `Model`, `Reasoning`, and `Language`.
3. Toggle `Plan` beside it if you want plan collaboration mode for the next turn.
4. Use `Status` or `Shortcuts` only when needed; the transcript stays on the main surface.
5. Send a message and follow the transcript live over WebSocket.
6. Expand diffs only when needed and handle approvals in-place.

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
