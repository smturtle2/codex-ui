"use client";

import type { RefObject } from "react";

type HeaderStatusTone = "ready" | "working" | "pending" | "error" | "starting";

type ShellHeaderProps = {
  threadCount: number;
  sessionTitle: string;
  sessionMeta: string;
  sessionMetaTitle?: string | null;
  isPhoneLayout?: boolean;
  homeLabel: string;
  threadsLabel: string;
  settingsLabel: string;
  statusLabel: string;
  statusTone: HeaderStatusTone;
  showStatusLine?: boolean;
  homeButtonRef: RefObject<HTMLButtonElement | null>;
  onHomeClick: () => void;
  onThreadsClick: () => void;
  onSettingsClick: () => void;
};

export function ShellHeader({
  threadCount,
  sessionTitle,
  sessionMeta,
  sessionMetaTitle = null,
  isPhoneLayout = false,
  homeLabel,
  threadsLabel,
  settingsLabel,
  statusLabel,
  statusTone,
  showStatusLine = true,
  homeButtonRef,
  onHomeClick,
  onThreadsClick,
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
        </button>

        <div className="shell-session" title={sessionMetaTitle ?? sessionMeta}>
          <strong className="shell-session-title">{sessionTitle}</strong>
          {!isPhoneLayout ? <span className="shell-session-meta">{sessionMeta}</span> : null}
        </div>

        <div className="shell-header-actions">
          {showStatusLine ? (
            <span className={`shell-status-line tone-${statusTone}`}>{statusLabel}</span>
          ) : null}
          <button className="plain-action threads-trigger" type="button" onClick={onThreadsClick}>
            <span>{threadsLabel}</span>
            <span className="sidebar-trigger-count">{threadCount}</span>
          </button>
          <button className="plain-action" type="button" onClick={onSettingsClick}>
            {settingsLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
