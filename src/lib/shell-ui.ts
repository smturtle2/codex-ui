import { toThreadListEntry } from "@/lib/thread-list";
import { CodexThread, ThreadListEntry, ThreadRealtimeEvent } from "@/lib/types";
import { workspaceLabel } from "@/lib/workspace-utils";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type ThreadBucketKey = "today" | "yesterday" | "earlier";

export interface ThreadBucket {
  key: ThreadBucketKey;
  label: string;
  threads: ThreadListEntry[];
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }

  return preference;
}

export function compactWorkspaceBadge(path: string) {
  const label = workspaceLabel(path);
  if (label === "/" || label === "Unknown workspace") {
    return path || label;
  }

  return label;
}

export function bucketThreadsByRecency(threads: ThreadListEntry[], now = new Date()): ThreadBucket[] {
  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const sorted = threads.slice().sort((left, right) => right.updatedAt - left.updatedAt);
  const buckets = new Map<ThreadBucketKey, ThreadBucket>([
    ["today", { key: "today", label: "Today", threads: [] }],
    ["yesterday", { key: "yesterday", label: "Yesterday", threads: [] }],
    ["earlier", { key: "earlier", label: "Earlier", threads: [] }],
  ]);

  for (const thread of sorted) {
    const timestamp = thread.updatedAt * 1000;
    const bucketKey: ThreadBucketKey =
      timestamp >= todayStart ? "today" : timestamp >= yesterdayStart ? "yesterday" : "earlier";
    buckets.get(bucketKey)!.threads.push(thread);
  }

  return [...buckets.values()].filter((bucket) => bucket.threads.length > 0);
}

export function createStarterPrompts(workspacePath: string) {
  const projectLabel = compactWorkspaceBadge(workspacePath);
  return [
    `Summarize the architecture of ${projectLabel}`,
    `Find the most likely bug in this workspace`,
    `Plan a clean refactor for the current feature`,
  ];
}

export function formatThreadTimestamp(timestamp: number, now = new Date()) {
  if (!timestamp) {
    return "-";
  }

  const value = new Date(timestamp * 1000);
  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const at = value.getTime();

  if (at >= todayStart) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(value);
  }

  if (at >= yesterdayStart) {
    return "Yesterday";
  }

  const sameYear = value.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, sameYear ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" }).format(value);
}

function sortThreadEntries(entries: ThreadListEntry[]) {
  return entries.slice().sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
    return left.title.localeCompare(right.title);
  });
}

export function upsertThreadListEntry(entries: ThreadListEntry[], nextEntry: ThreadListEntry) {
  const nextEntries = entries.filter((entry) => entry.id !== nextEntry.id);
  nextEntries.push(nextEntry);
  return sortThreadEntries(nextEntries);
}

export function upsertThreadListEntryFromThread(entries: ThreadListEntry[], thread: CodexThread) {
  return upsertThreadListEntry(entries, toThreadListEntry(thread));
}

export function removeThreadListEntry(entries: ThreadListEntry[], threadId: string) {
  return entries.filter((entry) => entry.id !== threadId);
}

export function threadEventTouchesList(event: ThreadRealtimeEvent) {
  switch (event.kind) {
    case "thread.upsert":
    case "thread.status.changed":
    case "thread.name.updated":
    case "turn.started":
    case "turn.completed":
    case "turn.error":
    case "thread.disconnected":
      return true;
    default:
      return false;
  }
}
