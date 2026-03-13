import { describe, expect, it } from "vitest";

import { getRetryStrategy } from "@/lib/retry-decision";
import { CodexTurn } from "@/lib/types";

describe("getRetryStrategy", () => {
  it("replays in the same thread for transient failures", () => {
    const turn: CodexTurn = {
      id: "turn-1",
      status: "failed",
      error: null,
      items: [
        {
          type: "agentMessage",
          id: "item-1",
          text: "hello",
        },
      ],
    };

    expect(getRetryStrategy(turn).mode).toBe("same-thread");
  });

  it("switches to fork when side effects already completed", () => {
    const turn: CodexTurn = {
      id: "turn-1",
      status: "failed",
      error: null,
      items: [
        {
          type: "commandExecution",
          id: "item-1",
          command: "touch x",
          cwd: "/tmp",
          status: "completed",
        },
      ],
    };

    expect(getRetryStrategy(turn).mode).toBe("fork");
  });
});
