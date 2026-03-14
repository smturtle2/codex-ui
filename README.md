# Codex WebUI

[English](./README.md) | [한국어](./README.ko.md)

Codex WebUI is being rebuilt as a focused, local-first interface for Codex workflows.

This repository is no longer carrying the previous implementation forward. The project is starting over with a smaller scope, a clearer product shape, and a stronger rule: the README should describe what this repository is actually becoming, not what used to exist.

## Overview

The goal of Codex WebUI is straightforward: build a web interface that feels modern and usable without flattening Codex into a generic chat wrapper.

The rebuild is centered on a product that should eventually:

- keep Codex workflows understandable in a browser
- stay local-first by default
- expose meaningful state instead of hiding everything behind a chat transcript
- grow from a small working core rather than a broad but fragile surface

## Why This Project Exists

There is still room for a Codex UI that is both practical and honest about the underlying workflow.

- Generic agent chat shells often erase important state and workflow boundaries.
- Local tools become hard to trust when the UI and runtime model drift apart.
- A clean rebuild is more useful than preserving a structure that no longer fits the product direction.
- Starting smaller makes it easier to establish good architecture, testing habits, and documentation discipline.

## Rebuild Direction

The next version is being designed around a few concrete ideas.

### 1. A real working shell, not a placeholder demo

The first usable version should have a minimal but coherent application shell. It does not need breadth first. It needs clear behavior, understandable state, and room to grow without rewriting everything again.

### 2. Clear boundaries between UI and Codex runtime

The browser layer, local application layer, and Codex-facing integration should have explicit responsibilities. The rebuild should avoid collapsing those concerns into one pile of UI code.

### 3. Local-first workflow by default

This project is intended to serve local usage first. Remote deployment, multi-user concerns, and larger platform features should not shape the early architecture unless they become necessary.

### 4. Inspectable product behavior

The product should be understandable from the outside. Important workflow state, transitions, and user-facing actions should be visible and debuggable rather than implied.

## Current Status

This repository is in an intentional reset state.

- The previous implementation has been cleared out.
- A new runnable baseline has not been checked in yet.
- Setup and Quick Start instructions are intentionally deferred until there is something real to run.
- Technology choices, folder layout, and internal boundaries are being re-established from first principles.

## Initial Build Scope

The rebuild will start with the smallest version that proves the product direction.

- establish a clean project scaffold
- build a minimal application shell
- define the Codex integration boundary
- restore the core conversation flow
- reintroduce tests and operational documentation alongside real implementation

## Principles

- Keep the documentation aligned with the codebase.
- Prefer fewer moving parts over clever indirection.
- Design around real workflows, not imagined future flexibility.
- Make the core useful before making it broad.
- Treat resets as a chance to remove confusion, not rename it.

## What This README Is And Is Not

This README is a direction document for the rebuild.

- It is a statement of intent for the new version of the project.
- It is not a product manual for code that no longer exists.
- It is not a Quick Start guide yet.
- It will become more operational again once the new baseline lands.

## Contributing

Feedback is useful right now if it sharpens the rebuild instead of expanding it prematurely.

The most valuable early contributions are:

- crisp critiques of the project structure
- well-scoped proposals for the first implementation passes
- observations about product shape and workflow clarity
- small decisions that reduce ambiguity for the rebuild
