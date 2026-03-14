import { useMemo } from "react";

import { bucketThreadsByRecency, compactWorkspaceBadge, formatThreadTimestamp } from "@/lib/shell-ui";
import { ThreadListEntry } from "@/lib/types";

export function ThreadListPane({
  threads,
  selectedThreadId,
  query,
  onSelectThread,
}: {
  threads: ThreadListEntry[];
  selectedThreadId: string | null;
  query: string;
  onSelectThread: (threadId: string) => void;
}) {
  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return threads;
    }

    return threads.filter((thread) => {
      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        compactWorkspaceBadge(thread.workspacePath).toLowerCase().includes(normalizedQuery) ||
        thread.workspacePath.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, threads]);

  const buckets = useMemo(() => bucketThreadsByRecency(filteredThreads), [filteredThreads]);

  if (filteredThreads.length === 0) {
    return (
      <div className="thread-list-pane">
        <div className="empty-state sidebar-empty-state">
          {query.trim() ? "No conversations match your search." : "No conversations yet. Start a new chat to begin."}
        </div>
      </div>
    );
  }

  return (
    <div className="thread-list-pane">
      {buckets.map((bucket) => (
        <section className="thread-bucket" key={bucket.key}>
          <div className="thread-bucket-header">
            <p className="thread-bucket-label">{bucket.label}</p>
          </div>
          <div className="thread-bucket-body">
            {bucket.threads.map((thread) => (
              <button
                key={thread.id}
                className={`thread-row ${thread.id === selectedThreadId ? "active" : ""}`}
                onClick={() => onSelectThread(thread.id)}
              >
                <span className="thread-row-marker" aria-hidden="true" />
                <span className="thread-row-content">
                  <span className="thread-row-title">{thread.title}</span>
                  <span className="thread-row-meta">
                    <span>{compactWorkspaceBadge(thread.workspacePath)}</span>
                    <span className="thread-row-dot" aria-hidden="true" />
                    <time dateTime={new Date(thread.updatedAt * 1000).toISOString()}>{formatThreadTimestamp(thread.updatedAt)}</time>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
