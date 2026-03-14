import { compactWorkspaceBadge } from "@/lib/shell-ui";

import { UtilityView } from "@/components/shell/shared";

function closeClosestMenu(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    target.closest("details")?.removeAttribute("open");
  }
}

export function ThreadHeader({
  title,
  workspacePath,
  pendingCount,
  selectedThreadId,
  hasActiveTurn,
  onOpenSidebar,
  onOpenWorkspace,
  onOpenUtilityView,
  onResume,
  onInterrupt,
  onReview,
  onReload,
}: {
  title: string;
  workspacePath: string;
  pendingCount: number;
  selectedThreadId: string | null;
  hasActiveTurn: boolean;
  onOpenSidebar: () => void;
  onOpenWorkspace: () => void;
  onOpenUtilityView: (view: UtilityView) => void;
  onResume: () => Promise<void>;
  onInterrupt: () => Promise<void>;
  onReview: (detached: boolean) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  return (
    <header className="thread-header">
      <div className="thread-header-main">
        <button className="icon-button mobile-only" onClick={onOpenSidebar} aria-label="Open conversation list">
          Menu
        </button>

        <div className="thread-heading">
          <h1 className="thread-title">{title}</h1>
          <button className="workspace-pill" onClick={onOpenWorkspace}>
            <span className="workspace-pill-name">{compactWorkspaceBadge(workspacePath)}</span>
            <span className="workspace-pill-path">{workspacePath}</span>
          </button>
        </div>
      </div>

      <div className="thread-header-actions">
        {hasActiveTurn ? (
          <button className="danger-button stop-button" onClick={() => void onInterrupt()}>
            Stop
          </button>
        ) : null}

        {pendingCount > 0 ? (
          <button className="pending-pill" onClick={() => onOpenUtilityView("pending")}>
            Needs input {pendingCount}
          </button>
        ) : null}

        <details className="header-menu">
          <summary className="icon-button" aria-label="Open conversation menu">
            More
          </summary>
          <div className="header-menu-panel">
            <button
              className="menu-item"
              onClick={(event) => {
                closeClosestMenu(event.currentTarget);
                onOpenWorkspace();
              }}
            >
              Change project for a new chat
            </button>
            <button
              className="menu-item"
              onClick={(event) => {
                closeClosestMenu(event.currentTarget);
                void onOpenUtilityView(pendingCount > 0 ? "pending" : "settings");
              }}
            >
              Open controls
            </button>
            <button
              className="menu-item"
              onClick={(event) => {
                closeClosestMenu(event.currentTarget);
                void onReload();
              }}
            >
              Refresh conversation data
            </button>
            {selectedThreadId ? (
              <>
                <button
                  className="menu-item"
                  onClick={(event) => {
                    closeClosestMenu(event.currentTarget);
                    void onResume();
                  }}
                >
                  Resume thread
                </button>
                <button
                  className="menu-item"
                  onClick={(event) => {
                    closeClosestMenu(event.currentTarget);
                    void onReview(false);
                  }}
                >
                  Run inline review
                </button>
                <button
                  className="menu-item"
                  onClick={(event) => {
                    closeClosestMenu(event.currentTarget);
                    void onReview(true);
                  }}
                >
                  Run detached review
                </button>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </header>
  );
}
