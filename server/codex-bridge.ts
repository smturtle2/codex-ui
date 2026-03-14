import { EventEmitter } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

import type { ReasoningEffort } from "../src/generated/codex-app-server/ReasoningEffort";
import type { InitializeResponse } from "../src/generated/codex-app-server/InitializeResponse";
import type { Model } from "../src/generated/codex-app-server/v2/Model";
import type { ModelListResponse } from "../src/generated/codex-app-server/v2/ModelListResponse";
import type { ReviewStartResponse } from "../src/generated/codex-app-server/v2/ReviewStartResponse";
import type { Thread } from "../src/generated/codex-app-server/v2/Thread";
import type { ThreadForkResponse } from "../src/generated/codex-app-server/v2/ThreadForkResponse";
import type { ThreadListResponse } from "../src/generated/codex-app-server/v2/ThreadListResponse";
import type { ThreadReadResponse } from "../src/generated/codex-app-server/v2/ThreadReadResponse";
import type { ThreadResumeResponse } from "../src/generated/codex-app-server/v2/ThreadResumeResponse";
import type { ThreadStartResponse } from "../src/generated/codex-app-server/v2/ThreadStartResponse";
import type { ThreadStatus } from "../src/generated/codex-app-server/v2/ThreadStatus";
import type { Turn } from "../src/generated/codex-app-server/v2/Turn";
import type { TurnStartResponse } from "../src/generated/codex-app-server/v2/TurnStartResponse";
import type {
  BridgeSnapshot,
  PendingServerRequest,
  SessionSettings,
  TimelineEntry,
  TimelineTone,
} from "../src/lib/shared";

type JsonRpcId = number | string;

type JsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type PendingClientRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type TrackedPendingRequest = PendingServerRequest & {
  wireId: JsonRpcId;
};

type InternalState = {
  phase: BridgeSnapshot["phase"];
  lastError: string | null;
  threads: Map<string, Thread>;
  activeThreadId: string | null;
  activeTurnIds: Map<string, string>;
  activeTurnStartedAt: Map<string, number>;
  timelineByThread: Map<string, TimelineEntry[]>;
  pendingRequests: Map<string, TrackedPendingRequest>;
  models: Model[];
  sessionSettings: SessionSettings;
  bridgeLogs: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractThreadStatusLabel(status: ThreadStatus): string {
  switch (status.type) {
    case "active":
      return status.activeFlags.length > 0
        ? `active · ${status.activeFlags.join(", ")}`
        : "active";
    case "idle":
      return "idle";
    case "notLoaded":
      return "not loaded";
    case "systemError":
      return "system error";
  }
}

function bodyFromLines(lines: Array<string | null | undefined>): string {
  return lines
    .filter((line): line is string => Boolean(line && line.trim().length > 0))
    .join("\n");
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeUserInputs(content: Array<{ type: string; text?: string; path?: string; url?: string; name?: string }>): string {
  return content
    .map((item) => {
      switch (item.type) {
        case "text":
          return item.text ?? "";
        case "localImage":
          return `[local image] ${item.path ?? ""}`.trim();
        case "image":
          return `[image] ${item.url ?? ""}`.trim();
        case "skill":
          return `[skill] ${item.name ?? ""}`.trim();
        case "mention":
          return `[mention] ${item.name ?? ""}`.trim();
        default:
          return stringifyUnknown(item);
      }
    })
    .join("\n");
}

function timelineEntryFromTurnItem(
  threadId: string,
  turnId: string | null,
  item: Record<string, unknown>,
  status: TimelineEntry["status"],
): TimelineEntry {
  const itemId = typeof item.id === "string" ? item.id : `item-${Date.now()}`;
  const itemType = typeof item.type === "string" ? item.type : "unknown";
  const now = Date.now();

  switch (itemType) {
    case "userMessage":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "message",
        title: "User input",
        body: summarizeUserInputs((item.content as Array<{ type: string; text?: string }>) ?? []),
        tone: "neutral",
        status,
        rawMethod: "thread/read",
        updatedAt: now,
      };
    case "agentMessage":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "message",
        title: "Agent message",
        body: typeof item.text === "string" ? item.text : "",
        tone: "accent",
        status,
        updatedAt: now,
      };
    case "reasoning":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "reasoning",
        title: "Reasoning",
        body: bodyFromLines([
          ...(((item.summary as string[]) ?? []).map((line) => `• ${line}`)),
          ...(((item.content as string[]) ?? []).map((line) => line)),
        ]),
        tone: "muted",
        status,
        updatedAt: now,
      };
    case "plan":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "review",
        title: "Plan update",
        body: typeof item.text === "string" ? item.text : "",
        tone: "accent",
        status,
        updatedAt: now,
      };
    case "commandExecution":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "command",
        title: typeof item.command === "string" ? `$ ${item.command}` : "Command execution",
        body: bodyFromLines([
          typeof item.cwd === "string" ? `cwd: ${item.cwd}` : null,
          typeof item.aggregatedOutput === "string" ? item.aggregatedOutput : null,
        ]),
        tone: status === "error" ? "danger" : "accent",
        status,
        updatedAt: now,
      };
    case "fileChange":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "diff",
        title: "File change",
        body: (((item.changes as Array<{ path: string; kind: string; diff: string }>) ?? [])
          .map((change) =>
            bodyFromLines([
              `${change.kind.toUpperCase()} ${change.path}`,
              change.diff,
            ]),
          )
          .join("\n\n")),
        tone: "warning",
        status,
        updatedAt: now,
      };
    case "mcpToolCall":
    case "dynamicToolCall":
    case "webSearch":
    case "imageGeneration":
    case "imageView":
    case "collabAgentToolCall":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "tool",
        title: itemType,
        body: stringifyUnknown(item),
        tone: "muted",
        status,
        updatedAt: now,
      };
    case "enteredReviewMode":
    case "exitedReviewMode":
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "review",
        title: itemType === "enteredReviewMode" ? "Review started" : "Review completed",
        body: typeof item.review === "string" ? item.review : "",
        tone: "accent",
        status,
        updatedAt: now,
      };
    default:
      return {
        id: itemId,
        threadId,
        turnId,
        kind: "system",
        title: itemType,
        body: stringifyUnknown(item),
        tone: "muted",
        status,
        updatedAt: now,
      };
  }
}

export class CodexBridge extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private requestSeq = 1;
  private readonly pendingClientRequests = new Map<string, PendingClientRequest>();
  private readonly state: InternalState = {
    phase: "starting",
    lastError: null,
    threads: new Map(),
    activeThreadId: null,
    activeTurnIds: new Map(),
    activeTurnStartedAt: new Map(),
    timelineByThread: new Map(),
    pendingRequests: new Map(),
    models: [],
    sessionSettings: {
      model: null,
      effort: null,
    },
    bridgeLogs: [],
  };
  private readyPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = this.boot();
    return this.readyPromise;
  }

  async stop(): Promise<void> {
    if (!this.child) {
      return;
    }

    this.child.kill("SIGTERM");
    this.child = null;
  }

  async ensureReady(): Promise<void> {
    await this.start();
  }

  getSnapshot(): BridgeSnapshot {
    const threads = [...this.state.threads.values()].sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );
    const timelineByThread: Record<string, TimelineEntry[]> = {};

    for (const [threadId, timeline] of this.state.timelineByThread.entries()) {
      timelineByThread[threadId] = timeline;
    }

    const activeThreadId = this.state.activeThreadId;
    const activeTurnId = activeThreadId
      ? this.state.activeTurnIds.get(activeThreadId) ?? null
      : null;
    const activeTurnStartedAt = activeThreadId
      ? this.state.activeTurnStartedAt.get(activeThreadId) ?? null
      : null;

    return {
      phase: this.state.phase,
      lastError: this.state.lastError,
      threads,
      activeThreadId,
      activeTurnId,
      activeTurnStartedAt,
      timelineByThread,
      pendingRequests: [...this.state.pendingRequests.values()]
        .sort((left, right) => left.createdAt - right.createdAt)
        .map(({ wireId: _wireId, ...request }) => request),
      models: this.state.models,
      sessionSettings: this.state.sessionSettings,
      bridgeLogs: this.state.bridgeLogs,
    };
  }

  async refreshBootstrapData(): Promise<BridgeSnapshot> {
    await this.ensureReady();
    await Promise.allSettled([this.refreshThreads(), this.refreshModels()]);
    this.publish();
    return this.getSnapshot();
  }

  async createThread(): Promise<BridgeSnapshot> {
    await this.ensureReady();
    const response = (await this.sendRequest<ThreadStartResponse>("thread/start", {
      model: this.state.sessionSettings.model,
      experimentalRawEvents: false,
      persistExtendedHistory: true,
    })) as ThreadStartResponse;

    this.state.activeThreadId = response.thread.id;
    this.state.threads.set(response.thread.id, response.thread);
    this.state.timelineByThread.set(response.thread.id, []);
    await this.refreshThreads();
    this.publish();
    return this.getSnapshot();
  }

  async resumeThread(threadId: string): Promise<BridgeSnapshot> {
    await this.ensureReady();
    const response = (await this.sendRequest<ThreadResumeResponse>("thread/resume", {
      threadId,
      persistExtendedHistory: true,
    })) as ThreadResumeResponse;

    this.state.activeThreadId = response.thread.id;
    this.state.threads.set(response.thread.id, response.thread);
    this.hydrateThreadTimeline(response.thread);
    await this.refreshThreads();
    this.publish();
    return this.getSnapshot();
  }

  async forkThread(threadId: string): Promise<BridgeSnapshot> {
    await this.ensureReady();
    const response = (await this.sendRequest<ThreadForkResponse>("thread/fork", {
      threadId,
      persistExtendedHistory: true,
    })) as ThreadForkResponse;

    this.state.activeThreadId = response.thread.id;
    this.state.threads.set(response.thread.id, response.thread);
    this.hydrateThreadTimeline(response.thread);
    await this.refreshThreads();
    this.publish();
    return this.getSnapshot();
  }

  async readThread(threadId: string): Promise<BridgeSnapshot> {
    await this.ensureReady();
    const response = (await this.sendRequest<ThreadReadResponse>("thread/read", {
      threadId,
      includeTurns: true,
    })) as ThreadReadResponse;

    this.state.threads.set(response.thread.id, response.thread);
    this.hydrateThreadTimeline(response.thread);
    this.publish();
    return this.getSnapshot();
  }

  async setSessionSettings(settings: Partial<SessionSettings>): Promise<BridgeSnapshot> {
    this.state.sessionSettings = {
      ...this.state.sessionSettings,
      ...settings,
    };
    this.publish();
    return this.getSnapshot();
  }

  async sendUserTurn(text: string): Promise<BridgeSnapshot> {
    await this.ensureReady();

    const normalized = text.trim();
    if (!normalized) {
      return this.getSnapshot();
    }

    if (!this.state.activeThreadId) {
      await this.createThread();
    }

    const threadId = this.state.activeThreadId;
    if (!threadId) {
      throw new Error("No active thread available.");
    }

    await this.sendRequest<TurnStartResponse>("turn/start", {
      threadId,
      input: [
        {
          type: "text",
          text: normalized,
          text_elements: [],
        },
      ],
      model: this.state.sessionSettings.model,
      effort: this.state.sessionSettings.effort,
    });

    return this.getSnapshot();
  }

  async interruptActiveTurn(): Promise<BridgeSnapshot> {
    await this.ensureReady();

    const threadId = this.state.activeThreadId;
    if (!threadId) {
      return this.getSnapshot();
    }

    const turnId = this.state.activeTurnIds.get(threadId);
    if (!turnId) {
      return this.getSnapshot();
    }

    await this.sendRequest("turn/interrupt", {
      threadId,
      turnId,
    });

    return this.getSnapshot();
  }

  async startReview(): Promise<BridgeSnapshot> {
    await this.ensureReady();

    const threadId = this.state.activeThreadId;
    if (!threadId) {
      throw new Error("Start a thread before requesting review.");
    }

    await this.sendRequest<ReviewStartResponse>("review/start", {
      threadId,
      target: { type: "uncommittedChanges" },
      delivery: "inline",
    });

    return this.getSnapshot();
  }

  async respondToServerRequest(requestId: string, result: unknown): Promise<BridgeSnapshot> {
    const pending = this.state.pendingRequests.get(requestId);
    if (!pending) {
      throw new Error(`Pending server request ${requestId} was not found.`);
    }

    this.sendMessage({
      id: pending.wireId,
      result,
    });

    this.state.pendingRequests.delete(requestId);
    this.publish();
    return this.getSnapshot();
  }

  private async boot(): Promise<void> {
    this.child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
      },
    });

    this.child.on("error", (error) => {
      this.setError(`Failed to start codex app-server: ${error.message}`);
    });

    this.child.on("close", (code, signal) => {
      this.logLine(`app-server exited (${code ?? "null"}${signal ? `, ${signal}` : ""})`);
      if (this.state.phase !== "error") {
        this.setError("codex app-server exited unexpectedly.");
      }
    });

    const stdout = readline.createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity,
    });

    stdout.on("line", (line) => this.handleStdoutLine(line));

    const stderr = readline.createInterface({
      input: this.child.stderr,
      crlfDelay: Infinity,
    });

    stderr.on("line", (line) => this.logLine(line));

    const initialize = (await this.sendRequest<InitializeResponse>("initialize", {
      clientInfo: {
        name: "codex_webui",
        title: "Codex WebUI",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
      },
    })) as InitializeResponse;

    this.logLine(
      `Initialized app-server (${initialize.userAgent}).`,
    );
    this.sendMessage({ method: "initialized" });

    await Promise.allSettled([this.refreshThreads(), this.refreshModels()]);
    this.state.phase = "ready";
    this.publish();
  }

  private publish(): void {
    this.emit("snapshot", this.getSnapshot());
  }

  private logLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    this.state.bridgeLogs = [...this.state.bridgeLogs.slice(-119), trimmed];
    this.emit("snapshot", this.getSnapshot());
  }

  private setError(message: string): void {
    this.state.phase = "error";
    this.state.lastError = message;
    this.logLine(message);
    this.publish();
  }

  private sendMessage(message: Record<string, unknown>): void {
    if (!this.child) {
      throw new Error("codex app-server is not running.");
    }

    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private async refreshThreads(): Promise<void> {
    const response = (await this.sendRequest<ThreadListResponse>("thread/list", {})) as ThreadListResponse;

    for (const thread of response.data) {
      this.state.threads.set(thread.id, thread);
      if (!this.state.timelineByThread.has(thread.id)) {
        this.state.timelineByThread.set(thread.id, []);
      }
    }
  }

  private async refreshModels(): Promise<void> {
    const response = (await this.sendRequest<ModelListResponse>("model/list", {})) as ModelListResponse;
    this.state.models = response.data.filter((model) => !model.hidden);
  }

  private hydrateThreadTimeline(thread: Thread): void {
    const entries: TimelineEntry[] = [];

    for (const turn of thread.turns) {
      entries.push(this.createTurnEntry(thread.id, turn));
      for (const item of turn.items as Array<Record<string, unknown>>) {
        entries.push(timelineEntryFromTurnItem(thread.id, turn.id, item, "completed"));
      }
    }

    this.state.timelineByThread.set(thread.id, entries);
  }

  private createTurnEntry(threadId: string, turn: Turn): TimelineEntry {
    return {
      id: `turn:${turn.id}`,
      threadId,
      turnId: turn.id,
      kind: "turn",
      title: `Turn ${turn.id.slice(0, 8)}`,
      body:
        turn.status === "failed" && turn.error
          ? stringifyUnknown(turn.error)
          : `status: ${turn.status}`,
      tone: turn.status === "failed" ? "danger" : "muted",
      status:
        turn.status === "failed"
          ? "error"
          : turn.status === "inProgress"
            ? "running"
            : "completed",
      updatedAt: Date.now(),
    };
  }

  private async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    const requestId = this.requestSeq++;

    const payload: JsonRpcRequest = {
      id: requestId,
      method,
    };

    if (typeof params !== "undefined") {
      payload.params = params;
    }

    const promise = new Promise<T>((resolve, reject) => {
      this.pendingClientRequests.set(String(requestId), {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });

    this.sendMessage(payload);
    return promise;
  }

  private handleStdoutLine(line: string): void {
    if (!line.trim()) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      this.logLine(`Failed to parse app-server line: ${String(error)}`);
      return;
    }

    if (!isRecord(parsed)) {
      return;
    }

    if (typeof parsed.method === "string" && "id" in parsed) {
      this.handleServerRequest(parsed as JsonRpcRequest);
      return;
    }

    if (typeof parsed.method === "string") {
      this.handleNotification(parsed as JsonRpcNotification);
      return;
    }

    if ("id" in parsed) {
      this.handleResponse(parsed as JsonRpcResponse);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const key = String(response.id);
    const pending = this.pendingClientRequests.get(key);
    if (!pending) {
      return;
    }

    this.pendingClientRequests.delete(key);
    if (response.error) {
      pending.reject(new Error(response.error.message));
      return;
    }

    pending.resolve(response.result);
  }

  private handleServerRequest(request: JsonRpcRequest): void {
    const requestId = String(request.id);
    const paramsRecord = isRecord(request.params) ? request.params : {};
    const threadId =
      typeof paramsRecord["threadId"] === "string" ? paramsRecord["threadId"] : null;
    const turnId =
      typeof paramsRecord["turnId"] === "string" ? paramsRecord["turnId"] : null;
    const { summary, detail } = this.summarizeServerRequest(request.method, paramsRecord);

    this.state.pendingRequests.set(requestId, {
      id: requestId,
      wireId: request.id,
      method: request.method,
      threadId,
      turnId,
      summary,
      detail,
      params: request.params,
      createdAt: Date.now(),
    });

    if (threadId) {
      this.appendTimelineEntry(threadId, {
        id: `request:${requestId}`,
        threadId,
        turnId,
        kind: "approval",
        title: summary,
        body: detail,
        tone: "warning",
        status: "pending",
        rawMethod: request.method,
        updatedAt: Date.now(),
      });
    }

    this.publish();
  }

  private summarizeServerRequest(
    method: string,
    params: Record<string, unknown>,
  ): { summary: string; detail: string } {
    switch (method) {
      case "item/commandExecution/requestApproval":
        return {
          summary: "Command approval requested",
          detail: bodyFromLines([
            typeof params.reason === "string" ? `Reason: ${params.reason}` : null,
            typeof params.command === "string" ? `$ ${params.command}` : null,
            typeof params.cwd === "string" ? `cwd: ${params.cwd}` : null,
          ]),
        };
      case "item/fileChange/requestApproval":
        return {
          summary: "File change approval requested",
          detail: bodyFromLines([
            typeof params.reason === "string" ? `Reason: ${params.reason}` : null,
            typeof params.grantRoot === "string"
              ? `Grant root: ${params.grantRoot}`
              : null,
          ]),
        };
      case "item/permissions/requestApproval":
        return {
          summary: "Additional permissions requested",
          detail: bodyFromLines([
            typeof params.reason === "string" ? `Reason: ${params.reason}` : null,
            stringifyUnknown(params.permissions),
          ]),
        };
      case "item/tool/requestUserInput":
        return {
          summary: "Tool requested user input",
          detail: stringifyUnknown(params.questions),
        };
      case "mcpServer/elicitation/request":
        return {
          summary: "MCP elicitation request",
          detail: bodyFromLines([
            typeof params.serverName === "string"
              ? `Server: ${params.serverName}`
              : null,
            typeof params.message === "string" ? params.message : null,
          ]),
        };
      default:
        return {
          summary: method,
          detail: stringifyUnknown(params),
        };
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const method = notification.method;
    const params = isRecord(notification.params) ? notification.params : {};
    const now = Date.now();

    switch (method) {
      case "thread/started": {
        const thread = params.thread as Thread;
        this.state.threads.set(thread.id, thread);
        if (!this.state.timelineByThread.has(thread.id)) {
          this.state.timelineByThread.set(thread.id, []);
        }
        if (!this.state.activeThreadId) {
          this.state.activeThreadId = thread.id;
        }
        this.appendTimelineEntry(thread.id, {
          id: `thread:${thread.id}:started`,
          threadId: thread.id,
          turnId: null,
          kind: "thread",
          title: thread.name ?? "Thread started",
          body: bodyFromLines([
            `cwd: ${thread.cwd}`,
            `status: ${extractThreadStatusLabel(thread.status)}`,
          ]),
          tone: "accent",
          status: "completed",
          rawMethod: method,
          updatedAt: now,
        });
        break;
      }
      case "thread/status/changed": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const status = params.status as ThreadStatus | undefined;
        if (threadId && status) {
          const existing = this.state.threads.get(threadId);
          if (existing) {
            this.state.threads.set(threadId, {
              ...existing,
              status,
              updatedAt: Math.floor(now / 1000),
            });
          }
        }
        break;
      }
      case "thread/name/updated": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const name = typeof params.name === "string" ? params.name : null;
        if (threadId) {
          const existing = this.state.threads.get(threadId);
          if (existing) {
            this.state.threads.set(threadId, {
              ...existing,
              name,
            });
          }
        }
        break;
      }
      case "turn/started": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const turn = params.turn as Turn | undefined;
        if (threadId && turn) {
          this.state.activeTurnIds.set(threadId, turn.id);
          this.state.activeTurnStartedAt.set(threadId, now);
          this.appendTimelineEntry(threadId, {
            id: `turn:${turn.id}`,
            threadId,
            turnId: turn.id,
            kind: "turn",
            title: `Turn ${turn.id.slice(0, 8)} started`,
            body: "Streaming live app-server items.",
            tone: "muted",
            status: "running",
            rawMethod: method,
            updatedAt: now,
          });
        }
        break;
      }
      case "turn/completed": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const turn = params.turn as Turn | undefined;
        if (threadId && turn) {
          this.state.activeTurnIds.delete(threadId);
          this.state.activeTurnStartedAt.delete(threadId);
          this.upsertTimelineEntry(threadId, `turn:${turn.id}`, {
            id: `turn:${turn.id}`,
            threadId,
            turnId: turn.id,
            kind: "turn",
            title: `Turn ${turn.id.slice(0, 8)} completed`,
            body:
              turn.status === "failed" && turn.error
                ? stringifyUnknown(turn.error)
                : `status: ${turn.status}`,
            tone: turn.status === "failed" ? "danger" : "success",
            status: turn.status === "failed" ? "error" : "completed",
            rawMethod: method,
            updatedAt: now,
          });
          const existing = this.state.threads.get(threadId);
          if (existing) {
            this.state.threads.set(threadId, {
              ...existing,
              updatedAt: Math.floor(now / 1000),
            });
          }
        }
        break;
      }
      case "item/started": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const turnId = typeof params.turnId === "string" ? params.turnId : null;
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && item) {
          this.upsertTimelineEntry(
            threadId,
            typeof item.id === "string" ? item.id : `item:${now}`,
            timelineEntryFromTurnItem(threadId, turnId, item, "running"),
          );
        }
        break;
      }
      case "item/completed": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const turnId = typeof params.turnId === "string" ? params.turnId : null;
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && item) {
          this.upsertTimelineEntry(
            threadId,
            typeof item.id === "string" ? item.id : `item:${now}`,
            timelineEntryFromTurnItem(threadId, turnId, item, "completed"),
          );
        }
        break;
      }
      case "item/agentMessage/delta": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
        const delta = typeof params.delta === "string" ? params.delta : "";
        if (threadId && itemId) {
          this.appendDelta(threadId, itemId, "Agent message", delta, "accent");
        }
        break;
      }
      case "item/reasoning/textDelta":
      case "item/reasoning/summaryTextDelta":
      case "item/plan/delta":
      case "item/commandExecution/outputDelta":
      case "item/fileChange/outputDelta": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
        const delta = typeof params.delta === "string" ? params.delta : "";
        if (threadId && itemId) {
          const title =
            method === "item/reasoning/textDelta"
              ? "Reasoning"
              : method === "item/reasoning/summaryTextDelta"
                ? "Reasoning summary"
                : method === "item/plan/delta"
                  ? "Plan"
                  : method === "item/fileChange/outputDelta"
                    ? "File change"
                    : "Command output";
          const tone: TimelineTone =
            method === "item/fileChange/outputDelta" ? "warning" : "muted";
          this.appendDelta(threadId, itemId, title, delta, tone);
        }
        break;
      }
      case "turn/diff/updated": {
        const threadId =
          typeof params.threadId === "string" ? params.threadId : undefined;
        const turnId = typeof params.turnId === "string" ? params.turnId : null;
        const diff = typeof params.diff === "string" ? params.diff : "";
        if (threadId) {
          this.upsertTimelineEntry(threadId, `diff:${turnId ?? "unknown"}`, {
            id: `diff:${turnId ?? "unknown"}`,
            threadId,
            turnId,
            kind: "diff",
            title: "Turn diff updated",
            body: diff,
            tone: "warning",
            status: "completed",
            rawMethod: method,
            updatedAt: now,
          });
        }
        break;
      }
      case "serverRequest/resolved": {
        const requestId = String(params.requestId ?? "");
        this.state.pendingRequests.delete(requestId);
        break;
      }
      case "error": {
        const threadId =
          typeof params.threadId === "string"
            ? params.threadId
            : this.state.activeThreadId ?? "global";
        this.appendTimelineEntry(threadId, {
          id: `error:${now}`,
          threadId,
          turnId: null,
          kind: "system",
          title: "Server error",
          body: stringifyUnknown(params),
          tone: "danger",
          status: "error",
          rawMethod: method,
          updatedAt: now,
        });
        this.state.lastError = stringifyUnknown(params);
        break;
      }
      default: {
        const threadId =
          typeof params.threadId === "string"
            ? params.threadId
            : this.state.activeThreadId;
        if (threadId) {
          this.appendTimelineEntry(threadId, {
            id: `${method}:${now}`,
            threadId,
            turnId:
              typeof params.turnId === "string" ? params.turnId : null,
            kind: "system",
            title: method,
            body: stringifyUnknown(params),
            tone: "muted",
            status: "completed",
            rawMethod: method,
            updatedAt: now,
          });
        }
      }
    }

    this.publish();
  }

  private appendDelta(
    threadId: string,
    itemId: string,
    title: string,
    delta: string,
    tone: TimelineTone,
  ): void {
    const existing = this.findTimelineEntry(threadId, itemId);

    if (!existing) {
      this.appendTimelineEntry(threadId, {
        id: itemId,
        threadId,
        turnId: null,
        kind: tone === "accent" ? "message" : "system",
        title,
        body: delta,
        tone,
        status: "running",
        updatedAt: Date.now(),
      });
      return;
    }

    existing.body += delta;
    existing.updatedAt = Date.now();
    existing.status = "running";
  }

  private findTimelineEntry(threadId: string, entryId: string): TimelineEntry | undefined {
    return this.state.timelineByThread.get(threadId)?.find((entry) => entry.id === entryId);
  }

  private appendTimelineEntry(threadId: string, entry: TimelineEntry): void {
    const timeline = this.state.timelineByThread.get(threadId) ?? [];
    timeline.push(entry);
    this.state.timelineByThread.set(threadId, timeline);
  }

  private upsertTimelineEntry(threadId: string, entryId: string, next: TimelineEntry): void {
    const timeline = this.state.timelineByThread.get(threadId) ?? [];
    const index = timeline.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      timeline.push(next);
    } else {
      timeline[index] = next;
    }
    this.state.timelineByThread.set(threadId, timeline);
  }
}
