# Codex WebUI

[English](./README.md) | [한국어](./README.ko.md)

Local-first WebUI for Codex.

Codex WebUI is a browser interface built around real Codex workflow state. It does not flatten everything into a generic chat transcript, and it does not pretend Codex is just another prompt box. The product is designed for people who want a clean interface without giving up approvals, file changes, diffs, reviews, logs, and the rest of the workflow that actually matters.

## What Codex WebUI Is

Codex WebUI is:

- a local-first web application for Codex
- a single-user interface optimized for focused coding sessions
- a product that keeps Codex-native concepts visible instead of hiding them behind abstraction
- a shell that separates UI, local app logic, and Codex integration cleanly

## Core Experience

The interface is organized around one coherent working environment.

- a sidebar for workspace and thread navigation
- a central timeline for structured conversation and workflow events
- a fixed composer for text, mentions, skills, and local media inputs
- utility panels for approvals, diffs, reviews, logs, and runtime context
- settings that expose the important local runtime controls without turning the UI into a control panel dump

## What The Product Exposes

Codex WebUI makes important workflow state visible.

- turns, items, and thread history
- approval flows and follow-up questions
- file changes and diffs
- review output and review status
- activity logs and runtime diagnostics
- connection and session state

## Product Principles

- Keep the Codex mental model intact.
- Make state inspectable instead of magical.
- Prefer local-first behavior by default.
- Avoid fake simplicity that hides important system behavior.
- Keep the product sharp, opinionated, and usable for real work.

## How It Works

The product is built around a simple architecture.

- the browser handles interaction, layout, and realtime presentation
- a local application layer owns session state, transport, and browser-facing APIs
- the Codex integration layer speaks the real Codex protocol and feeds structured state back into the UI

This keeps the interface honest while still making the experience feel polished.

## What It Optimizes For

Codex WebUI is tuned for practical day-to-day usage.

- long-running local coding sessions
- visibility into state transitions and side effects
- smooth handling of approvals and interruptions
- fast recovery when a session needs to reconnect or resync
- enough structure that power users can trust what the UI is showing

## What It Does Not Try To Be

Codex WebUI is not trying to become:

- a cloud-first SaaS platform
- a multi-user collaboration suite
- a generic LLM chat client
- a plugin marketplace
- an over-abstracted layer that hides Codex-specific behavior

## Contributing

Good contributions make the product clearer, tighter, and more trustworthy.

- strengthen the core experience
- improve visibility of real workflow state
- reduce ambiguity between UI behavior and Codex behavior
- keep the architecture readable as the product grows
