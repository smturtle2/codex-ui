# Release Notes

## 2026-03-16

### UX audit summary

- Home still buried new-thread actions on mobile even though desktop layout was already close.
- Language settings were separated correctly, but mobile launcher flow still needed a faster first-screen decision.
- `thread/read` hydration and live updates still had edge-case divergence around item completion status and approval ordering.
- Funnel access worked, but starting the app and exposing it publicly still took multiple commands.

### Implemented

- Added a mobile quick-start strip so workspace selection and `Start thread` stay visible above the thread list on narrow screens.
- Kept workspace selection in a dedicated directory picker and left chat itself transcript-first with no card UI.
- Preserved only `Model`, `Reasoning`, and `Plan` in the composer while leaving language in the dedicated settings panel.
- Fixed live item completion to respect item-level statuses instead of always landing as `completed`.
- Reinserted live approval requests into the same turn-relative position used by hydrated `thread/read` timelines.
- Added repo-local `--funnel` startup support so `npm run up -- --funnel` becomes the one-line public launch flow.
- Kept standalone Funnel helpers for status and teardown.
- Refreshed README copy and screenshots while keeping detailed notes here instead of bloating the README.

### Verification

- `npm run typecheck`
- Browser check: desktop home keeps launcher split between thread list and new-thread panel.
- Browser check: mobile home shows search, quick-start actions, and thread list without requiring a separate panel.
- Browser check: mobile chat still keeps transcript dominant while composer exposes model, reasoning, and plan.
- API check: live turn output and subsequent `thread/read` produced the same normalized timeline for a real turn.
- CLI check: `npm run dev -- --funnel` forwards the `--funnel` flag to the app entrypoint.
