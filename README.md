# Codex WebUI

[English](./README.md) | [한국어](./README.ko.md)

Terminal-faithful local WebUI for Codex.

Codex WebUI runs a real `codex app-server` locally and puts a browser shell on top of it. The goal is not to turn Codex into a generic chat app. The goal is to keep the TUI workflow model visible in the browser: threads, turns, approvals, diffs, review, logs, and runtime state.

## Quick Start

Run this from the repository root:

```bash
npm run up
```

Then open `http://127.0.0.1:3000`.

`npm run up` installs dependencies if needed and starts the local bridge plus the Next.js app.

## Requirements

- Node.js 20 or newer
- `codex` installed and available on `PATH`
- a working local Codex login state

If `codex` is not installed or not authenticated, the WebUI cannot start because it talks to the real local `codex app-server`.

## What Works Right Now

- local Node bridge connected to `codex app-server --listen stdio://`
- browser UI with a terminal-style shell
- transcript timeline for thread and turn activity
- bottom composer with slash commands
- resume picker for existing local Codex sessions
- model and reasoning effort picker
- thread fork, inline review trigger, interrupt
- approval and `request_user_input` modal handling
- runtime status and bridge log overlay

## How To Use It

1. Run `npm run up`.
2. Open `http://127.0.0.1:3000`.
3. Start a new thread or open `Resume` to load an existing local Codex session.
4. Type directly in the composer, or use slash commands like `/new`, `/resume`, `/fork`, `/model`, `/review`, and `/status`.
5. When Codex asks for approval or user input, answer it in the modal instead of the terminal.

## UI Structure

- top bar for thread actions and runtime state
- central transcript for thread, turn, reasoning, command, diff, and system events
- bottom composer for new turns and slash commands
- overlays for resume, models, transcript, shortcuts, and runtime status
- modal surface for approvals and `request_user_input`

## Keyboard Shortcuts

- `Enter` sends the current turn
- `Shift+Enter` inserts a newline
- `Ctrl/Cmd+T` opens the transcript overlay
- `?` opens the shortcut panel
- `Esc` closes overlays and interrupts an active turn from the composer

## Commands

- `npm run up` installs dependencies if needed and starts the app
- `npm run dev` starts the app when dependencies are already installed
- `npm run typecheck` runs TypeScript checks
- `npm run build` creates a production build
- `npm run check` runs typecheck and build together

## Architecture

- Next.js renders the browser UI
- a local Node server owns the browser-facing HTTP and WebSocket APIs
- the bridge talks to Codex over stdio using the generated app-server types vendored in this repo

This keeps the UI aligned with the real Codex protocol instead of inventing a separate fake state model.

## Notes

- The resume picker reads your local Codex sessions, so you may see existing threads from other repos in the same Codex home.
- Default host and port are `127.0.0.1:3000`.
- You can override the port with `PORT=3001 npm run up`.
