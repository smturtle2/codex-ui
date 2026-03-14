import {
  ActivityEntry,
  CodexThread,
  CodexThreadItem,
  CodexTurn,
  ParsedReview,
  PendingRequestRecord,
  ThreadHeader,
  ThreadRealtimeEvent,
  ThreadViewState,
  isAgentMessageItem,
  isCommandExecutionItem,
  isFileChangeItem,
  isReasoningItem as isReasoningItemFromTypes,
  isReviewItem as isReviewItemFromTypes,
  isUserMessageItem,
} from "@/lib/types";
import { parseReviewText } from "@/lib/review-parser";

function isReviewItem(item: CodexThreadItem): item is ReviewItem {
  return isReviewItemFromTypes(item);
}

function isReasoningItem(item: CodexThreadItem | undefined): item is ReasoningItem {
  return Boolean(item && isReasoningItemFromTypes(item));
}

function isOutputItem(item: CodexThreadItem | undefined): item is OutputItem {
  return Boolean(item && (isCommandExecutionItem(item) || isFileChangeItem(item)));
}

type ReviewItem = Extract<CodexThreadItem, { type: "enteredReviewMode" | "exitedReviewMode" }>;
type ReasoningItem = Extract<CodexThreadItem, { type: "reasoning" }>;
type OutputItem = Extract<CodexThreadItem, { type: "commandExecution" | "fileChange" }>;

function createActivity(entry: Omit<ActivityEntry, "id" | "at">): ActivityEntry {
  return {
    ...entry,
    id: crypto.randomUUID(),
    at: Date.now(),
  };
}

function touchThread(thread: CodexThread) {
  thread.updatedAt = Math.max(thread.updatedAt, Math.floor(Date.now() / 1000));
}

function ensureTurn(thread: CodexThread, turnId: string) {
  let turn = thread.turns.find((candidate) => candidate.id === turnId);
  if (!turn) {
    turn = {
      id: turnId,
      items: [],
      status: "active",
      error: null,
    };
    thread.turns = [...thread.turns, turn];
  }
  return turn;
}

function upsertTurn(thread: CodexThread, turn: CodexTurn) {
  const nextTurns = [...thread.turns];
  const index = nextTurns.findIndex((candidate) => candidate.id === turn.id);
  if (index === -1) {
    nextTurns.push(turn);
  } else {
    nextTurns[index] = {
      ...nextTurns[index],
      ...turn,
      items: turn.items.length > 0 ? turn.items : nextTurns[index].items,
    };
  }
  thread.turns = nextTurns;
}

function upsertItem(turn: CodexTurn, item: CodexThreadItem) {
  const nextItems = [...turn.items];
  const index = nextItems.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) {
    nextItems.push(item);
  } else {
    nextItems[index] = {
      ...nextItems[index],
      ...item,
    };
  }
  turn.items = nextItems;
}

function getItem(turn: CodexTurn, itemId: string) {
  return turn.items.find((candidate) => candidate.id === itemId);
}

function pushActivity(state: ThreadViewState, entry: Omit<ActivityEntry, "id" | "at">) {
  state.activity = [...state.activity, createActivity(entry)].slice(-300);
}

function maybeStoreReview(state: ThreadViewState, turnId: string, item: CodexThreadItem) {
  if (!isReviewItem(item)) {
    return;
  }

  const parsedReview: ParsedReview = parseReviewText(item.review);
  state.reviews = {
    ...state.reviews,
    [turnId]: parsedReview,
  };
}

export function createThreadState(thread: CodexThread, header: ThreadHeader | null): ThreadViewState {
  const reviews = Object.fromEntries(
    thread.turns.flatMap((turn) =>
      turn.items
        .filter((item): item is ReviewItem => isReviewItem(item))
        .map((item) => [turn.id, parseReviewText(item.review)]),
    ),
  ) as Record<string, ParsedReview>;

  return {
    thread,
    header,
    diffs: {},
    reviews,
    plans: {},
    pendingRequests: [],
    activity: [],
    disconnected: false,
    disconnectedReason: null,
    lastSeq: 0,
  };
}

export function applyThreadEvent(state: ThreadViewState, event: ThreadRealtimeEvent): ThreadViewState {
  const nextState: ThreadViewState = {
    ...state,
    thread: {
      ...state.thread,
      turns: [...state.thread.turns],
    },
    pendingRequests: [...state.pendingRequests],
    activity: [...state.activity],
    diffs: { ...state.diffs },
    plans: { ...state.plans },
    reviews: { ...state.reviews },
  };

  switch (event.kind) {
    case "thread.upsert": {
      nextState.thread = event.thread;
      nextState.header = event.header ?? nextState.header;
      pushActivity(nextState, {
        kind: "thread",
        title: "Thread synced",
        detail: event.thread.name ?? event.thread.preview,
        method: "thread/upsert",
        threadId: event.thread.id,
        turnId: null,
        itemId: null,
      });
      return nextState;
    }
    case "thread.status.changed": {
      nextState.thread.status = event.status;
      touchThread(nextState.thread);
      if (nextState.header) {
        nextState.header = {
          ...nextState.header,
          threadStatus: event.status,
        };
      }
      pushActivity(nextState, {
        kind: "status",
        title: "Thread status changed",
        detail: event.status.type,
        method: "thread/status/changed",
        threadId: event.threadId,
        turnId: null,
        itemId: null,
      });
      return nextState;
    }
    case "thread.name.updated": {
      nextState.thread.name = event.name;
      touchThread(nextState.thread);
      pushActivity(nextState, {
        kind: "thread",
        title: "Thread name updated",
        detail: event.name,
        method: "thread/name/updated",
        threadId: event.threadId,
        turnId: null,
        itemId: null,
      });
      return nextState;
    }
    case "thread.archived":
    case "thread.unarchived":
    case "thread.closed": {
      pushActivity(nextState, {
        kind: "thread",
        title: event.kind.replace("thread.", "").replace(".", " "),
        detail: null,
        method: event.kind,
        threadId: event.threadId,
        turnId: null,
        itemId: null,
      });
      return nextState;
    }
    case "turn.started":
    case "turn.completed": {
      upsertTurn(nextState.thread, event.turn);
      touchThread(nextState.thread);
      pushActivity(nextState, {
        kind: "turn",
        title: event.kind === "turn.started" ? "Turn started" : "Turn completed",
        detail: event.turn.id,
        method: event.kind === "turn.started" ? "turn/started" : "turn/completed",
        threadId: event.threadId,
        turnId: event.turn.id,
        itemId: null,
      });
      return nextState;
    }
    case "turn.error": {
      const turn = ensureTurn(nextState.thread, event.turnId);
      turn.error = event.error;
      turn.status = event.willRetry ? "retrying" : "failed";
      touchThread(nextState.thread);
      pushActivity(nextState, {
        kind: "error",
        title: event.willRetry ? "자동 재시도 중" : "Turn failed",
        detail: event.error.message,
        method: "error",
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: null,
      });
      return nextState;
    }
    case "turn.diff.updated": {
      nextState.diffs[event.turnId] = event.diff;
      pushActivity(nextState, {
        kind: "diff",
        title: "Diff updated",
        detail: `${event.diff.split("\n").length} lines`,
        method: "turn/diff/updated",
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: null,
      });
      return nextState;
    }
    case "turn.plan.updated": {
      nextState.plans[event.turnId] = {
        explanation: event.explanation,
        plan: event.plan,
      };
      pushActivity(nextState, {
        kind: "plan",
        title: "Plan updated",
        detail: event.explanation,
        method: "turn/plan/updated",
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: null,
      });
      return nextState;
    }
    case "item.started":
    case "item.completed": {
      const turn = ensureTurn(nextState.thread, event.turnId);
      upsertItem(turn, event.item);
      if (isUserMessageItem(event.item)) {
        nextState.thread.preview =
          event.item.content
            .map((entry) => (entry.type === "text" ? entry.text ?? "" : ""))
            .join("\n")
            .trim() || nextState.thread.preview;
      }
      maybeStoreReview(nextState, event.turnId, event.item);
      pushActivity(nextState, {
        kind: "item",
        title: `${event.item.type} ${event.kind === "item.started" ? "started" : "completed"}`,
        detail: event.item.id,
        method: event.kind === "item.started" ? "item/started" : "item/completed",
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: event.item.id,
      });
      return nextState;
    }
    case "item.agentMessage.delta": {
      const turn = ensureTurn(nextState.thread, event.turnId);
      const item = getItem(turn, event.itemId);
      if (item && isAgentMessageItem(item)) {
        item.text += event.delta;
      }
      return nextState;
    }
    case "item.reasoning.summaryPartAdded": {
      const turn = ensureTurn(nextState.thread, event.turnId);
      const item = getItem(turn, event.itemId);
      if (isReasoningItem(item)) {
        item.summary[event.summaryIndex] = item.summary[event.summaryIndex] ?? "";
      }
      return nextState;
    }
    case "item.reasoning.summaryTextDelta": {
      const turn = ensureTurn(nextState.thread, event.turnId);
      const item = getItem(turn, event.itemId);
      if (isReasoningItem(item)) {
        item.summary[event.summaryIndex] = `${item.summary[event.summaryIndex] ?? ""}${event.delta}`;
      }
      return nextState;
    }
    case "item.reasoning.textDelta": {
      const turn = ensureTurn(nextState.thread, event.turnId);
      const item = getItem(turn, event.itemId);
      if (isReasoningItem(item)) {
        item.content[event.contentIndex] = `${item.content[event.contentIndex] ?? ""}${event.delta}`;
      }
      return nextState;
    }
    case "item.commandExecution.outputDelta":
    case "item.fileChange.outputDelta": {
      const turn = ensureTurn(nextState.thread, event.turnId);
      const item = getItem(turn, event.itemId);
      if (isOutputItem(item)) {
        item.aggregatedOutput = `${item.aggregatedOutput ?? ""}${event.delta}`;
      }
      return nextState;
    }
    case "item.commandExecution.terminalInteraction": {
      pushActivity(nextState, {
        kind: "terminal",
        title: "Terminal interaction",
        detail: event.stdin,
        method: "item/commandExecution/terminalInteraction",
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: event.itemId,
      });
      return nextState;
    }
    case "pending.request.created": {
      nextState.pendingRequests = [...nextState.pendingRequests, event.request];
      pushActivity(nextState, {
        kind: "pending-request",
        title: event.request.method,
        detail: null,
        method: event.request.method,
        threadId: event.request.threadId ?? nextState.thread.id,
        turnId: event.request.turnId,
        itemId: event.request.itemId,
      });
      return nextState;
    }
    case "pending.request.resolved": {
      nextState.pendingRequests = nextState.pendingRequests.filter((request) => request.id !== event.requestId);
      pushActivity(nextState, {
        kind: "pending-request",
        title: "Server request resolved",
        detail: event.requestId,
        method: "serverRequest/resolved",
        threadId: event.threadId,
        turnId: null,
        itemId: null,
      });
      return nextState;
    }
    case "thread.disconnected": {
      nextState.disconnected = true;
      nextState.disconnectedReason = event.reason;
      touchThread(nextState.thread);
      pushActivity(nextState, {
        kind: "connection",
        title: "Bridge disconnected",
        detail: event.reason,
        method: "bridge/disconnected",
        threadId: event.threadId,
        turnId: null,
        itemId: null,
      });
      return nextState;
    }
    default: {
      return nextState;
    }
  }
}

export function mergePendingRequests(state: ThreadViewState, pendingRequests: PendingRequestRecord[]) {
  return {
    ...state,
    pendingRequests: pendingRequests.filter((request) => request.threadId === state.thread.id),
  };
}
