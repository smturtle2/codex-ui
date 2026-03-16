"use client";

import type { RefObject } from "react";

import type { ThreadDrawerSort } from "@/components/codex-shell/types";
import type { ThreadListItem } from "@/lib/shared";

import type { UiLocale } from "./copy";
import { formatRelativeTime } from "./utils";

type HomeCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  settings: string;
  currentThread: string;
  threadList: (count: number) => string;
  createTitle: string;
  createIntro: string;
  workspace: string;
  workspaceSelected: string;
  browseWorkspace: string;
  currentWorkspace: string;
  startThread: string;
  search: string;
  searchPlaceholder: string;
  sortThreads: string;
  noThreads: string;
  noOtherThreads: string;
  noMatchingThreads: string;
  sessionLabel: string;
  openThread: string;
  updatedSort: string;
  createdSort: string;
  planOn: string;
  planOff: string;
};

type HomeScreenProps = {
  locale: UiLocale;
  copy: HomeCopy;
  selectedPlanMode: boolean;
  sessionSummary: string;
  search: string;
  sort: ThreadDrawerSort;
  activeThread: ThreadListItem | null;
  filteredThreads: ThreadListItem[];
  workspaceDraft: string;
  statusLabel: string;
  statusTone: "ready" | "working" | "pending" | "error" | "starting";
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onOpenSettings: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: ThreadDrawerSort) => void;
  onUseDefaultWorkspace: () => void;
  onOpenWorkspacePicker: () => void;
  onCreateThread: () => void;
  onOpenThread: (threadId: string) => void;
};

function joinMeta(thread: ThreadListItem): string {
  return [thread.branch, thread.statusLabel, thread.sourceLabel].filter(Boolean).join(" · ");
}

function ThreadRow({
  locale,
  copy,
  thread,
  isCurrent = false,
  onOpenThread,
}: {
  locale: UiLocale;
  copy: HomeCopy;
  thread: ThreadListItem;
  isCurrent?: boolean;
  onOpenThread: (threadId: string) => void;
}) {
  return (
    <button
      type="button"
      className={`home-thread-row ${isCurrent ? "current" : ""}`}
      onClick={() => onOpenThread(thread.id)}
    >
      <div className="home-thread-main">
        <div className="home-thread-head">
          <strong className="home-thread-title">{thread.title}</strong>
          <span className="home-thread-time">
            {formatRelativeTime(locale, thread.updatedAt)}
          </span>
        </div>
        <div className="home-thread-path" title={thread.workspacePath}>
          {thread.workspacePath}
        </div>
        {joinMeta(thread) ? <div className="home-thread-meta">{joinMeta(thread)}</div> : null}
      </div>
      <span className="home-thread-open">{copy.openThread}</span>
    </button>
  );
}

export function HomeScreen({
  locale,
  copy,
  selectedPlanMode,
  sessionSummary,
  search,
  sort,
  activeThread,
  filteredThreads,
  workspaceDraft,
  statusLabel,
  statusTone,
  searchInputRef,
  onOpenSettings,
  onSearchChange,
  onSortChange,
  onUseDefaultWorkspace,
  onOpenWorkspacePicker,
  onCreateThread,
  onOpenThread,
}: HomeScreenProps) {
  const recentThreads = filteredThreads.filter((thread) => !thread.isActive);
  const showEmpty = recentThreads.length === 0;
  const launcherSummary = [sessionSummary, selectedPlanMode ? copy.planOn : copy.planOff]
    .filter(Boolean)
    .join(" / ");

  return (
    <section className="home-shell">
      <header className="home-header">
        <div className="home-copy">
          <span className="home-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <div className="home-header-tools">
          <button className="plain-action" type="button" onClick={onOpenSettings}>
            {copy.settings}
          </button>
          <span className={`shell-status-badge tone-${statusTone}`}>{statusLabel}</span>
        </div>
      </header>

      <section className="home-launcher" aria-label={copy.createTitle}>
        <div className="home-launcher-copy">
          <span className="home-section-label">{copy.createTitle}</span>
          <strong>{copy.workspaceSelected}</strong>
          <div className="home-launcher-path" title={workspaceDraft}>
            {workspaceDraft}
          </div>
          <span className="home-launcher-session">{launcherSummary}</span>
        </div>

        <div className="home-launcher-actions">
          <button className="plain-action" type="button" onClick={onOpenWorkspacePicker}>
            {copy.browseWorkspace}
          </button>
          <button className="plain-action" type="button" onClick={onUseDefaultWorkspace}>
            {copy.currentWorkspace}
          </button>
          <button className="action-button" type="button" onClick={onCreateThread}>
            {copy.startThread}
          </button>
        </div>
      </section>

      <section className="home-main">
        <div className="home-list-toolbar">
          <div className="home-list-heading">
            <span className="home-section-label">{copy.threadList(filteredThreads.length)}</span>
            <strong>{copy.currentThread}</strong>
          </div>

          <div className="home-toolbar-controls">
            <label className="sr-only" htmlFor="home-search">
              {copy.search}
            </label>
            <input
              id="home-search"
              ref={searchInputRef}
              className="surface-input"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={copy.searchPlaceholder}
            />

            <div className="home-sort-group" role="group" aria-label={copy.sortThreads}>
              <button
                className={`picker-chip ${sort === "updated" ? "selected" : ""}`}
                type="button"
                aria-pressed={sort === "updated"}
                onClick={() => onSortChange("updated")}
              >
                {copy.updatedSort}
              </button>
              <button
                className={`picker-chip ${sort === "created" ? "selected" : ""}`}
                type="button"
                aria-pressed={sort === "created"}
                onClick={() => onSortChange("created")}
              >
                {copy.createdSort}
              </button>
            </div>
          </div>
        </div>

        <div className="home-thread-list-shell">
          <div className="home-thread-list">
            {activeThread ? (
              <section className="home-thread-group">
                <div className="home-group-label">{copy.currentThread}</div>
                <ThreadRow
                  locale={locale}
                  copy={copy}
                  thread={activeThread}
                  isCurrent
                  onOpenThread={onOpenThread}
                />
              </section>
            ) : null}

            <section className="home-thread-group">
              <div className="home-group-label">{copy.threadList(recentThreads.length)}</div>
              {showEmpty ? (
                <div className="home-empty">
                  {search.trim().length > 0
                    ? copy.noMatchingThreads
                    : activeThread
                      ? copy.noOtherThreads
                      : copy.noThreads}
                </div>
              ) : recentThreads.length > 0 ? (
                recentThreads.map((thread) => (
                  <ThreadRow
                    key={thread.id}
                    locale={locale}
                    copy={copy}
                    thread={thread}
                    onOpenThread={onOpenThread}
                  />
                ))
              ) : null}
            </section>
          </div>
        </div>
      </section>
    </section>
  );
}
