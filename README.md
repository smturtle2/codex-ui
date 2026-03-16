# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Local First](https://img.shields.io/badge/Workflow-Local%20First-111111?labelColor=ffffff)

Monochrome, transcript-first local UI for the real `codex app-server`.

`codex-ui` stays close to the terminal workflow instead of turning Codex into a dashboard full of cards and chrome. The interface is deliberately strict: white background, black type, thin rails, direct controls inside the composer, live WebSocket updates, hidden diffs by default, and a transcript that stays dominant on both desktop and mobile.

## Preview

| Desktop | Mobile |
| --- | --- |
| ![Desktop preview](./docs/preview-desktop.png) | ![Mobile preview](./docs/preview-mobile.png) |

## UX Audit

- The composer previously read like a bottom card, which made the UI feel control-heavy instead of transcript-first.
- Mobile layout was functional, but the conversation still needed more visual priority than the session controls.
- The font stack depended too much on local availability, so mixed English/Korean rendering was not reliably consistent.
- Loaded thread history and live updates needed to stay visually identical, especially around bootstrap hydration and file-change rendering.

## What Changed

- The shell is flatter. The header and composer now read as rails instead of stacked cards, so the transcript feels like the primary surface.
- Mobile is more adaptive. Session controls collapse into a compact summary row, while the transcript keeps the largest share of vertical space.
- Fonts are loaded intentionally with `next/font` using `IBM Plex Sans KR` and `IBM Plex Mono` for stable bilingual rendering.
- The composer remains direct. `Model`, `Reasoning`, `Language`, and the `Plan` toggle stay in the input flow instead of being buried in menus.
- Transcript rendering stays stable. Thread bootstrap, `thread/read`, and live deltas all pass through the same normalization path.
- Low-signal noise stays folded. Diffs start hidden, reasoning and plan traces stay out of the way unless they matter, and runtime chatter does not dominate the page.

## Design Principles

- Transcript first. The conversation should be the biggest thing on screen.
- No chat cards. Messages render as flat transcript rows with role labels and `---` turn separators.
- Black and white only. Contrast, spacing, and typography do the work instead of color.
- Direct session control. `Model`, `Reasoning`, `Language`, and `Plan` live in the composer.
- Same output shape everywhere. Loading a thread and watching it stream live should produce the same transcript structure.
- Hide the noise. File edits stay folded until expanded, and low-value internal chatter stays out of the way.
- Responsive by design. Mobile is not a scaled desktop layout; the shell changes shape to protect the transcript.

## Core UX

- Real-time thread updates over WebSocket. No refresh polling.
- Flat transcript rows with grouped user and assistant messages.
- Visible composer dropdowns for `Model`, `Reasoning`, and `Language`.
- Dedicated `Plan` toggle inside the input flow.
- Automatic transcript follow mode while output is streaming.
- Inline handling for approvals, file changes, permissions, and `request_user_input`.
- Local thread drawer for search, sorting, resume, and fresh-thread creation.

## Architecture

```text
Browser UI
  ├─ Next.js app router shell
  ├─ WebSocket snapshot stream (/ws)
  └─ HTTP actions (/api/*)

Local bridge
  ├─ server/index.ts
  └─ server/codex-bridge.ts
       ├─ codex app-server over stdio JSON-RPC
       └─ shared normalization for bootstrap hydration, thread/read, and live deltas
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

1. Start the app and open an existing thread from `Threads`, or create a fresh one.
2. Set `Model`, `Reasoning`, and `Language` directly in the composer control strip.
3. Toggle `Plan` when you want plan collaboration mode for the next turn.
4. Send a message and follow the transcript live over WebSocket.
5. Open `Status` or `Shortcuts` only when needed; the transcript remains the main surface.
6. Expand diffs only when needed and handle approvals inline.

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
