# WebPty

[English](./README.md) | [한국어](./README.ko.md)

![Rust](https://img.shields.io/badge/Runtime-Rust-111111?logo=rust&labelColor=ffffff)
![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-111111?logo=nextdotjs&labelColor=ffffff)
![Theme](https://img.shields.io/badge/Theme-Windows%2011%20Terminal-111111?labelColor=ffffff)
![Config](https://img.shields.io/badge/Config-Windows%20Terminal%20JSON-111111?labelColor=ffffff)

`webpty` is a Windows Terminal-inspired Codex shell with a Rust runtime, a narrow right-side tab rail, a full-screen black terminal surface, and Windows Terminal-compatible `settings.json` profile/theme editing.

The UI stays flat and monochrome by default: black terminal body, white right tabs, no gradient chrome, and `Cascadia Mono` as the default font. Settings are edited from the right-side Settings tab and stored in a Windows Terminal-shaped JSON file.

Release notes live in [RELEASE_NOTES.md](./RELEASE_NOTES.md).

## Preview

### Desktop

<table>
  <tr>
    <td align="center"><strong>Shell</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-home.png" alt="Shell preview" width="100%" /></td>
    <td><img src="./docs/preview-settings.png" alt="Settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace</strong></td>
    <td align="center"><strong>Threads</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-workspace.png" alt="Workspace preview" width="100%" /></td>
    <td><img src="./docs/preview-desktop.png" alt="Threads preview" width="100%" /></td>
  </tr>
</table>

### Mobile

<table>
  <tr>
    <td align="center"><strong>Shell</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-home.png" alt="Mobile shell preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-settings.png" alt="Mobile settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace</strong></td>
    <td align="center"><strong>Threads</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-workspace.png" alt="Mobile workspace preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-chat.png" alt="Mobile threads preview" width="100%" /></td>
  </tr>
</table>

## Highlights

- Rust entrypoint: `webpty up` is the primary runtime and external HTTP surface.
- Windows Terminal-style layout: full-screen transcript, no top bar, narrow right-side tab rail.
- Windows Terminal JSON settings: compatible `defaultProfile`, `profiles`, `schemes`, `theme`, and `themes` flow through the Settings tab.
- Default visual contract: black terminal surface, white rail tabs, flat borders, `Cascadia Mono`.
- Tailscale Funnel: `webpty up --funnel` starts the app and tries to publish it immediately.
- Workspace-first thread flow: new threads still validate and browse directories before starting.
- Static frontend export: the Next.js shell builds to `out/` so the Rust runtime can serve it directly.

## Architecture

```text
Browser UI
  ├─ static Next.js export (out/)
  ├─ HTTP actions (/api/*)
  └─ WebSocket snapshots (/ws)

Rust runtime
  ├─ webpty up
  ├─ serves static frontend
  ├─ owns Funnel startup
  └─ proxies /api/* and /ws to the local legacy bridge

Legacy bridge
  ├─ server/legacy-bridge.ts
  └─ server/codex-bridge.ts
       ├─ codex app-server over stdio JSON-RPC
       └─ snapshot normalization for threads, turns, approvals, and live deltas
```

## Requirements

- Rust toolchain with `cargo`
- Node.js 20+
- `codex` on `PATH`
- an authenticated local Codex session
- for `--funnel`: `tailscale`

## Global Install

Install globally in one command:

```bash
cargo install --git https://github.com/smturtle2/codex-ui webpty
```

If you are working from a local clone, this is equivalent:

```bash
cargo install --path .
```

## Quick Start

```bash
webpty up
```

Open `http://127.0.0.1:3000`.

## External Access

Publish the local shell through Tailscale Funnel:

```bash
webpty up --funnel
```

- If Funnel setup succeeds, the runtime prints the public URL.
- If Funnel setup fails, the local shell stays up and only the public exposure step fails.
- If Funnel is not enabled for the current node yet, `webpty` prints the enable URL.
- If Tailscale rejects local serve config updates, run `sudo tailscale set --operator=$USER` once or run the Funnel command as a user that already has serve access.

Reference:
- [Tailscale Funnel docs](https://tailscale.com/kb/1223/tailscale-funnel/)
- [Tailscale CLI funnel reference](https://tailscale.com/docs/reference/tailscale-cli/funnel)

## Development

```bash
npm run typecheck
npm run build
cargo check
cargo run -- up --port 3000
python scripts/generate_preview_images.py
```

`npm run build` exports the frontend to `out/`. `cargo run -- up` serves that export through the Rust runtime.

`python scripts/generate_preview_images.py` refreshes the screenshots in `docs/` from `/?demo=1`.
