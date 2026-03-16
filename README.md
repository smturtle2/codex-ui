# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Workflow](https://img.shields.io/badge/Workflow-Transcript%20First-111111?labelColor=ffffff)

Monochrome, transcript-first local UI for the real `codex app-server`.

`codex-ui` stays close to the terminal workflow instead of turning Codex into a dashboard. It opens on a launcher, lets you choose a workspace before starting a thread, keeps session controls directly in the chat input, and streams updates over WebSocket without changing the transcript shape between history loads and realtime output.

Release notes live in [RELEASE_NOTES.md](./RELEASE_NOTES.md).

## Preview

| Home | Workspace Picker |
| --- | --- |
| ![Home preview](./docs/preview-home.png) | ![Workspace picker preview](./docs/preview-workspace.png) |

| Desktop Chat | Mobile Chat |
| --- | --- |
| ![Desktop chat preview](./docs/preview-desktop.png) | ![Mobile chat preview](./docs/preview-mobile.png) |

## Highlights

- Launcher-first flow: open an existing thread or start a new one from a dedicated home screen.
- Workspace picker: choose directories from a dedicated browser instead of typing raw paths.
- Transcript-first shell: the chat area stays dominant, messages stay flat, and turns are separated by `---`.
- Direct session controls: `Model`, `Reasoning`, `Language`, and `Plan` sit in the composer instead of hiding behind a separate dashboard.
- Realtime consistency: `thread/read`, bootstrap hydration, and live streaming normalize into the same transcript structure.
- Mobile-aware layout: the launcher and shell reflow for narrow screens instead of just shrinking the desktop view.

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
       └─ shared normalization for bootstrap, thread/read, and live deltas
```

## Requirements

- Node.js 20+
- `codex` on `PATH`
- an authenticated local Codex session

## Quick Start

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Development

```bash
npm run typecheck
npm run build
npm run check
```
