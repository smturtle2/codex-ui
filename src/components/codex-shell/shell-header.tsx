"use client";

import type { RefObject } from "react";

type HeaderStatusTone = "ready" | "working" | "pending" | "error" | "starting";

type ShellHeaderProps = {
  threadCount: number;
  sessionTitle: string;
  sessionMeta: string;
  sessionMetaTitle?: string | null;
  homeLabel: string;
  statusLabel: string;
  statusTone: HeaderStatusTone;
  homeButtonRef: RefObject<HTMLButtonElement | null>;
  onHomeClick: () => void;
};

export function ShellHeader({
  threadCount,
  sessionTitle,
  sessionMeta,
  sessionMetaTitle = null,
  homeLabel,
  statusLabel,
  statusTone,
  homeButtonRef,
  onHomeClick,
}: ShellHeaderProps) {
  return (
    <header className="shell-header">
      <div className="shell-header-rail">
        <button
          ref={homeButtonRef}
          className="sidebar-trigger"
          type="button"
          onClick={onHomeClick}
        >
          <span className="sidebar-trigger-label">{homeLabel}</span>
          <span className="sidebar-trigger-count">{threadCount}</span>
        </button>

        <div className="shell-session" title={sessionMetaTitle ?? sessionMeta}>
          <strong className="shell-session-title">{sessionTitle}</strong>
          <span className="shell-session-meta">{sessionMeta}</span>
        </div>

        <span className={`shell-status-line tone-${statusTone}`}>{statusLabel}</span>
      </div>
    </header>
  );
}
