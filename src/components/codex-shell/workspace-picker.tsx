"use client";

import type { WorkspaceListing, WorkspaceOption } from "@/lib/shared";

type WorkspacePickerProps = {
  listing: WorkspaceListing | null;
  loading: boolean;
  recentWorkspaces: WorkspaceOption[];
  labels: {
    currentPath: string;
    recent: string;
    folders: string;
    selectCurrent: string;
    goUp: string;
    empty: string;
    current: string;
    threads: (count: number) => string;
    loading: string;
  };
  onNavigate: (path: string) => void;
  onChoose: (path: string) => void;
};

export function WorkspacePicker({
  listing,
  loading,
  recentWorkspaces,
  labels,
  onNavigate,
  onChoose,
}: WorkspacePickerProps) {
  return (
    <div className="workspace-picker">
      <section className="workspace-picker-current">
        <div className="workspace-picker-current-copy">
          <div className="workspace-picker-head">
            <span className="home-section-label">{labels.currentPath}</span>
            {loading ? (
              <span className="workspace-picker-loading">{labels.loading}</span>
            ) : null}
          </div>

          <div className="workspace-picker-path" title={listing?.currentPath ?? ""}>
            {listing?.currentPath ?? ""}
          </div>
        </div>

        <div className="workspace-picker-actions">
          <button
            className="plain-action"
            type="button"
            disabled={!listing?.parentPath || loading}
            onClick={() => {
              if (listing?.parentPath) {
                onNavigate(listing.parentPath);
              }
            }}
          >
            {labels.goUp}
          </button>
          <button
            className="action-button"
            type="button"
            disabled={!listing || loading}
            onClick={() => {
              if (listing) {
                onChoose(listing.currentPath);
              }
            }}
          >
            {labels.selectCurrent}
          </button>
        </div>
      </section>

      <section className="workspace-picker-section">
        <div className="workspace-picker-head">
          <span className="home-section-label">{labels.recent}</span>
        </div>

        <div className="workspace-picker-list">
          {recentWorkspaces.map((workspace) => (
            <button
              key={workspace.path}
              type="button"
              className="workspace-picker-row"
              onClick={() => onChoose(workspace.path)}
            >
              <div className="workspace-picker-row-main">
                <strong>{workspace.label}</strong>
                <span title={workspace.path}>{workspace.path}</span>
              </div>
              <div className="workspace-picker-row-meta">
                {workspace.isCurrent ? <span>{labels.current}</span> : null}
                <span>{labels.threads(workspace.threadCount)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="workspace-picker-section workspace-picker-folders-section">
        <div className="workspace-picker-head">
          <span className="home-section-label">{labels.folders}</span>
        </div>

        <div className="workspace-picker-list">
          {listing?.directories.length ? (
            listing.directories.map((directory) => (
              <button
                key={directory.path}
                type="button"
                className="workspace-picker-row"
                onClick={() => onNavigate(directory.path)}
              >
                <div className="workspace-picker-row-main">
                  <strong>{directory.name}</strong>
                  <span title={directory.path}>{directory.path}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="workspace-picker-empty">{labels.empty}</div>
          )}
        </div>
      </section>
    </div>
  );
}
