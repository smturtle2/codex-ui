# Release Notes

## 2026-03-16

### UX audit summary

- Home mixed launcher controls and thread browsing in a way that buried the main decision.
- Language settings lived in the wrong places and cluttered the main workflow.
- Mobile layout still let supporting UI crowd out the thread list and transcript.
- `thread/read` hydration and live updates still had edge-case divergence around in-progress state.

### Implemented

- Tightened the launcher so recent threads remain the primary surface and new-thread controls stay explicit.
- Kept workspace selection in a dedicated directory picker and tied it directly to thread creation.
- Left only `Model`, `Reasoning`, and `Plan` in the composer, and moved interface language into a dedicated settings panel.
- Slimmed the chat header and composer density so the transcript stays visually dominant, especially on mobile.
- Rebalanced the workspace picker so the current path and actions stay compact while recent workspaces and folders get the space.
- Preserved the flat transcript treatment with `---` turn separators, hidden diffs, and no message cards.
- Fixed hydration/live consistency for in-progress items by respecting item-level statuses during `thread/read`.
- Stopped running diffs from showing misleading file counts while output is still streaming.
- Reinserted pending approvals back into the rebuilt turn timeline instead of dumping them at the end.
- Added repo-local `npm run funnel` / `funnel:status` / `funnel:off` helpers for Tailscale Funnel access.
- Refreshed README screenshots and kept detailed change notes here instead of bloating the README.

### Verification

- `npm run check`
- Browser check: desktop home opens settings, workspace picker, and existing threads correctly.
- Browser check: mobile home prioritizes the thread list before new-thread controls.
- Browser check: chat keeps transcript first while composer still exposes model, reasoning, and plan.
- Tailscale CLI check: helper detects disabled Funnel state and prints the exact enable URL for this node.
