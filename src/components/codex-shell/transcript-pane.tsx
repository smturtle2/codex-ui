"use client";

import { useEffect, useState, type RefObject } from "react";

import type { TimelineEntry } from "@/lib/shared";

import { formatClock, formatTimelineKind } from "./utils";

type TranscriptPaneProps = {
  timeline: TimelineEntry[];
  emptyTitle: string;
  emptyBody: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  overlay?: boolean;
};

function isPrimaryMessage(entry: TimelineEntry): boolean {
  return entry.kind === "message" && (entry.tone === "neutral" || entry.tone === "accent");
}

function isVisibleEntry(entry: TimelineEntry): boolean {
  if (entry.kind === "turn" || isPrimaryMessage(entry)) {
    return true;
  }

  if (entry.kind === "tool") {
    return entry.status === "error";
  }

  if (entry.kind === "system") {
    return entry.status === "error" || entry.status === "pending";
  }

  return true;
}

function getMessageRole(entry: TimelineEntry): "user" | "assistant" {
  return entry.tone === "neutral" ? "user" : "assistant";
}

function getMessageLabel(entry: TimelineEntry): string {
  const role = getMessageRole(entry);

  if (role === "user") {
    return "You";
  }

  if (entry.status === "running") {
    return "Codex running";
  }

  if (entry.status === "error") {
    return "Codex error";
  }

  return "Codex";
}

type TranscriptRow =
  | {
      type: "turn";
      key: string;
      entry: TimelineEntry;
    }
  | {
      type: "message";
      key: string;
      entry: TimelineEntry;
    }
  | {
      type: "event";
      key: string;
      entry: TimelineEntry;
    };

function buildTranscriptRows(timeline: TimelineEntry[]): TranscriptRow[] {
  return timeline
    .filter(isVisibleEntry)
    .map((entry) => {
      if (entry.kind === "turn") {
        return {
          type: "turn",
          key: entry.id,
          entry,
        };
      }

      if (isPrimaryMessage(entry)) {
        return {
          type: "message",
          key: entry.id,
          entry,
        };
      }

      return {
        type: "event",
        key: entry.id,
        entry,
      };
    });
}

function firstBodyLine(entry: TimelineEntry): string | null {
  return entry.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? null;
}

function summarizeEditedContent(entry: TimelineEntry): string {
  const changeMatches = [
    ...entry.body.matchAll(/^(ADD|CREATE|UPDATE|DELETE|MODIFY|RENAME)\s+.+$/gm),
  ];
  const diffMatches = [...entry.body.matchAll(/^diff --git a\/.+ b\/.+$/gm)];
  const fileCount = changeMatches.length || diffMatches.length;

  if (fileCount > 0) {
    return `Edited content hidden · ${fileCount} file${fileCount === 1 ? "" : "s"}`;
  }

  return "Edited content hidden";
}

function getEventSummary(entry: TimelineEntry): string {
  if (entry.kind === "diff") {
    return summarizeEditedContent(entry);
  }

  if (entry.kind === "command" && entry.title.trim()) {
    return entry.title.trim();
  }

  if (entry.kind === "reasoning") {
    return firstBodyLine(entry) ?? "Reasoning hidden";
  }

  if (entry.kind === "plan") {
    return firstBodyLine(entry) ?? "Plan hidden";
  }

  if (entry.kind === "approval") {
    return entry.title.trim() || "Approval needed";
  }

  const title = entry.title.trim() || formatTimelineKind(entry.kind);
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

function getRevealLabel(entry: TimelineEntry, isExpanded: boolean): string {
  if (isExpanded) {
    return "Hide";
  }

  if (entry.kind === "diff") {
    return "Show diff";
  }

  return "Show";
}

export function TranscriptPane({
  timeline,
  emptyTitle,
  emptyBody,
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
                  aria-label="Turn separator"
                >
                  ---
                </div>
              );
            }

            if (row.type === "message") {
              const { entry } = row;
              const role = getMessageRole(entry);
              const body = entry.body.trim() || entry.title.trim();

              return (
                <article
                  key={row.key}
                  className={`history-message role-${role} status-${entry.status}`}
                >
                  <div className="history-message-head">
                    <span className="history-message-role">{getMessageLabel(entry)}</span>
                    {entry.status !== "completed" && entry.status !== "idle" ? (
                      <span className="history-message-state">{entry.status}</span>
                    ) : null}
                    <time className="history-message-time">{formatClock(entry.updatedAt)}</time>
                  </div>
                  <pre className="history-message-body">{body}</pre>
                </article>
              );
            }

            const { entry } = row;
            const detail = getEventDetail(entry);
            const isExpanded = expandedEntries[entry.id] ?? false;
            const summary = getEventSummary(entry);

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
                        <span className="history-event-kind">{formatTimelineKind(entry.kind)}</span>
                        <span className="history-event-summary">{summary}</span>
                        {entry.status !== "completed" && entry.status !== "idle" ? (
                          <span className="history-event-state">{entry.status}</span>
                        ) : null}
                        <time className="history-message-time">{formatClock(entry.updatedAt)}</time>
                        <span className="history-event-marker">
                          {getRevealLabel(entry, isExpanded)}
                        </span>
                      </div>
                    </button>
                    {isExpanded ? <pre className="history-event-detail">{detail}</pre> : null}
                  </>
                ) : (
                  <div className="history-event-summaryline">
                    <span className="history-event-kind">{formatTimelineKind(entry.kind)}</span>
                    <span className="history-event-summary">{summary}</span>
                    {entry.status !== "completed" && entry.status !== "idle" ? (
                      <span className="history-event-state">{entry.status}</span>
                    ) : null}
                    <time className="history-message-time">{formatClock(entry.updatedAt)}</time>
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
