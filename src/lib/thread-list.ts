import type { CodexThread, ThreadListEntry } from "@/lib/types";
import { createWorkspaceKey, normalizeWorkspacePath } from "@/lib/workspace-utils";

const THREAD_TITLE_LIMIT = 88;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function firstContentLine(value: string | null | undefined) {
  const lines = (value ?? "").split(/\r?\n/);

  for (const rawLine of lines) {
    const withoutMarkdown = rawLine
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*+>]\s+/, "")
      .replace(/^\s*\d+[.)]\s+/, "")
      .replace(/^`{3,}/, "");
    const normalized = collapseWhitespace(withoutMarkdown);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function createThreadTitle(name: string | null | undefined, preview: string | null | undefined) {
  const preferredName = collapseWhitespace(name ?? "");
  if (preferredName) {
    return truncate(preferredName, THREAD_TITLE_LIMIT);
  }

  const previewLine = firstContentLine(preview);
  if (previewLine) {
    return truncate(previewLine, THREAD_TITLE_LIMIT);
  }

  return "Untitled thread";
}

export function toThreadListEntry(thread: CodexThread): ThreadListEntry {
  const workspacePath = normalizeWorkspacePath(thread.cwd) || thread.cwd;

  return {
    id: thread.id,
    title: createThreadTitle(thread.name, thread.preview),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    status: thread.status,
    source: typeof thread.source === "string" ? thread.source : "unknown",
    modelProvider: thread.modelProvider,
    cwd: thread.cwd,
    workspacePath,
    workspaceKey: createWorkspaceKey(workspacePath),
  };
}

export function upsertThreadListEntry(entries: ThreadListEntry[], entry: ThreadListEntry) {
  const nextEntries = entries.slice();
  const index = nextEntries.findIndex((candidate) => candidate.id === entry.id);

  if (index === -1) {
    nextEntries.push(entry);
  } else {
    nextEntries[index] = {
      ...nextEntries[index],
      ...entry,
    };
  }

  nextEntries.sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return right.createdAt - left.createdAt;
  });

  return nextEntries;
}

export function removeThreadListEntry(entries: ThreadListEntry[], threadId: string) {
  return entries.filter((entry) => entry.id !== threadId);
}
