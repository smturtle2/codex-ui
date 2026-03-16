"use client";

import type { RefObject } from "react";

import type { UiLanguage } from "@/components/codex-shell/copy";
import type { ThreadDrawerSort } from "@/components/codex-shell/types";
import type { WorkspaceOption, ThreadListItem } from "@/lib/shared";

import type { UiLocale } from "./copy";
import { formatRelativeTime } from "./utils";

type HomeCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  currentThread: string;
  threadList: (count: number) => string;
  createTitle: string;
  createIntro: string;
  workspace: string;
  workspacePlaceholder: string;
  workspaceHint: string;
  currentWorkspace: string;
  startThread: string;
  search: string;
  searchPlaceholder: string;
  sortThreads: string;
  noThreads: string;
  noMatchingThreads: string;
  sessionLabel: string;
  languageLabel: string;
  openThread: string;
  updatedSort: string;
  createdSort: string;
  planOn: string;
  planOff: string;
};

type HomeScreenProps = {
  locale: UiLocale;
  copy: HomeCopy;
  languageOptions: Array<{ value: UiLanguage; label: string }>;
  selectedLanguage: UiLanguage;
  selectedPlanMode: boolean;
  sessionSummary: string;
  search: string;
  sort: ThreadDrawerSort;
  activeThread: ThreadListItem | null;
  filteredThreads: ThreadListItem[];
  workspaceDraft: string;
  defaultWorkspacePath: string;
  workspaceOptions: WorkspaceOption[];
  statusLabel: string;
  statusTone: "ready" | "working" | "pending" | "error" | "starting";
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onLanguageChange: (language: UiLanguage) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: ThreadDrawerSort) => void;
  onWorkspaceChange: (value: string) => void;
  onUseDefaultWorkspace: () => void;
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
  languageOptions,
  selectedLanguage,
  selectedPlanMode,
  sessionSummary,
  search,
  sort,
  activeThread,
  filteredThreads,
  workspaceDraft,
  defaultWorkspacePath,
  workspaceOptions,
  statusLabel,
  statusTone,
  searchInputRef,
  onLanguageChange,
  onSearchChange,
  onSortChange,
  onWorkspaceChange,
  onUseDefaultWorkspace,
  onCreateThread,
  onOpenThread,
}: HomeScreenProps) {
  const recentThreads = filteredThreads.filter((thread) => !thread.isActive);
  const showEmpty = !activeThread && recentThreads.length === 0;

  return (
    <section className="home-shell">
      <header className="home-header">
        <div className="home-copy">
          <span className="home-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <div className="home-header-tools">
          <label className="home-language-field" htmlFor="home-language">
            <span>{copy.languageLabel}</span>
            <span className="composer-select-shell">
              <select
                id="home-language"
                className="composer-select"
                value={selectedLanguage}
                onChange={(event) => onLanguageChange(event.target.value as UiLanguage)}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="composer-select-caret" aria-hidden="true">
                v
              </span>
            </span>
          </label>

          <span className={`shell-status-badge tone-${statusTone}`}>{statusLabel}</span>
        </div>
      </header>

      <div className="home-grid">
        <section className="home-sidebar">
          <div className="home-panel-head">
            <span className="home-section-label">{copy.createTitle}</span>
            <strong>{copy.createTitle}</strong>
          </div>

          <p className="home-panel-copy">{copy.createIntro}</p>

          <label className="home-workspace-field" htmlFor="workspace-draft">
            <span className="home-field-label">{copy.workspace}</span>
            <input
              id="workspace-draft"
              list="workspace-presets"
              className="surface-input"
              value={workspaceDraft}
              onChange={(event) => onWorkspaceChange(event.target.value)}
              placeholder={copy.workspacePlaceholder}
            />
          </label>

          <datalist id="workspace-presets">
            {workspaceOptions.map((workspace) => (
              <option key={workspace.path} value={workspace.path}>
                {workspace.label}
              </option>
            ))}
          </datalist>

          <p className="home-workspace-hint">{copy.workspaceHint}</p>

          <div className="home-create-actions">
            <button className="plain-action" type="button" onClick={onUseDefaultWorkspace}>
              {copy.currentWorkspace}
            </button>
            <button className="action-button" type="button" onClick={onCreateThread}>
              {copy.startThread}
            </button>
          </div>

          <div className="home-session-summary">
            <span className="home-section-label">{copy.sessionLabel}</span>
            <strong>{sessionSummary}</strong>
            <span>{selectedPlanMode ? copy.planOn : copy.planOff}</span>
            <span title={defaultWorkspacePath}>{defaultWorkspacePath}</span>
          </div>
        </section>

        <section className="home-main">
          <div className="home-list-toolbar">
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

          <div className="home-thread-list-shell">
            <div className="home-list-head">
              <span className="home-section-label">{copy.threadList(filteredThreads.length)}</span>
            </div>

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
                    {search.trim().length > 0 ? copy.noMatchingThreads : copy.noThreads}
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
      </div>
    </section>
  );
}
