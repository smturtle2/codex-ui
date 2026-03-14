import { describe, expect, it } from "vitest";

import {
  bucketThreadsByRecency,
  compactWorkspaceBadge,
  formatThreadTimestamp,
  removeThreadListEntry,
  resolveTheme,
  threadEventTouchesList,
  upsertThreadListEntry,
} from "@/lib/shell-ui";
import { ThreadListEntry } from "@/lib/types";

const baseThread: ThreadListEntry = {
  id: "thread-1",
  title: "Investigate workspace picker",
  createdAt: 0,
  updatedAt: 0,
  status: { type: "idle" },
  source: "cli",
  modelProvider: "openai",
  cwd: "/mnt/s/ProjectForFast/codex-ui",
  workspacePath: "/mnt/s/ProjectForFast/codex-ui",
  workspaceKey: "/mnt/s/projectforfast/codex-ui",
};

describe("shell ui helpers", () => {
  it("buckets threads by recency", () => {
    const threads: ThreadListEntry[] = [
      { ...baseThread, id: "today", updatedAt: Math.floor(Date.parse("2026-03-14T09:00:00Z") / 1000) },
      { ...baseThread, id: "yesterday", updatedAt: Math.floor(Date.parse("2026-03-13T08:00:00Z") / 1000) },
      { ...baseThread, id: "earlier", updatedAt: Math.floor(Date.parse("2026-03-10T08:00:00Z") / 1000) },
    ];

    const buckets = bucketThreadsByRecency(threads, new Date("2026-03-14T12:00:00Z"));

    expect(buckets.map((bucket) => bucket.label)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(buckets[0]?.threads[0]?.id).toBe("today");
    expect(buckets[1]?.threads[0]?.id).toBe("yesterday");
    expect(buckets[2]?.threads[0]?.id).toBe("earlier");
  });

  it("formats workspace badges using compact project labels", () => {
    expect(compactWorkspaceBadge("/mnt/s/ProjectForFast/codex-ui")).toBe("codex-ui");
    expect(compactWorkspaceBadge("/")).toBe("/");
  });

  it("resolves the active theme from user preference and system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("renders timestamps differently for same-day, yesterday, and older threads", () => {
    const sameDayExpected = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date("2026-03-14T09:30:00Z"));
    expect(formatThreadTimestamp(Math.floor(Date.parse("2026-03-14T09:30:00Z") / 1000), new Date("2026-03-14T12:00:00Z"))).toBe(
      sameDayExpected,
    );
    expect(formatThreadTimestamp(Math.floor(Date.parse("2026-03-13T09:30:00Z") / 1000), new Date("2026-03-14T12:00:00Z"))).toBe("Yesterday");
    const olderExpected = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
      new Date("2026-03-10T09:30:00Z"),
    );
    expect(formatThreadTimestamp(Math.floor(Date.parse("2026-03-10T09:30:00Z") / 1000), new Date("2026-03-14T12:00:00Z"))).toBe(
      olderExpected,
    );
  });

  it("upserts thread list entries and keeps them sorted by recency", () => {
    const entries = [
      { ...baseThread, id: "older", title: "Older", updatedAt: 100 },
      { ...baseThread, id: "newer", title: "Newer", updatedAt: 200 },
    ];

    const next = upsertThreadListEntry(entries, {
      ...baseThread,
      id: "older",
      title: "Older renamed",
      updatedAt: 300,
    });

    expect(next.map((entry) => entry.id)).toEqual(["older", "newer"]);
    expect(next[0]?.title).toBe("Older renamed");
  });

  it("removes thread list entries by thread id", () => {
    const entries = [
      { ...baseThread, id: "one" },
      { ...baseThread, id: "two" },
    ];

    expect(removeThreadListEntry(entries, "one").map((entry) => entry.id)).toEqual(["two"]);
  });

  it("marks only list-relevant realtime events as sidebar updates", () => {
    expect(threadEventTouchesList({ kind: "turn.started", threadId: "thread-1", turn: { id: "turn-1", items: [], status: "active", error: null } })).toBe(true);
    expect(
      threadEventTouchesList({
        kind: "item.agentMessage.delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        delta: "hello",
      }),
    ).toBe(false);
  });
});
