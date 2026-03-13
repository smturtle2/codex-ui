import { describe, expect, it } from "vitest";

import { applyThreadEvent, createThreadState } from "@/lib/thread-state";
import { CodexThread } from "@/lib/types";

const baseThread: CodexThread = {
  id: "thread-1",
  preview: "hello",
  ephemeral: false,
  modelProvider: "openai",
  createdAt: 1,
  updatedAt: 1,
  status: { type: "idle" },
  cwd: "/workspace",
  cliVersion: "0.114.0",
  source: "appServer",
  gitInfo: null,
  name: "hello",
  turns: [],
};

describe("thread reducer", () => {
  it("updates diffs and pending requests", () => {
    let state = createThreadState(baseThread, null);
    state = applyThreadEvent(state, {
      kind: "turn.diff.updated",
      threadId: "thread-1",
      turnId: "turn-1",
      diff: "diff --git a b",
    });
    state = applyThreadEvent(state, {
      kind: "pending.request.created",
      request: {
        id: "request-1",
        method: "item/commandExecution/requestApproval",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        params: {},
        createdAt: Date.now(),
        resolvedAt: null,
      },
    });

    expect(state.diffs["turn-1"]).toContain("diff --git");
    expect(state.pendingRequests).toHaveLength(1);
  });

  it("marks disconnected threads explicitly", () => {
    const state = applyThreadEvent(createThreadState(baseThread, null), {
      kind: "thread.disconnected",
      threadId: "thread-1",
      reason: "bridge restarted",
    });

    expect(state.disconnected).toBe(true);
    expect(state.disconnectedReason).toContain("restarted");
  });
});
