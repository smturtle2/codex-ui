import { ThreadItemCard } from "@/components/shell/thread-item-card";

import { ThreadViewState } from "@/lib/types";
import { workspaceLabel } from "@/lib/workspace-utils";

const STARTER_PROMPTS = [
  "Summarize this workspace and point out where I should start.",
  "Find the bug behind the current issue and explain the likely fix.",
  "Plan the cleanest implementation before changing code.",
];

export function ThreadTimeline({
  threadDetail,
  loading,
  draftWorkspacePath,
  onOpenWorkspace,
  onPickStarter,
}: {
  threadDetail: ThreadViewState | null;
  loading: boolean;
  draftWorkspacePath: string;
  onOpenWorkspace: () => void;
  onPickStarter: (prompt: string) => void;
}) {
  if (loading) {
    return (
      <div className="timeline-shell">
        <div className="timeline-stream">
          <div className="message-skeleton assistant">
            <div className="skeleton-avatar" />
            <div className="skeleton-lines">
              <div className="placeholder-line wide" />
              <div className="placeholder-line" />
              <div className="placeholder-line narrow" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!threadDetail) {
    return (
      <div className="timeline-shell">
        <div className="empty-state conversation-state">
          <div className="welcome-panel">
            <div className="welcome-header">
              <p className="welcome-kicker">Codex in {workspaceLabel(draftWorkspacePath)}</p>
              <h2 className="welcome-title">What do you want to work on?</h2>
              <p className="welcome-copy">
                Ask a question, request a code change, or have Codex inspect this workspace before touching anything.
              </p>
            </div>

            <button className="workspace-pill workspace-pill-large" onClick={onOpenWorkspace}>
              <span className="workspace-pill-name">{workspaceLabel(draftWorkspacePath)}</span>
              <span className="workspace-pill-path">{draftWorkspacePath}</span>
            </button>

            <div className="starter-grid">
              {STARTER_PROMPTS.map((prompt) => (
                <button className="starter-card" key={prompt} onClick={() => onPickStarter(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-shell">
      <div className="timeline-stream">
        {threadDetail.thread.turns.flatMap((turn) =>
          turn.items.map((item) => <ThreadItemCard key={`${turn.id}:${item.id}`} item={item} />),
        )}
      </div>
    </div>
  );
}
