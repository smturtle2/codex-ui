# Release Notes

## 2026-03-16

### UX audit summary

- Home started as a lightweight dashboard, not a clear launcher.
- Workspace selection for new threads relied on raw path entry.
- Mobile layout did not protect the transcript well enough.
- Empty threads could throw `includeTurns is unavailable before first user message`.
- Live transcript output and `thread/read` hydration had edge-case divergence.

### Implemented

- Rebuilt the launcher around two explicit paths: open an existing thread or start a new one.
- Added a dedicated workspace picker backed by server-side directory browsing.
- Moved `Model`, `Reasoning`, `Language`, and `Plan` into direct composer controls.
- Kept the transcript flat and monochrome, with `---` turn separators and folded diffs.
- Reworked mobile layout so the launcher stacks cleanly and chat keeps the transcript dominant.
- Fixed empty-thread hydration by falling back to a zero-turn thread when `thread/read` is unavailable.
- Preserved timeline consistency by using the same normalization path for live updates and reloaded threads.
- Seeded in-progress hydrated items back into streaming state and kept pending approvals attached to the rebuilt timeline.
- Refreshed README screenshots and split detailed changes into this file.

### Verification

- `npm run check`
- API check: empty `thread/read` returns an empty timeline without errors.
- API check: finished live transcript equals the corresponding `thread/read` timeline for the same thread.
