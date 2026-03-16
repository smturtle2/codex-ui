# Release Notes

## 2026-03-16

### UX audit summary

- Home still buried new-thread actions on mobile even though desktop layout was already close.
- Language settings were separated correctly, but mobile launcher flow still needed a faster first-screen decision.
- `thread/read` hydration and live updates still had edge-case divergence around item completion status and approval ordering.
- Funnel access worked, but starting the app and exposing it publicly still took multiple commands.
- Turn boundaries still read too much like literal `---` text instead of a UI separator.
- Mobile chat still spent slightly too much height on shell chrome after the earlier pass.

### Implemented

- Added a mobile quick-start strip so workspace selection and `Start thread` stay visible above the thread list on narrow screens.
- Kept workspace selection in a dedicated directory picker and left chat itself transcript-first with no card UI.
- Preserved only `Model`, `Reasoning`, and `Plan` in the composer while leaving language in the dedicated settings panel.
- Routed `/new`, `/clear`, and launcher-style resume flows back through Home so starting a new thread keeps workspace selection explicit instead of silently using the current default.
- Fixed live item completion to respect item-level statuses instead of always landing as `completed`.
- Reinserted live approval requests into the same turn-relative position used by hydrated `thread/read` timelines.
- Added repo-local `--funnel` startup support so `npm run up -- --funnel` becomes the one-line public launch flow.
- Kept standalone Funnel helpers for status and teardown.
- Refreshed README copy and screenshots while keeping detailed notes here instead of bloating the README.
- Collapsed mobile session controls behind a single-line composer summary so the transcript keeps more height on narrow screens.
- Kept the active thread visible on Home even when search filters out every recent thread, and surfaced the correct empty-state copy for the remaining list.
- Removed the live-only `thread/started` transcript noise and aligned hydrated/live item fallback statuses so failed turns no longer rehydrate into a different visible state.
- Stopped concatenating plan deltas during streaming and now let the completed plan item replace the running placeholder, matching `thread/read` more closely.
- Updated the preview generator to export the same desktop/mobile screenshot set referenced by both READMEs.
- Documented the extra `--funnel` prerequisites and the screenshot refresh command in the English and Korean READMEs.
- Rebalanced the turn divider styling so it reads like a centered rule instead of literal text while staying transcript-flat.
- Tightened the narrow-screen header/composer spacing again so the transcript keeps more vertical space on mobile.
- Restored transcript auto-scroll when opening an already-active thread from Home so chat lands on the latest output instead of the oldest visible row.
- Added a direct mobile `Plan` toggle beside the compact session summary while keeping model and reasoning controls inside the composer.
- Turned settings and workspace overlays into full-height mobile sheets instead of centered desktop cards.
- Preserved approval insertion anchors across hydration so `thread/read` keeps the same visible pending-approval ordering as live updates.
- Added the missing `scripts/generate_preview_images.py` utility and refreshed the README screenshots directly from the running app.
- Added a built-in demo snapshot and demo workspace browser so screenshot generation can target stable, documentation-safe UI states.
- Switched preview capture to `/?demo=1`, which keeps README screenshots deterministic instead of leaking whatever happens to be in the local active transcript.
- Flattened the settings snapshot presentation and compressed narrow-screen shell chrome again so mobile chat gives more height back to the transcript.
- Persisted the selected workspace across reloads and reused it for Home quick start plus slash-driven new-thread actions instead of silently falling back to the launch directory.
- Reordered the workspace picker so normal project folders appear before hidden/generated directories such as `.git`, `.next`, and `node_modules`.
- Hid redundant idle status chrome on very narrow screens so the mobile transcript keeps more vertical space without losing working/pending indicators.
- Reused existing `updatedAt` values for unchanged hydrated timeline entries so reopening the same thread no longer mutates an otherwise identical transcript snapshot.
- Removed the heavy focused textarea ring from the composer so the chat input stays visually flat instead of reading like a boxed card.

### Verification

- `npm run typecheck`
- `npm run build`
- Preview generation path: `python scripts/generate_preview_images.py` now targets `/?demo=1`.
- Browser check: desktop home keeps launcher split between thread list and new-thread panel.
- Browser check: mobile home shows search, quick-start actions, and thread list without requiring a separate panel.
- Browser check: mobile chat keeps transcript dominant while composer exposes model, reasoning, and plan behind a compact session toggle.
- Browser check: opening a thread from Home now lands at the latest transcript output instead of the top of the scrollback.
- Browser check: mobile settings and workspace panels now open as bottom-aligned full-height sheets.
- Browser check: once a thread is open, Home search still preserves the current thread while showing `No matching threads.` for the filtered recent list.
- Browser check: turn separators now read as a centered rule motif rather than literal `---` characters.
- Browser check: mobile ready state no longer spends an extra line on idle status text, leaving more height for the transcript.
- Browser check: the focused composer no longer draws a thick rectangular ring around the input area on desktop or mobile.
- Browser check: after choosing a custom workspace, reload and `/new` continue to target that workspace instead of jumping back to the launch directory.
- API/UI check: workspace directory browsing now surfaces regular source folders ahead of hidden and generated directories.
- API check: live turn output and subsequent `thread/read` now produce the same normalized timeline entries for a real turn, including stable unchanged-entry timestamps.
- CLI check: `npm run dev -- --funnel` forwards the `--funnel` flag to the app entrypoint.
- Tooling check: `python scripts/generate_preview_images.py` now targets `preview-home.png`, `preview-settings.png`, `preview-workspace.png`, `preview-desktop.png`, `preview-mobile-home.png`, `preview-mobile-settings.png`, `preview-mobile-workspace.png`, and `preview-mobile-chat.png`.
