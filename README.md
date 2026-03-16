# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Local First](https://img.shields.io/badge/Workflow-Local%20First-111111?labelColor=ffffff)

Monochrome, transcript-first local UI for the real `codex app-server`.

`codex-ui` stays close to the terminal workflow instead of turning Codex into a dashboard full of cards and chrome. The app now opens on a true Home screen, lets you choose a workspace before starting a thread, keeps model and reasoning controls inside the chat input flow, and preserves the same transcript shape whether a thread is loaded from history or streaming live over WebSocket.

## Preview

| Home | Desktop Chat | Mobile Chat |
| --- | --- | --- |
| ![Home preview](./docs/preview-home.png) | ![Desktop preview](./docs/preview-desktop.png) | ![Mobile preview](./docs/preview-mobile.png) |

## UX Audit

- The app started directly in the shell, so there was no true landing step for choosing an existing thread or creating a new one.
- New thread creation could not choose a workspace up front.
- Mobile still gave too much visual weight to controls instead of the transcript.
- Loaded thread history and live updates could drift around file-change rendering.
- The build depended on remote font fetches, which broke in restricted environments.

## What Changed

- Home is first. Startup now lands on a workspace-aware thread chooser instead of dropping straight into the shell.
- New thread creation is explicit. You can set the workspace before creating a thread, with recent workspace suggestions derived from local thread history.
- The shell is flatter. Header and composer read as rails, while the transcript stays visually dominant on both desktop and mobile.
- Session controls stay in the input flow. `Model`, `Reasoning`, and `Language` live behind the composer session trigger, and `Plan` remains a dedicated toggle.
- Transcript rendering is stricter. Thread bootstrap, `thread/read`, and live events now normalize file changes through the same item path so the loaded view matches realtime output.
- Typography is local and offline-friendly. The app no longer depends on Google font fetches during build.

## Design Principles

- Transcript first. The conversation should be the biggest thing on screen.
- Home before chat. Opening the app should make thread choice and workspace choice obvious.
- No chat cards. Messages render as flat transcript rows with role labels and `---` turn separators.
- Black and white only. Contrast, spacing, and typography do the work instead of color.
- Direct session control. `Model`, `Reasoning`, `Language`, and `Plan` live in the composer.
- Same output shape everywhere. Loading a thread and watching it stream live should produce the same transcript structure.
- Hide the noise. File edits stay folded until expanded, and low-value internal chatter stays out of the way.
- Responsive by design. Mobile is not a scaled desktop layout; the shell changes shape to protect the transcript.

## Core UX

- Home screen for choosing an existing thread or starting a new workspace-bound thread.
- Real-time thread updates over WebSocket. No refresh polling.
- Flat transcript rows with grouped user and assistant messages.
- Composer session dropdowns for `Model`, `Reasoning`, and `Language`.
- Dedicated `Plan` toggle inside the input flow.
- Automatic transcript follow mode while output is streaming.
- Inline handling for approvals, file changes, permissions, and `request_user_input`.
- Searchable local thread history with workspace metadata and direct resume from Home.

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

1. Start the app and choose an existing thread from Home, or create a new one with the workspace you want.
2. Open the composer session menu to set `Model`, `Reasoning`, and `Language`.
3. Toggle `Plan` when you want plan collaboration mode for the next turn.
4. Send a message and follow the transcript live over WebSocket.
5. Expand diffs only when needed and handle approvals inline.

## Development

```bash
npm run typecheck
npm run build
npm run check
```

## Notes

- Home reads local Codex sessions, so threads from other workspaces can appear.
- Default host and port are `127.0.0.1:3000`.
- Override the port with `PORT=3001 node --import tsx server/index.ts` if needed.
