# Codex WebUI

[English](./README.md) | [한국어](./README.ko.md)

This repository is being rebuilt from scratch.

Codex WebUI is now a reset point for a new local-first interface project around Codex workflows. The old shape has been cleared out on purpose so the next version can start from a smaller, cleaner, and more honest foundation.

## Current Status

- The repository is intentionally in a reset state.
- There is no runnable application checked in right now.
- Setup and usage instructions are intentionally omitted until there is something real to install and run.
- Architecture, stack, and folder layout are open again and will be reintroduced step by step.

## Why Rebuild

- The previous structure no longer matched the direction of the project.
- A clean reset is easier to reason about than another partial rewrite.
- Documentation should describe the current repository, not removed code.
- The next version should grow from a minimal working core.
- Core user flows need clearer boundaries and fewer hidden assumptions.

## Rebuild Principles

- Keep documentation and implementation aligned at all times.
- Stay local-first unless a remote concern is proven necessary.
- Prefer clear structure over abstractions that do not pay for themselves.
- Build around observable user workflows instead of speculative architecture.
- Start small, ship the core, then expand.

## First Milestones

1. Restore a minimal project scaffold and development baseline.
2. Add the smallest useful app shell that can serve as a real starting point.
3. Define a clean Codex integration boundary before rebuilding advanced UI behavior.
4. Rebuild the core conversation flow end to end.
5. Reintroduce tests and documentation only as the new implementation earns them.

## What Is Not Ready

- There is no demo or production-ready build yet.
- There is no Quick Start because there is nothing valid to run yet.
- The architecture is not locked.
- Compatibility, security, and deployment guidance will be written after the new baseline exists.

## Contributing

Early feedback is welcome, especially on structure, scope, and sequencing.

Until the new baseline lands, the most useful contributions are:

- concrete problem statements
- critiques of project structure
- small, focused proposals that reduce decision debt
- implementation ideas that match the reset direction
