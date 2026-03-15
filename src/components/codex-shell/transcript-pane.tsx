"use client";

import { useEffect, useState, type RefObject } from "react";

import type { TimelineEntry } from "@/lib/shared";

import type { UiCopy, UiLocale } from "./copy";
import { formatClock, formatTimelineKind, formatTimelineStatus } from "./utils";

type TranscriptPaneProps = {
  timeline: TimelineEntry[];
  emptyTitle: string;
  emptyBody: string;
  locale: UiLocale;
  copy: UiCopy["transcript"];
  scrollRef?: RefObject<HTMLDivElement | null>;
  overlay?: boolean;
};

type TranscriptRow =
  | {
      type: "turn";
      key: string;
      entry: TimelineEntry;
    }
  | {
      type: "messageGroup";
      key: string;
      entries: TimelineEntry[];
      role: "user" | "assistant";
    }
  | {
      type: "event";
      key: string;
      entry: TimelineEntry;
    };

function isPrimaryMessage(entry: TimelineEntry): boolean {
  return entry.kind === "message" && (entry.tone === "neutral" || entry.tone === "accent");
}

function isVisibleEntry(entry: TimelineEntry): boolean {
  if (entry.kind === "turn" || isPrimaryMessage(entry)) {
    return true;
  }

  if (entry.kind === "diff" || entry.kind === "plan" || entry.kind === "approval") {
    return true;
  }

  if (entry.kind === "review" || entry.kind === "reasoning") {
    return entry.status === "running" || entry.status === "pending" || entry.status === "error";
  }

  if (entry.kind === "command" || entry.kind === "tool" || entry.kind === "input") {
    return entry.status === "error" || entry.status === "pending";
  }

  if (entry.kind === "system" || entry.kind === "thread") {
    return entry.status === "error" || entry.status === "pending";
  }

  return false;
}

function getMessageRole(entry: TimelineEntry): "user" | "assistant" {
  return entry.tone === "neutral" ? "user" : "assistant";
}

function getMessageGroupStatus(entries: TimelineEntry[]): TimelineEntry["status"] {
  if (entries.some((entry) => entry.status === "error")) {
    return "error";
  }

  if (entries.some((entry) => entry.status === "running")) {
    return "running";
  }

  if (entries.some((entry) => entry.status === "pending")) {
    return "pending";
  }

  if (entries.some((entry) => entry.status === "completed")) {
    return "completed";
  }

  return "idle";
}

function getMessageLabel(
  entries: TimelineEntry[],
  copy: UiCopy["transcript"],
): string {
  const role = getMessageRole(entries[0]);
  if (role === "user") {
    return copy.you;
  }

  const status = getMessageGroupStatus(entries);
  if (status === "running") {
    return copy.codexRunning;
  }

  if (status === "error") {
    return copy.codexError;
  }

  return copy.codex;
}

function buildTranscriptRows(timeline: TimelineEntry[]): TranscriptRow[] {
  const rows: TranscriptRow[] = [];

  for (const entry of timeline.filter(isVisibleEntry)) {
    if (entry.kind === "turn") {
      rows.push({
        type: "turn",
        key: entry.id,
        entry,
      });
      continue;
    }

    if (isPrimaryMessage(entry)) {
      const role = getMessageRole(entry);
      const previousRow = rows[rows.length - 1];

      if (previousRow?.type === "messageGroup" && previousRow.role === role) {
        previousRow.entries.push(entry);
        continue;
      }

      rows.push({
        type: "messageGroup",
        key: entry.id,
        entries: [entry],
        role,
      });
      continue;
    }

    rows.push({
      type: "event",
      key: entry.id,
      entry,
    });
  }

  return rows;
}

function firstBodyLine(entry: TimelineEntry): string | null {
  return entry.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? null;
}

function summarizeEditedContent(
  entry: TimelineEntry,
  copy: UiCopy["transcript"],
): string {
  const changeMatches = [
    ...entry.body.matchAll(/^(ADD|CREATE|UPDATE|DELETE|MODIFY|RENAME)\s+.+$/gm),
  ];
  const diffMatches = [...entry.body.matchAll(/^diff --git a\/.+ b\/.+$/gm)];
  const fileCount = changeMatches.length || diffMatches.length;

  return copy.editedContentHidden(fileCount);
}

function getEventSummary(
  entry: TimelineEntry,
  locale: UiLocale,
  copy: UiCopy["transcript"],
): string {
  if (entry.kind === "diff") {
    return summarizeEditedContent(entry, copy);
  }

  if (entry.kind === "reasoning") {
    return copy.reasoningHidden;
  }

  if (entry.kind === "plan") {
    return firstBodyLine(entry) ?? copy.planHidden;
  }

  if (entry.kind === "approval") {
    return entry.title.trim() || copy.approvalNeeded;
  }

  if (entry.kind === "command" && entry.title.trim()) {
    return entry.title.trim();
  }

  const title = entry.title.trim() || formatTimelineKind(entry.kind, locale);
  const bodyLine = firstBodyLine(entry);

  if (!bodyLine) {
    return title;
  }

  if (entry.kind === "turn" && bodyLine.toLowerCase().startsWith("status:")) {
    return `${title} · ${bodyLine.replace(/^status:\s*/i, "")}`;
  }

  return title;
}

function getEventDetail(entry: TimelineEntry): string | null {
  const detail = entry.body.trim();
  if (!detail) {
    return null;
  }

  if (entry.kind === "turn" && /^status:\s*/i.test(detail)) {
    return null;
  }

  return detail;
}

function shouldAutoExpand(entry: TimelineEntry): boolean {
  if (entry.kind === "approval" && entry.status === "pending") {
    return true;
  }

  return entry.status === "error";
}

function getRevealLabel(
  entry: TimelineEntry,
  isExpanded: boolean,
  copy: UiCopy["transcript"],
): string {
  if (isExpanded) {
    return copy.hide;
  }

  if (entry.kind === "diff") {
    return copy.showDiff;
  }

  return copy.show;
}

export function TranscriptPane({
  timeline,
  emptyTitle,
  emptyBody,
  locale,
  copy,
  scrollRef,
  overlay = false,
}: TranscriptPaneProps) {
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
  const rows = buildTranscriptRows(timeline);

  useEffect(() => {
    setExpandedEntries((current) => {
      let changed = false;
      const next: Record<string, boolean> = {};

      for (const entry of timeline.filter(isVisibleEntry)) {
        if (entry.id in current) {
          next[entry.id] = current[entry.id];
          continue;
        }

        if (shouldAutoExpand(entry)) {
          next[entry.id] = true;
          changed = true;
        }
      }

      const currentIds = Object.keys(current);
      if (!changed && currentIds.length !== Object.keys(next).length) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [timeline]);

  return (
    <div
      ref={scrollRef}
      className={overlay ? "overlay-scroll transcript-scroll-shell" : "transcript-scroll"}
    >
      {rows.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-copy">
            <strong>{emptyTitle}</strong>
            <p>{emptyBody}</p>
          </div>
        </div>
      ) : (
        <div className="history-list">
          {rows.map((row) => {
            if (row.type === "turn") {
              return (
                <div
                  key={row.key}
                  className={`history-turn-divider status-${row.entry.status}`}
                  role="separator"
                  aria-label={copy.turnSeparator}
                >
                  ---
                </div>
              );
            }

            if (row.type === "messageGroup") {
              const lastEntry = row.entries[row.entries.length - 1];
              const groupStatus = getMessageGroupStatus(row.entries);

              return (
                <article
                  key={row.key}
                  className={`history-message-group role-${row.role} status-${groupStatus}`}
                >
                  <div className="history-message-group-head">
                    <span className="history-message-role">
                      {getMessageLabel(row.entries, copy)}
                    </span>
                    {groupStatus !== "completed" && groupStatus !== "idle" ? (
                      <span className="history-message-state">
                        {formatTimelineStatus(groupStatus, locale)}
                      </span>
                    ) : null}
                    <time className="history-message-time">
                      {formatClock(locale, lastEntry.updatedAt)}
                    </time>
                  </div>

                  <div className="history-message-bubbles">
                    {row.entries.map((entry) => {
                      const body = entry.body.trim() || entry.title.trim();
                      return (
                        <div key={entry.id} className="history-message-bubble">
                          <pre className="history-message-line">{body}</pre>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            }

            const { entry } = row;
            const detail = getEventDetail(entry);
            const isExpanded = expandedEntries[entry.id] ?? false;
            const summary = getEventSummary(entry, locale, copy);

            return (
              <article
                key={entry.id}
                className={`history-event kind-${entry.kind} status-${entry.status} ${
                  isExpanded ? "expanded" : ""
                }`}
              >
                {detail ? (
                  <>
                    <button
                      type="button"
                      className="history-event-toggle"
                      onClick={() => {
                        setExpandedEntries((current) => ({
                          ...current,
                          [entry.id]: !isExpanded,
                        }));
                      }}
                    >
                      <div className="history-event-summaryline">
                        <span className="history-event-kind">
                          {formatTimelineKind(entry.kind, locale)}
                        </span>
                        <span className="history-event-summary">{summary}</span>
                        {entry.status !== "completed" && entry.status !== "idle" ? (
                          <span className="history-event-state">
                            {formatTimelineStatus(entry.status, locale)}
                          </span>
                        ) : null}
                        <time className="history-message-time">
                          {formatClock(locale, entry.updatedAt)}
                        </time>
                        <span className="history-event-marker">
                          {getRevealLabel(entry, isExpanded, copy)}
                        </span>
                      </div>
                    </button>
                    {isExpanded ? <pre className="history-event-detail">{detail}</pre> : null}
                  </>
                ) : (
                  <div className="history-event-summaryline">
                    <span className="history-event-kind">
                      {formatTimelineKind(entry.kind, locale)}
                    </span>
                    <span className="history-event-summary">{summary}</span>
                    {entry.status !== "completed" && entry.status !== "idle" ? (
                      <span className="history-event-state">
                        {formatTimelineStatus(entry.status, locale)}
                      </span>
                    ) : null}
                    <time className="history-message-time">
                      {formatClock(locale, entry.updatedAt)}
                    </time>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
