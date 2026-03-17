# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Workflow](https://img.shields.io/badge/Workflow-Transcript%20First-111111?labelColor=ffffff)

Monochrome, transcript-first local UI for the real `codex app-server`.

`codex-ui` stays close to the terminal workflow instead of turning Codex into a dashboard. Home opens first, keeps new-thread workspace setup and existing threads in the same launcher, stacks that flow cleanly on mobile, keeps `Model`, `Reasoning`, `Fast`, and `Plan` controls inside the chat composer, moves language into a separate settings panel, and streams revisioned snapshots over WebSocket so stale client state is ignored instead of retried in a loop.

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

- Launcher-first workflow: Home opens first, keeps workspace picking and thread switching together, and lets mobile stack those two jobs without hiding one behind a second screen.
- Transcript-first chat: messages stay flat, edited content stays folded by default, and the mobile header/composer trim down so the transcript remains the largest surface.
- In-composer session control: `Model` and `Reasoning` stay as dropdowns in the chat input area, while `Fast` and `Plan` are explicit on/off toggles instead of one inverted switch.
- Separate settings surface: interface language lives in its own settings panel, not inside the composer or thread launcher.
- Dedicated workspace picker: new threads start from a directory browser, and the server validates the chosen workspace before creating the thread.
- Realtime consistency: bootstrap, `thread/read`, manual actions, and live streaming all converge into the same transcript structure, and live diff/plan updates are rehydrated through canonical thread reads.
- Active empty thread support: starting a fresh thread no longer drops back to `No active session` before the first user turn is sent.
- Manual reconnect only: the socket does not spin in a reconnect loop; disconnects surface a clear manual reconnect action instead.
- One-line Funnel startup: `npm run up --funnel` starts the app, enables Tailscale Funnel, and prints the public URL directly in the terminal.
- Deterministic previews: `python scripts/generate_preview_images.py` captures README screenshots from `/?demo=1`.

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
npm run up --funnel
```

- `--funnel` also works with `npm run dev --funnel` and `npm run start --funnel`.
- `npm run up --funnel` installs dependencies, starts the local server, and then runs the repo-local Funnel helper against `http://127.0.0.1:3000`.
- On success, the helper prints `Public URL: https://...` so the external address is immediately copyable.
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
python -m pip install playwright
python -m playwright install chromium
python scripts/generate_preview_images.py
```

`python scripts/generate_preview_images.py` refreshes the desktop and mobile screenshots used in this README.
It opens `/?demo=1`, so preview assets stay stable and do not depend on your real local transcript history.
