"use client";

import type { RefObject } from "react";

type HeaderStatusTone = "ready" | "working" | "pending" | "error" | "starting";

type ShellHeaderProps = {
  threadCount: number;
  sessionTitle: string;
  sessionMeta: string;
  sessionMetaTitle?: string | null;
  isPhoneLayout?: boolean;
  compactChrome?: boolean;
  homeLabel: string;
  threadsLabel: string;
  statusLabel: string;
  statusTone: HeaderStatusTone;
  showStatusLine?: boolean;
  auxActionLabel?: string | null;
  showAuxAction?: boolean;
  homeButtonRef: RefObject<HTMLButtonElement | null>;
  onHomeClick: () => void;
  onThreadsClick: () => void;
  onAuxAction?: (() => void) | null;
};

export function ShellHeader({
  threadCount,
  sessionTitle,
  sessionMeta,
  sessionMetaTitle = null,
  isPhoneLayout = false,
  compactChrome = false,
  homeLabel,
  threadsLabel,
  statusLabel,
  statusTone,
  showStatusLine = true,
  auxActionLabel = null,
  showAuxAction = true,
  homeButtonRef,
  onHomeClick,
  onThreadsClick,
  onAuxAction = null,
}: ShellHeaderProps) {
  return (
    <header className={`shell-header ${compactChrome ? "compact" : ""}`}>
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
          {showAuxAction && auxActionLabel && onAuxAction ? (
            <button className="plain-action" type="button" onClick={onAuxAction}>
              {auxActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
