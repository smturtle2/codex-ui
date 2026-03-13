import { CodexTurn, CodexThreadItem, isCommandExecutionItem, isFileChangeItem } from "@/lib/types";

function isSideEffectingItem(
  item: CodexThreadItem,
): item is Extract<CodexThreadItem, { type: "commandExecution" | "fileChange" }> {
  return isCommandExecutionItem(item) || isFileChangeItem(item);
}

export function getRetryStrategy(turn: CodexTurn | undefined) {
  if (!turn) {
    return {
      mode: "same-thread",
      cta: "같은 thread에 마지막 입력 재전송",
    } as const;
  }

  const hasCompletedSideEffect = turn.items.some((item) => {
    if (!isSideEffectingItem(item)) {
      return false;
    }

    const status = typeof item.status === "string" ? item.status : "";
    return status === "completed" || status === "accepted" || status === "applied";
  });

  if (hasCompletedSideEffect) {
    return {
      mode: "fork",
      cta: "fork 후 같은 입력 재전송",
    } as const;
  }

  return {
    mode: "same-thread",
    cta: "같은 thread에 마지막 입력 재전송",
  } as const;
}
