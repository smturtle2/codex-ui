"use client";

import { forwardRef } from "react";

import type { ThreadListItem } from "@/lib/shared";

import type { ThreadDrawerSort } from "./types";
import { formatRelativeTime } from "./utils";

type ThreadDrawerProps = {
  search: string;
  sort: ThreadDrawerSort;
  filteredCount: number;
  activeThread: ThreadListItem | null;
  recentThreads: ThreadListItem[];
  onSearchChange: (value: string) => void;
  onSortChange: (sort: ThreadDrawerSort) => void;
  onClose: () => void;
  onCreateThread: () => void;
  onResumeThread: (threadId: string) => void;
};

function joinMeta(thread: ThreadListItem): string {
  return [thread.branch, thread.statusLabel, thread.sourceLabel]
    .filter(Boolean)
    .join(" · ");
}

export const ThreadDrawer = forwardRef<HTMLDivElement, ThreadDrawerProps>(
  function ThreadDrawer(
    {
      search,
      sort,
      filteredCount,
      activeThread,
      recentThreads,
      onSearchChange,
      onSortChange,
      onClose,
      onCreateThread,
      onResumeThread,
    },
    ref,
  ) {
    return (
      <div className="thread-drawer-backdrop" onClick={onClose}>
        <aside
          id="thread-drawer"
          className="thread-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="thread-drawer-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div ref={ref} className="thread-drawer-surface" tabIndex={-1}>
            <div className="thread-drawer-header">
              <div className="thread-drawer-header-copy">
                <strong id="thread-drawer-title">Threads</strong>
                <span>{filteredCount} sessions</span>
              </div>

              <button
                className="plain-action"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <label className="sr-only" htmlFor="thread-drawer-search">
              Search threads
            </label>
            <input
              id="thread-drawer-search"
              className="surface-input"
              value={search}
              data-autofocus="true"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search title, workspace, branch, or source"
            />

            <div className="thread-drawer-toolbar" role="group" aria-label="Thread controls">
              <button className="plain-action" type="button" onClick={onCreateThread}>
                New thread
              </button>

              <div className="thread-drawer-sort" role="group" aria-label="Sort threads">
                <button
                  className={`picker-chip ${sort === "updated" ? "selected" : ""}`}
                  type="button"
                  aria-pressed={sort === "updated"}
                  onClick={() => onSortChange("updated")}
                >
                  Recent
                </button>
                <button
                  className={`picker-chip ${sort === "created" ? "selected" : ""}`}
                  type="button"
                  aria-pressed={sort === "created"}
                  onClick={() => onSortChange("created")}
                >
                  Created
                </button>
              </div>
            </div>

            {activeThread ? (
              <section className="thread-drawer-current" aria-label="Current thread">
                <div className="thread-drawer-section-label">Current</div>
                <div className="thread-drawer-current-card">
                  <div className="thread-drawer-item-head">
                    <strong className="thread-drawer-item-title" title={activeThread.title}>
                      {activeThread.title}
                    </strong>
                    <span className="thread-drawer-item-time">
                      {formatRelativeTime(activeThread.updatedAt)}
                    </span>
                  </div>
                  <div
                    className="thread-drawer-item-cwd"
                    title={activeThread.workspacePath}
                  >
                    {activeThread.workspaceLabel}
                  </div>
                  {joinMeta(activeThread) ? (
                    <div className="thread-drawer-item-meta">{joinMeta(activeThread)}</div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <div className="thread-drawer-list-shell">
              <div className="thread-drawer-list-header">
                <div className="thread-drawer-section-label">Recent</div>
                <span>{recentThreads.length} available</span>
              </div>

              <div className="thread-drawer-list" role="list" aria-label="Recent threads">
                {recentThreads.length === 0 ? (
                  <div className="thread-drawer-empty">
                    {filteredCount === 0
                      ? "No matching threads."
                      : "No other threads to switch to yet."}
                  </div>
                ) : (
                  recentThreads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      className="thread-drawer-item"
                      onClick={() => onResumeThread(thread.id)}
                    >
                      <div className="thread-drawer-item-head">
                        <strong className="thread-drawer-item-title" title={thread.title}>
                          {thread.title}
                        </strong>
                        <span className="thread-drawer-item-time">
                          {formatRelativeTime(thread.updatedAt)}
                        </span>
                      </div>
                      <div className="thread-drawer-item-cwd" title={thread.workspacePath}>
                        {thread.workspaceLabel}
                      </div>
                      {joinMeta(thread) ? (
                        <div className="thread-drawer-item-meta">{joinMeta(thread)}</div>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    );
  },
);
