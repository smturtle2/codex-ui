"use client";

import type { RefObject } from "react";

type HeaderStatusTone = "ready" | "working" | "pending" | "error" | "starting";

type ShellHeaderProps = {
  threadCount: number;
  threadDrawerOpen: boolean;
  sessionTitle: string;
  sessionMeta: string;
  sessionMetaTitle?: string | null;
  threadsLabel: string;
  statusLabel: string;
  statusTone: HeaderStatusTone;
  threadButtonRef: RefObject<HTMLButtonElement | null>;
  onThreadsClick: () => void;
};

export function ShellHeader({
  threadCount,
  threadDrawerOpen,
  sessionTitle,
  sessionMeta,
  sessionMetaTitle = null,
  threadsLabel,
  statusLabel,
  statusTone,
  threadButtonRef,
  onThreadsClick,
}: ShellHeaderProps) {
  return (
    <header className="shell-header">
      <div className="shell-header-rail">
        <button
          ref={threadButtonRef}
          className={`sidebar-trigger ${threadDrawerOpen ? "selected" : ""}`}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={threadDrawerOpen}
          aria-controls="thread-drawer"
          onClick={onThreadsClick}
        >
          <span className="sidebar-trigger-label">{threadsLabel}</span>
          <span className="sidebar-trigger-count">{threadCount}</span>
        </button>

        <div className="shell-session" title={sessionMetaTitle ?? sessionMeta}>
          <strong className="shell-session-title">{sessionTitle}</strong>
          <span className="shell-session-meta">{sessionMeta}</span>
        </div>

        <span className={`shell-status-badge tone-${statusTone}`}>{statusLabel}</span>
      </div>
    </header>
  );
}
