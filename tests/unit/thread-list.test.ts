import { describe, expect, it } from "vitest";

import { createThreadTitle, toThreadListEntry } from "@/lib/thread-list";
import { CodexThread } from "@/lib/types";

const baseThread: CodexThread = {
  id: "thread-1",
  preview: "## Plan\n\n- first item",
  ephemeral: false,
  modelProvider: "openai",
  createdAt: 1,
  updatedAt: 2,
  status: { type: "idle" },
  cwd: "/mnt/s/ProjectForFast/codex-ui",
  cliVersion: "0.114.0",
  source: "cli",
  gitInfo: null,
  name: null,
  turns: [],
};

describe("thread list helpers", () => {
  it("prefers thread name when present", () => {
    expect(createThreadTitle("  My thread title  ", "ignored")).toBe("My thread title");
  });

  it("sanitizes markdown-heavy preview lines", () => {
    expect(createThreadTitle(null, "## Summary\n\n- ship the fix")).toBe("Summary");
  });

  it("maps threads into safe list entries", () => {
    const entry = toThreadListEntry(baseThread);

    expect(entry.title).toBe("Plan");
    expect(entry.workspacePath).toBe("/mnt/s/ProjectForFast/codex-ui");
    expect(entry.workspaceKey).toBe("/mnt/s/projectforfast/codex-ui");
  });
});
