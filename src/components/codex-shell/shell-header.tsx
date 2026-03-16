"use client";

import type { RefObject } from "react";

type HeaderStatusTone = "ready" | "working" | "pending" | "error" | "starting";

type ShellHeaderProps = {
  threadCount: number;
  showThreadCount?: boolean;
  sessionTitle: string;
  sessionMeta: string;
  sessionMetaTitle?: string | null;
  homeLabel: string;
  settingsLabel: string;
  statusLabel: string;
  statusTone: HeaderStatusTone;
  showStatusLine?: boolean;
  homeButtonRef: RefObject<HTMLButtonElement | null>;
  onHomeClick: () => void;
  onSettingsClick: () => void;
};

export function ShellHeader({
  threadCount,
  showThreadCount = true,
  sessionTitle,
  sessionMeta,
  sessionMetaTitle = null,
  homeLabel,
  settingsLabel,
  statusLabel,
  statusTone,
  showStatusLine = true,
  homeButtonRef,
  onHomeClick,
  onSettingsClick,
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
          {showThreadCount ? (
            <span className="sidebar-trigger-count">{threadCount}</span>
          ) : null}
        </button>

        <div className="shell-session" title={sessionMetaTitle ?? sessionMeta}>
          <strong className="shell-session-title">{sessionTitle}</strong>
          <span className="shell-session-meta">{sessionMeta}</span>
        </div>

        <div className="shell-header-actions">
          {showStatusLine ? (
            <span className={`shell-status-line tone-${statusTone}`}>{statusLabel}</span>
          ) : null}
          <button className="plain-action" type="button" onClick={onSettingsClick}>
            {settingsLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
