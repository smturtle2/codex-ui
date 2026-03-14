import type { ReactNode } from "react";

import {
  CodexThreadItem,
  isAgentMessageItem,
  isCommandExecutionItem,
  isFileChangeItem,
  isReasoningItem,
  isReviewItem,
  isUserMessageItem,
} from "@/lib/types";

function isPlanItem(item: CodexThreadItem): item is Extract<CodexThreadItem, { type: "plan" }> {
  return item.type === "plan" && typeof (item as { text?: unknown }).text === "string";
}

function renderUserContent(content: Array<{ type: string; text?: string; path?: string; name?: string; url?: string }>) {
  return content
    .map((entry) => {
      switch (entry.type) {
        case "text":
          return entry.text ?? "";
        case "localImage":
          return `[local image] ${entry.path ?? ""}`;
        case "skill":
          return `[skill] ${entry.name ?? ""}`;
        case "mention":
          return `[mention] ${entry.name ?? ""}`;
        case "image":
          return `[image] ${entry.url ?? ""}`;
        default:
          return `[${entry.type}]`;
      }
    })
    .join("\n");
}

function itemTitle(item: CodexThreadItem): string {
  if (isCommandExecutionItem(item)) {
    return "Command";
  }

  if (isFileChangeItem(item)) {
    return "File changes";
  }

  if (isReasoningItem(item)) {
    return "Reasoning";
  }

  if (isPlanItem(item)) {
    return "Plan";
  }

  if (isReviewItem(item)) {
    return "Review";
  }

  return item.type;
}

function itemMeta(item: CodexThreadItem): string | null {
  if (isCommandExecutionItem(item)) {
    if (typeof item.exitCode === "number") {
      return item.exitCode === 0 ? "Completed" : `Exit ${item.exitCode}`;
    }

    if (typeof item.status === "string") {
      return item.status;
    }
  }

  if (isFileChangeItem(item) && typeof item.status === "string") {
    return item.status;
  }

  return null;
}

function shouldDefaultOpen(item: CodexThreadItem) {
  if (isCommandExecutionItem(item)) {
    return item.status === "active" || item.status === "retrying" || (typeof item.exitCode === "number" && item.exitCode !== 0);
  }

  return false;
}

function renderItemBody(item: CodexThreadItem): ReactNode {
  if (isAgentMessageItem(item)) {
    return <pre>{item.text}</pre>;
  }

  if (isReasoningItem(item)) {
    return <pre>{[...item.summary, "", ...item.content].join("\n")}</pre>;
  }

  if (isPlanItem(item)) {
    return <pre>{item.text}</pre>;
  }

  if (isCommandExecutionItem(item)) {
    return <pre>{[item.command, "", typeof item.aggregatedOutput === "string" ? item.aggregatedOutput : ""].join("\n")}</pre>;
  }

  if (isFileChangeItem(item)) {
    return <pre>{JSON.stringify(item.changes ?? [], null, 2)}</pre>;
  }

  if (isReviewItem(item)) {
    return <pre>{item.review}</pre>;
  }

  return <pre>{JSON.stringify(item, null, 2)}</pre>;
}

export function ThreadItemCard({ item }: { item: CodexThreadItem }) {
  if (isUserMessageItem(item)) {
    return (
      <article className="chat-row user-row">
        <div className="chat-bubble user-bubble">
          <pre>{renderUserContent(item.content)}</pre>
        </div>
      </article>
    );
  }

  if (isAgentMessageItem(item)) {
    const isFinalAnswer = item.phase === "final_answer";
    return (
      <article className="chat-row assistant-row">
        <div className="assistant-mark">C</div>
        <div className="assistant-body">
          <div className="assistant-label">{isFinalAnswer ? "Codex" : "Live output"}</div>
          <div className={`chat-bubble assistant-bubble ${isFinalAnswer ? "final-answer" : "commentary-answer"}`}>
            <pre>{item.text}</pre>
          </div>
        </div>
      </article>
    );
  }

  return (
    <details className="event-row" open={shouldDefaultOpen(item)}>
      <summary className="event-summary">
        <span className="event-summary-title">{itemTitle(item)}</span>
        {itemMeta(item) ? <span className="event-summary-meta">{itemMeta(item)}</span> : null}
      </summary>
      <div className="event-body">{renderItemBody(item)}</div>
    </details>
  );
}
