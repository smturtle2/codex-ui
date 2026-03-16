# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Workflow](https://img.shields.io/badge/Workflow-Transcript%20First-111111?labelColor=ffffff)

Monochrome, transcript-first local UI for the real `codex app-server`.

`codex-ui` stays close to the terminal workflow instead of turning Codex into a dashboard. It opens on a launcher, lets you choose a workspace before starting a thread, keeps `Model`, `Reasoning`, and `Plan` inside the composer, moves language into a separate settings panel, and streams updates over WebSocket without changing the transcript shape between history loads and realtime output.

Release notes live in [RELEASE_NOTES.md](./RELEASE_NOTES.md).

## Preview

### Desktop

<table>
  <tr>
    <td align="center"><strong>Home</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-home.png" alt="Home preview" width="100%" /></td>
    <td><img src="./docs/preview-settings.png" alt="Settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace Picker</strong></td>
    <td align="center"><strong>Desktop Chat</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-workspace.png" alt="Workspace picker preview" width="100%" /></td>
    <td><img src="./docs/preview-desktop.png" alt="Desktop chat preview" width="100%" /></td>
  </tr>
</table>

### Mobile

<table>
  <tr>
    <td align="center"><strong>Home</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-home.png" alt="Mobile home preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-settings.png" alt="Mobile settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace Picker</strong></td>
    <td align="center"><strong>Chat</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-workspace.png" alt="Mobile workspace picker preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-chat.png" alt="Mobile chat preview" width="100%" /></td>
  </tr>
</table>

## Highlights

- Launcher-first flow: open an existing thread or start a new one from a dedicated home screen.
- Consistent new-thread flow: slash commands return to the launcher so workspace selection stays part of starting a new thread.
- Mobile quick start: keep `Start thread` and workspace selection visible above the thread list on narrow screens.
- Workspace picker: choose directories from a dedicated browser, keep the last selected workspace, and prioritize real project folders over generated directories.
- Transcript-first shell: the chat area stays dominant, messages stay flat, and turns are separated by a slim visual rule instead of literal text.
- Direct session controls: `Model`, `Reasoning`, and `Plan` stay in the composer, with a compact mobile strip and an immediate `Plan` toggle.
- Separate settings panel: interface language lives in a dedicated settings surface instead of the chat input.
- Realtime consistency: `thread/read`, bootstrap hydration, and live streaming normalize into the same transcript structure while preserving approval insertion points and stable entry metadata.
- Mobile-aware layout: home exposes both thread selection and new-thread controls immediately, chat opens scrolled to the latest output, hides redundant idle chrome on phones, and settings/workspace surfaces turn into phone-friendly sheets.
- Tailscale Funnel flag: expose the local UI on the public internet with a single command by adding `--funnel`.
- Deterministic previews: README screenshots come from a built-in demo state instead of live local thread content.

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
- for `--funnel`: `tailscale`, `bash`, `python`, and `curl`

## Quick Start

```bash
npm run up
```

Open `http://127.0.0.1:3000`.

## External Access

Use Tailscale Funnel to expose the local UI publicly in one line:

```bash
npm run up -- --funnel
```

- `--funnel` also works with `npm run dev -- --funnel` and `npm run start -- --funnel`.
- `npm run up -- --funnel` installs dependencies, starts the local server, and then runs the repo-local Funnel helper against `http://127.0.0.1:3000`.
- If Funnel is not enabled for the current tailnet node yet, the helper prints the exact enable URL.
- `npm run funnel:status` shows the current Funnel mapping.
- `npm run funnel:off` resets the Funnel config for this node.

Reference:
- [Tailscale Funnel docs](https://tailscale.com/kb/1223/tailscale-funnel/)
- [Tailscale CLI funnel reference](https://tailscale.com/docs/reference/tailscale-cli/funnel)

## Development

```bash
npm run typecheck
npm run build
npm run check
python scripts/generate_preview_images.py
```

`python scripts/generate_preview_images.py` refreshes the desktop and mobile screenshots used in this README.
It opens `/?demo=1`, so preview assets stay stable and do not depend on your real local transcript history.
