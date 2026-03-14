import { useEffect, useMemo, useState } from "react";

import { WorkspaceBrowseResponse, WorkspaceOption, WorkspaceOptionSource } from "@/lib/types";
import { workspaceSegments } from "@/lib/workspace-utils";

const SOURCE_LABELS: Record<WorkspaceOptionSource, string> = {
  launcher: "Launcher",
  project: "Projects",
  recent: "Recent",
};

export function WorkspaceSwitcher({
  open,
  draftWorkspacePath,
  workspaceOptions,
  workspaceBrowse,
  workspaceBrowseLoading,
  workspaceBrowseError,
  onBrowseWorkspace,
  onSelectWorkspace,
  onClose,
}: {
  open: boolean;
  draftWorkspacePath: string;
  workspaceOptions: WorkspaceOption[];
  workspaceBrowse: WorkspaceBrowseResponse | null;
  workspaceBrowseLoading: boolean;
  workspaceBrowseError: string | null;
  onBrowseWorkspace: (path: string) => Promise<unknown> | void;
  onSelectWorkspace: (path: string) => Promise<unknown> | void;
  onClose: () => void;
}) {
  const [manualPath, setManualPath] = useState(draftWorkspacePath);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setManualPath(draftWorkspacePath);
      setQuery("");
    }
  }, [draftWorkspacePath, open]);

  const groupedOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const groups = new Map<WorkspaceOptionSource, WorkspaceOption[]>();

    for (const option of workspaceOptions) {
      const matchesQuery =
        !normalizedQuery ||
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.path.toLowerCase().includes(normalizedQuery);
      if (option.path === draftWorkspacePath || !matchesQuery) {
        continue;
      }

      const existing = groups.get(option.source) ?? [];
      existing.push(option);
      groups.set(option.source, existing);
    }

    return (["recent", "project", "launcher"] as WorkspaceOptionSource[])
      .map((source) => ({
        source,
        label: SOURCE_LABELS[source],
        options: groups.get(source) ?? [],
      }))
      .filter((group) => group.options.length > 0);
  }, [draftWorkspacePath, query, workspaceOptions]);

  return (
    <>
      <button
        className={`modal-backdrop ${open ? "open" : ""}`}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <section className={`workspace-modal ${open ? "open" : ""}`} aria-hidden={!open} role="dialog" aria-modal="true">
        <div className="workspace-modal-header">
          <div>
            <p className="modal-kicker">New chat</p>
            <h2 className="workspace-modal-title">Choose a project</h2>
            <p className="workspace-modal-copy">Pick where the next conversation should start. This does not change the thread you are reading right now.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close workspace picker">
            x
          </button>
        </div>

        <div className="workspace-modal-body">
          <div className="workspace-modal-column">
            <label className="search-field workspace-search-field">
              <span className="search-label">Search workspaces</span>
              <input
                className="text-input search-input"
                value={query}
                placeholder="Find a project by name or path"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <section className="workspace-section">
              <div className="workspace-section-header">
                <p className="workspace-section-title">Current</p>
              </div>
              <button className="workspace-option active" onClick={() => void onSelectWorkspace(draftWorkspacePath)}>
                <span className="workspace-option-label">{draftWorkspacePath.split("/").pop() || draftWorkspacePath}</span>
                <span className="workspace-option-path">{draftWorkspacePath}</span>
              </button>
            </section>

            {groupedOptions.length > 0 ? (
              groupedOptions.map((group) => (
                <section className="workspace-section" key={group.source}>
                  <div className="workspace-section-header">
                    <p className="workspace-section-title">{group.label}</p>
                  </div>
                  <div className="workspace-option-list">
                    {group.options.map((option) => (
                      <button key={`${option.key}:${option.source}`} className="workspace-option" onClick={() => void onSelectWorkspace(option.path)}>
                        <span className="workspace-option-label">{option.label}</span>
                        <span className="workspace-option-path">{option.path}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-state workspace-browser-empty">No saved workspace matches that search.</div>
            )}
          </div>

          <div className="workspace-browser-panel">
            <div className="workspace-section-header">
              <p className="workspace-section-title">Browse folders</p>
            </div>

            <div className="path-input-row">
              <input
                className="text-input"
                value={manualPath}
                placeholder="/absolute/path/to/workspace"
                onChange={(event) => setManualPath(event.target.value)}
              />
              <button className="ghost-button" onClick={() => void onBrowseWorkspace(manualPath)}>
                Open
              </button>
            </div>

            {workspaceBrowse ? (
              <>
                <div className="workspace-breadcrumbs">
                  {workspaceSegments(workspaceBrowse.path).map((segment, index) => (
                    <span className="workspace-crumb" key={`${segment}-${index}`}>
                      {segment}
                    </span>
                  ))}
                </div>

                <div className="workspace-browser-toolbar">
                  <button
                    className="ghost-button"
                    disabled={!workspaceBrowse.parentPath || workspaceBrowseLoading}
                    onClick={() => workspaceBrowse.parentPath && void onBrowseWorkspace(workspaceBrowse.parentPath)}
                  >
                    Up
                  </button>
                  <button className="button" disabled={workspaceBrowseLoading} onClick={() => void onSelectWorkspace(workspaceBrowse.path)}>
                    Use this folder
                  </button>
                </div>

                <div className="workspace-directory-list">
                  {workspaceBrowse.entries.length > 0 ? (
                    workspaceBrowse.entries.map((entry) => (
                      <button key={entry.key} className="workspace-directory" onClick={() => void onBrowseWorkspace(entry.path)}>
                        <span className="workspace-option-label">{entry.name}</span>
                        <span className="workspace-option-path">{entry.path}</span>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state workspace-browser-empty">No subdirectories are available here.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="workspace-browser-empty-state">Open a path to browse available folders.</div>
            )}

            {workspaceBrowseLoading ? <div className="workspace-browser-note">Loading directories...</div> : null}
            {workspaceBrowseError ? <div className="status-banner error inline-banner">{workspaceBrowseError}</div> : null}
          </div>
        </div>
      </section>
    </>
  );
}
