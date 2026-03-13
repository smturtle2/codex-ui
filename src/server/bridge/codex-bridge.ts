import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod";

import { getDefaultSourceKinds } from "@/lib/source-filter";
import {
  BootstrapResponse,
  BrowserRealtimeServerMessage,
  CodexThread,
  CodexUserInput,
  CompatibilityState,
  ThreadDetailResponse,
  ThreadHeader,
  ThreadRealtimeEvent,
} from "@/lib/types";
import { evaluateCompatibility } from "@/lib/version";
import { AccountConfigService } from "@/server/bridge/account-config-service";
import { BrowserSessionHub } from "@/server/bridge/browser-session-hub";
import {
  buildThreadHeader,
  decodeReviewStartResponse,
  decodeThread,
  decodeThreadListResponse,
  decodeThreadOperationResponse,
  decodeThreadResponse,
  decodeTurnStartResponse,
  normalizeThreadStatus,
  normalizeTurnItem,
} from "@/server/bridge/decoders";
import { DiagnosticsLogger } from "@/server/bridge/diagnostics-logger";
import { JsonRpcClient } from "@/server/bridge/json-rpc-client";
import { PendingRequestRouter } from "@/server/bridge/pending-request-router";
import { ProcessSupervisor } from "@/server/bridge/process-supervisor";
import { ThreadRegistry } from "@/server/bridge/thread-registry";

const execFileAsync = promisify(execFile);

interface CreateBridgeOptions {
  launcherCwd: string;
  host: string;
  port: number;
}

const TURN_NOTIFICATION_SCHEMA = z.object({
  threadId: z.string(),
  turn: z.unknown(),
});

const ITEM_NOTIFICATION_SCHEMA = z.object({
  threadId: z.string(),
  turnId: z.string(),
  item: z.unknown(),
});

const STRING_DELTA_SCHEMA = z.object({
  threadId: z.string(),
  turnId: z.string(),
  itemId: z.string(),
  delta: z.string(),
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isThreadReadMaterializationError(error: unknown) {
  return getErrorMessage(error).includes("includeTurns is unavailable before first user message");
}

function isThreadReadNotFoundError(error: unknown) {
  return getErrorMessage(error).includes("thread not found:");
}

export class CodexBridge {
  readonly compatibility: CompatibilityState;
  readonly cliVersion: string;
  readonly logger: DiagnosticsLogger;
  readonly browserSessionHub: BrowserSessionHub;

  private readonly sessionSecret = crypto.randomUUID();
  private readonly sessionId = crypto.randomUUID();
  private readonly rpc: JsonRpcClient;
  private readonly pendingRequestRouter: PendingRequestRouter;
  private readonly threadRegistry: ThreadRegistry;
  private readonly accountConfigService: AccountConfigService;
  private readonly processSupervisor: ProcessSupervisor;
  private transportReady: Promise<void> = Promise.resolve();
  private resolveTransportReady: (() => void) | null = null;
  private rejectTransportReady: ((error: Error) => void) | null = null;
  private readonly idleUnloadInterval: NodeJS.Timeout;

  private constructor(
    cliVersion: string,
    compatibility: CompatibilityState,
    private readonly options: CreateBridgeOptions,
  ) {
    this.cliVersion = cliVersion;
    this.compatibility = compatibility;
    this.logger = new DiagnosticsLogger();
    this.rpc = new JsonRpcClient(this.logger);
    this.pendingRequestRouter = new PendingRequestRouter();
    this.threadRegistry = new ThreadRegistry();
    this.accountConfigService = new AccountConfigService(this.rpc, {
      compatibility,
      sessionSecret: this.sessionSecret,
      sessionId: this.sessionId,
      launcherCwd: options.launcherCwd,
    });
    this.processSupervisor = new ProcessSupervisor({
      cwd: options.launcherCwd,
      codexHome: process.env.CODEX_HOME ?? `${process.env.HOME ?? ""}/.codex`,
      codexSqliteHome: process.env.CODEX_SQLITE_HOME ?? `${process.env.HOME ?? ""}/.codex`,
      logger: this.logger,
    });
    this.browserSessionHub = new BrowserSessionHub({
      threadRegistry: this.threadRegistry,
      getGlobalSnapshot: () => this.getRealtimeGlobalSnapshot(),
      sessionId: this.sessionId,
      onThreadSubscriptionChanged: (threadId) => {
        this.threadRegistry.touch(threadId);
      },
    });

    this.rpc.on("notification", (payload) => {
      void this.handleNotification(payload.method, payload.params);
    });
    this.rpc.on("serverRequest", (payload) => {
      void this.handleServerRequest(payload.id, payload.method, payload.params);
    });

    this.processSupervisor.on("spawn", ({ child, restarted }) => {
      this.transportReady = this.bootstrapTransport(child, restarted);
    });
    this.processSupervisor.on("restarting", () => {
      this.logger.warn("bridge", "Process supervisor requested a single automatic restart.");
    });
    this.processSupervisor.on("fatal", ({ code, signal }) => {
      this.logger.error("bridge", "Process supervisor reached fatal exit state.", { code, signal });
    });

    this.idleUnloadInterval = setInterval(() => {
      void this.sweepIdleThreads();
    }, 30_000);
    this.idleUnloadInterval.unref();
  }

  static async create(options: CreateBridgeOptions) {
    const { stdout } = await execFileAsync("codex", ["--version"], { cwd: options.launcherCwd });
    const cliVersion = stdout.trim();
    const compatibility = evaluateCompatibility(cliVersion);
    if (compatibility.mode === "unsupported") {
      throw new Error(compatibility.message ?? `Unsupported codex-cli version: ${cliVersion}`);
    }

    const bridge = new CodexBridge(cliVersion, compatibility, options);
    bridge.resetTransportPromise();
    await bridge.processSupervisor.start();
    await bridge.waitUntilReady();
    return bridge;
  }

  async waitUntilReady() {
    await this.transportReady;
  }

  async stop() {
    clearInterval(this.idleUnloadInterval);
    await this.processSupervisor.stop();
  }

  getSessionSecret() {
    return this.sessionSecret;
  }

  async getBootstrap(cwd?: string | null, threadId?: string | null): Promise<BootstrapResponse> {
    await this.waitUntilReady();
    const snapshot = await this.accountConfigService.buildBootstrap(cwd ?? null, threadId ?? null);
    return {
      ...snapshot,
      pendingRequests: this.pendingRequestRouter.list(),
      logs: this.logger.list(),
    };
  }

  async listThreads(query: URLSearchParams) {
    await this.waitUntilReady();
    const raw = await this.rpc.request("thread/list", {
      cursor: query.get("cursor"),
      limit: query.has("limit") ? Number(query.get("limit")) : 50,
      archived: query.has("archived") ? query.get("archived") === "true" : null,
      cwd: query.get("cwd"),
      searchTerm: query.get("searchTerm"),
      sourceKinds: query.getAll("sourceKinds").length > 0 ? query.getAll("sourceKinds") : getDefaultSourceKinds(),
      sortKey: query.get("sortKey"),
      modelProviders: query.getAll("modelProviders"),
    });
    return decodeThreadListResponse(raw);
  }

  async readThread(threadId: string): Promise<ThreadDetailResponse> {
    await this.waitUntilReady();
    const runtime = this.threadRegistry.get(threadId);
    if (runtime?.loaded) {
      this.threadRegistry.touch(threadId);
      return {
        snapshot: runtime.state,
        availableApps: await this.accountConfigService.getApps(threadId),
      };
    }

    let raw: unknown;
    try {
      raw = await this.rpc.request("thread/read", { threadId, includeTurns: true });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn("bridge", "thread/read failed, trying compatibility fallback", {
        threadId,
        error: message,
      });

      if (!isThreadReadMaterializationError(error) && !isThreadReadNotFoundError(error)) {
        return this.resumeThread(threadId);
      }

      try {
        raw = await this.rpc.request("thread/read", { threadId, includeTurns: false });
      } catch (fallbackError) {
        this.logger.warn("bridge", "thread/read compatibility fallback failed, resuming thread instead", {
          threadId,
          error: getErrorMessage(fallbackError),
        });
        return this.resumeThread(threadId);
      }
    }

    try {
      const thread = decodeThreadResponse(raw);
      const record = this.threadRegistry.hydrate(thread, runtime?.state.header ?? null, runtime?.loaded ?? false);
      return {
        snapshot: record.state,
        availableApps: await this.accountConfigService.getApps(threadId),
      };
    } catch (error) {
      this.logger.warn("bridge", "thread/read payload decode failed, resuming thread instead", {
        threadId,
        error: getErrorMessage(error),
      });
      return this.resumeThread(threadId);
    }
  }

  async startThread(body: Record<string, unknown>) {
    await this.waitUntilReady();
    const initialInput = this.normalizeInputArray(body.input);
    const raw = await this.rpc.request("thread/start", {
      model: body.model ?? null,
      modelProvider: body.modelProvider ?? null,
      serviceTier: body.serviceTier ?? null,
      cwd: body.cwd ?? this.options.launcherCwd,
      approvalPolicy: body.approvalPolicy ?? null,
      sandbox: body.sandbox ?? null,
      config: body.config ?? null,
      serviceName: "codex_webui",
      baseInstructions: body.baseInstructions ?? null,
      developerInstructions: body.developerInstructions ?? null,
      personality: body.personality ?? null,
      ephemeral: body.ephemeral ?? null,
      experimentalRawEvents: false,
      persistExtendedHistory: this.compatibility.mode === "full",
    });

    const operation = decodeThreadOperationResponse(raw);
    const header = buildThreadHeader(operation, this.cliVersion, operation.thread);
    const record = this.threadRegistry.hydrate(operation.thread, header, true);

    if (initialInput.length > 0) {
      await this.startTurn(operation.thread.id, { input: initialInput });
      return this.readThread(operation.thread.id);
    }

    return {
      snapshot: record.state,
      availableApps: await this.accountConfigService.getApps(operation.thread.id),
    };
  }

  async resumeThread(threadId: string, body: Record<string, unknown> = {}) {
    await this.waitUntilReady();
    const raw = await this.rpc.request("thread/resume", {
      threadId,
      model: body.model ?? null,
      modelProvider: body.modelProvider ?? null,
      serviceTier: body.serviceTier ?? null,
      cwd: body.cwd ?? null,
      approvalPolicy: body.approvalPolicy ?? null,
      sandbox: body.sandbox ?? null,
      config: body.config ?? null,
      baseInstructions: body.baseInstructions ?? null,
      developerInstructions: body.developerInstructions ?? null,
      personality: body.personality ?? null,
      persistExtendedHistory: this.compatibility.mode === "full",
    });

    const operation = decodeThreadOperationResponse(raw);
    const header = buildThreadHeader(operation, this.cliVersion, operation.thread);
    const record = this.threadRegistry.hydrate(operation.thread, header, true);
    return {
      snapshot: record.state,
      availableApps: await this.accountConfigService.getApps(threadId),
    };
  }

  async forkThread(threadId: string, body: Record<string, unknown> = {}) {
    await this.waitUntilReady();
    const raw = await this.rpc.request("thread/fork", {
      threadId,
      path: body.path ?? null,
      model: body.model ?? null,
      modelProvider: body.modelProvider ?? null,
      serviceTier: body.serviceTier ?? null,
      cwd: body.cwd ?? null,
      approvalPolicy: body.approvalPolicy ?? null,
      sandbox: body.sandbox ?? null,
      config: body.config ?? null,
      baseInstructions: body.baseInstructions ?? null,
      developerInstructions: body.developerInstructions ?? null,
      persistExtendedHistory: this.compatibility.mode === "full",
    });

    const operation = decodeThreadOperationResponse(raw);
    const header = buildThreadHeader(operation, this.cliVersion, operation.thread);
    const record = this.threadRegistry.hydrate(operation.thread, header, true);
    return {
      snapshot: record.state,
      availableApps: await this.accountConfigService.getApps(operation.thread.id),
    };
  }

  async archiveThread(threadId: string) {
    await this.waitUntilReady();
    return this.rpc.request("thread/archive", { threadId });
  }

  async unarchiveThread(threadId: string) {
    await this.waitUntilReady();
    return this.rpc.request("thread/unarchive", { threadId });
  }

  async renameThread(threadId: string, name: string) {
    await this.waitUntilReady();
    return this.rpc.request("thread/name/set", { threadId, name });
  }

  async startTurn(threadId: string, body: Record<string, unknown>) {
    await this.waitUntilReady();
    await this.ensureThreadLive(threadId);
    const raw = await this.rpc.request("turn/start", {
      threadId,
      input: this.normalizeInputArray(body.input),
      cwd: body.cwd ?? null,
      approvalPolicy: body.approvalPolicy ?? null,
      sandboxPolicy: body.sandboxPolicy ?? null,
      model: body.model ?? null,
      serviceTier: body.serviceTier ?? null,
      effort: body.effort ?? null,
      summary: body.summary ?? null,
      personality: body.personality ?? null,
      outputSchema: body.outputSchema ?? null,
      collaborationMode: body.collaborationMode ?? null,
    });
    const turn = decodeTurnStartResponse(raw);
    const applied = this.threadRegistry.applyEvent(threadId, { kind: "turn.started", threadId, turn });
    if (applied) {
      this.browserSessionHub.broadcastThreadEvent(threadId, applied.seq, { kind: "turn.started", threadId, turn });
    }
    return this.readThread(threadId);
  }

  async interruptTurn(threadId: string, turnId: string) {
    await this.waitUntilReady();
    return this.rpc.request("turn/interrupt", { threadId, turnId });
  }

  async steerTurn(threadId: string, turnId: string, body: Record<string, unknown>) {
    await this.waitUntilReady();
    return this.rpc.request("turn/steer", {
      threadId,
      expectedTurnId: turnId,
      input: this.normalizeInputArray(body.input),
    });
  }

  async reviewThread(threadId: string, body: Record<string, unknown>) {
    await this.waitUntilReady();
    const raw = await this.rpc.request("review/start", {
      threadId,
      target: body.target ?? { type: "uncommittedChanges" },
      delivery: body.delivery ?? "inline",
    });
    return decodeReviewStartResponse(raw);
  }

  async respondToServerRequest(id: string, body: unknown) {
    await this.waitUntilReady();
    this.rpc.respond(id, body);
    return { ok: true };
  }

  async getConfig() {
    await this.waitUntilReady();
    const bootstrap = await this.getBootstrap();
    return {
      compatibility: this.compatibility,
      config: bootstrap.config,
      requirements: bootstrap.configRequirements,
      models: bootstrap.models,
      degradedFeatures: bootstrap.degradedFeatures,
    };
  }

  async writeConfigBatch(body: Record<string, unknown>) {
    await this.waitUntilReady();
    const result = await this.rpc.request("config/batchWrite", {
      edits: body.edits ?? [],
      filePath: body.filePath ?? null,
      expectedVersion: body.expectedVersion ?? null,
      reloadUserConfig: body.reloadUserConfig ?? true,
    });
    await Promise.all([this.accountConfigService.refreshConfig(), this.accountConfigService.refreshModels()]);
    await this.emitGlobalConfigUpdated();
    return result;
  }

  async getAccount() {
    await this.waitUntilReady();
    return {
      compatibility: this.compatibility,
      ...(await this.accountConfigService.refreshAccount()),
    };
  }

  async loginAccount(body: Record<string, unknown>) {
    await this.waitUntilReady();
    const result = await this.rpc.request("account/login/start", body);
    if (body.type === "apiKey") {
      const account = await this.accountConfigService.refreshAccount();
      this.browserSessionHub.broadcastGlobalEvent({ kind: "account.updated", account });
    }
    return result;
  }

  async logoutAccount() {
    await this.waitUntilReady();
    const result = await this.rpc.request("account/logout", undefined);
    const account = await this.accountConfigService.refreshAccount();
    this.browserSessionHub.broadcastGlobalEvent({ kind: "account.updated", account });
    return result;
  }

  private async bootstrapTransport(child: Parameters<JsonRpcClient["attach"]>[0], restarted: boolean) {
    this.resetTransportPromise();
    try {
      this.rpc.attach(child);
      await this.rpc.request("initialize", {
        clientInfo: {
          name: "codex_webui",
          title: "Codex WebUI",
          version: "0.1.0",
        },
        capabilities: {
          experimentalApi: this.compatibility.mode === "full",
          optOutNotificationMethods: ["codex/event/session_configured"],
        },
      });
      this.rpc.notify("initialized");
      await this.accountConfigService.initialize();

      if (restarted) {
        this.pendingRequestRouter.clear();
        const updates = this.threadRegistry.markDisconnectedAll("codex app-server restarted. Resume explicitly to continue.");
        for (const update of updates) {
          this.browserSessionHub.broadcastThreadEvent(update.threadId, update.seq, update.event);
        }
        this.browserSessionHub.broadcastGlobalEvent({ kind: "pending.updated", pendingRequests: [] });
      }

      this.resolveTransportReady?.();
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error(String(error));
      this.rejectTransportReady?.(resolvedError);
      this.logger.error("bridge", "Failed to bootstrap app-server transport.", {
        error: resolvedError.message,
      });
      throw resolvedError;
    }
  }

  private resetTransportPromise() {
    this.transportReady = new Promise<void>((resolve, reject) => {
      this.resolveTransportReady = resolve;
      this.rejectTransportReady = reject;
    });
  }

  private getRealtimeGlobalSnapshot(): Extract<BrowserRealtimeServerMessage, { type: "global.snapshot" }>["snapshot"] {
    return {
      pendingRequests: this.pendingRequestRouter.list(),
      logs: this.logger.list(),
      account: this.accountConfigService.getCurrentAccount(),
      config: this.accountConfigService.getCurrentConfig(),
      configRequirements: this.accountConfigService.getCurrentConfigRequirements(),
      models: this.accountConfigService.getCurrentModels(),
      degradedFeatures: this.compatibility.mode === "degraded" ? ["request_user_input", "persistExtendedHistory"] : [],
      apps: [],
      skills: [],
    };
  }

  private async emitGlobalConfigUpdated() {
    const bootstrap = await this.getBootstrap();
    this.browserSessionHub.broadcastGlobalEvent({
      kind: "config.updated",
      config: bootstrap.config,
      configRequirements: bootstrap.configRequirements,
      models: bootstrap.models,
    });
  }

  private async ensureThreadLive(threadId: string) {
    const runtime = this.threadRegistry.get(threadId);
    if (runtime?.loaded && !runtime.state.disconnected) {
      return runtime.state;
    }
    const resumed = await this.resumeThread(threadId);
    return resumed.snapshot;
  }

  private normalizeInputArray(rawInput: unknown): CodexUserInput[] {
    if (!Array.isArray(rawInput)) {
      return [];
    }
    return rawInput.filter((item) => item && typeof item === "object") as CodexUserInput[];
  }

  private async handleServerRequest(id: string, method: string, params: unknown) {
    const record = this.pendingRequestRouter.register(id, method, params);
    if (record.threadId && this.threadRegistry.get(record.threadId)) {
      const event: ThreadRealtimeEvent = { kind: "pending.request.created", request: record };
      const applied = this.threadRegistry.applyEvent(record.threadId, event);
      if (applied) {
        this.browserSessionHub.broadcastThreadEvent(record.threadId, applied.seq, event);
      }
    }

    this.browserSessionHub.broadcastGlobalEvent({
      kind: "pending.updated",
      pendingRequests: this.pendingRequestRouter.list(),
    });
  }

  private async handleNotification(method: string, params: unknown) {
    this.logger.debug("bridge", `notification:${method}`, params);

    switch (method) {
      case "thread/started": {
        const thread = decodeThread(z.object({ thread: z.unknown() }).parse(params).thread);
        this.hydrateAndBroadcast(thread, "thread.upsert");
        return;
      }
      case "thread/status/changed": {
        const parsed = z.object({ threadId: z.string(), status: z.unknown() }).parse(params);
        this.applyThreadEvent(parsed.threadId, {
          kind: "thread.status.changed",
          threadId: parsed.threadId,
          status: normalizeThreadStatus(parsed.status),
        });
        return;
      }
      case "thread/name/updated": {
        const parsed = z.object({ threadId: z.string(), name: z.string().nullable() }).parse(params);
        this.applyThreadEvent(parsed.threadId, {
          kind: "thread.name.updated",
          threadId: parsed.threadId,
          name: parsed.name,
        });
        return;
      }
      case "thread/archived":
      case "thread/unarchived":
      case "thread/closed": {
        const parsed = z.object({ threadId: z.string() }).parse(params);
        const event: ThreadRealtimeEvent =
          method === "thread/archived"
            ? { kind: "thread.archived", threadId: parsed.threadId }
            : method === "thread/unarchived"
              ? { kind: "thread.unarchived", threadId: parsed.threadId }
              : { kind: "thread.closed", threadId: parsed.threadId };
        this.applyThreadEvent(parsed.threadId, event);
        return;
      }
      case "turn/started":
      case "turn/completed": {
        const parsed = TURN_NOTIFICATION_SCHEMA.parse(params);
        const turn = decodeTurnStartResponse({ turn: parsed.turn });
        const event: ThreadRealtimeEvent =
          method === "turn/started"
            ? { kind: "turn.started", threadId: parsed.threadId, turn }
            : { kind: "turn.completed", threadId: parsed.threadId, turn };
        this.applyThreadEvent(parsed.threadId, event);
        return;
      }
      case "item/started":
      case "item/completed": {
        const parsed = ITEM_NOTIFICATION_SCHEMA.parse(params);
        const item = normalizeTurnItem(parsed.item);
        const event: ThreadRealtimeEvent =
          method === "item/started"
            ? { kind: "item.started", threadId: parsed.threadId, turnId: parsed.turnId, item }
            : { kind: "item.completed", threadId: parsed.threadId, turnId: parsed.turnId, item };
        this.applyThreadEvent(parsed.threadId, event);
        return;
      }
      case "item/agentMessage/delta": {
        const parsed = STRING_DELTA_SCHEMA.parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "item.agentMessage.delta", ...parsed });
        return;
      }
      case "item/reasoning/summaryPartAdded": {
        const parsed = z.object({ threadId: z.string(), turnId: z.string(), itemId: z.string(), summaryIndex: z.number() }).parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "item.reasoning.summaryPartAdded", ...parsed });
        return;
      }
      case "item/reasoning/summaryTextDelta": {
        const parsed = z
          .object({ threadId: z.string(), turnId: z.string(), itemId: z.string(), summaryIndex: z.number(), delta: z.string() })
          .parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "item.reasoning.summaryTextDelta", ...parsed });
        return;
      }
      case "item/reasoning/textDelta": {
        const parsed = z
          .object({ threadId: z.string(), turnId: z.string(), itemId: z.string(), contentIndex: z.number(), delta: z.string() })
          .parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "item.reasoning.textDelta", ...parsed });
        return;
      }
      case "item/commandExecution/outputDelta": {
        const parsed = STRING_DELTA_SCHEMA.parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "item.commandExecution.outputDelta", ...parsed });
        return;
      }
      case "item/fileChange/outputDelta": {
        const parsed = STRING_DELTA_SCHEMA.parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "item.fileChange.outputDelta", ...parsed });
        return;
      }
      case "item/commandExecution/terminalInteraction": {
        const parsed = z
          .object({ threadId: z.string(), turnId: z.string(), itemId: z.string(), processId: z.string(), stdin: z.string() })
          .parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "item.commandExecution.terminalInteraction", ...parsed });
        return;
      }
      case "turn/diff/updated": {
        const parsed = z.object({ threadId: z.string(), turnId: z.string(), diff: z.string() }).parse(params);
        this.applyThreadEvent(parsed.threadId, { kind: "turn.diff.updated", ...parsed });
        return;
      }
      case "turn/plan/updated": {
        const parsed = z
          .object({
            threadId: z.string(),
            turnId: z.string(),
            explanation: z.string().nullable(),
            plan: z.array(z.object({ step: z.string(), status: z.string() }).passthrough()),
          })
          .parse(params);
        this.applyThreadEvent(parsed.threadId, {
          kind: "turn.plan.updated",
          threadId: parsed.threadId,
          turnId: parsed.turnId,
          explanation: parsed.explanation,
          plan: parsed.plan,
        });
        return;
      }
      case "error": {
        const parsed = z
          .object({
            threadId: z.string(),
            turnId: z.string(),
            willRetry: z.boolean(),
            error: z.object({
              message: z.string(),
              additionalDetails: z.string().nullable().optional(),
              codexErrorInfo: z.unknown().nullable().optional(),
            }),
          })
          .parse(params);
        this.applyThreadEvent(parsed.threadId, {
          kind: "turn.error",
          threadId: parsed.threadId,
          turnId: parsed.turnId,
          error: parsed.error,
          willRetry: parsed.willRetry,
        });
        return;
      }
      case "serverRequest/resolved": {
        const parsed = z.object({ threadId: z.string(), requestId: z.union([z.string(), z.number()]) }).parse(params);
        this.pendingRequestRouter.resolve(String(parsed.requestId));
        this.applyThreadEvent(parsed.threadId, {
          kind: "pending.request.resolved",
          threadId: parsed.threadId,
          requestId: String(parsed.requestId),
        });
        this.browserSessionHub.broadcastGlobalEvent({
          kind: "pending.updated",
          pendingRequests: this.pendingRequestRouter.list(),
        });
        return;
      }
      case "account/updated":
      case "account/login/completed":
      case "account/rateLimits/updated": {
        const account = await this.accountConfigService.refreshAccount();
        this.browserSessionHub.broadcastGlobalEvent({ kind: "account.updated", account });
        return;
      }
      case "skills/changed": {
        const bootstrap = await this.getBootstrap();
        this.browserSessionHub.broadcastGlobalEvent({ kind: "catalog.updated", skills: bootstrap.skills });
        return;
      }
      case "app/list/updated": {
        const bootstrap = await this.getBootstrap();
        this.browserSessionHub.broadcastGlobalEvent({ kind: "catalog.updated", apps: bootstrap.apps });
        return;
      }
      case "configWarning":
      case "deprecationNotice": {
        this.logger.warn("bridge", method, params);
        return;
      }
      default:
        return;
    }
  }

  private hydrateAndBroadcast(thread: CodexThread, eventKind: "thread.upsert", header?: ThreadHeader | null) {
    const existingHeader = this.threadRegistry.get(thread.id)?.state.header ?? null;
    const record = this.threadRegistry.hydrate(thread, header ?? existingHeader, true);
    const event: ThreadRealtimeEvent = { kind: eventKind, thread, header: record.state.header };
    const applied = this.threadRegistry.applyEvent(thread.id, event);
    if (applied) {
      this.browserSessionHub.broadcastThreadEvent(thread.id, applied.seq, event);
    }
  }

  private applyThreadEvent(threadId: string, event: ThreadRealtimeEvent) {
    const applied = this.threadRegistry.applyEvent(threadId, event);
    if (applied) {
      this.browserSessionHub.broadcastThreadEvent(threadId, applied.seq, event);
    }
  }

  private async sweepIdleThreads() {
    await this.waitUntilReady();
    const now = Date.now();
    for (const [threadId, record] of this.threadRegistry.listLoaded()) {
      if (record.subscriberCount > 0 || record.state.pendingRequests.length > 0 || record.state.thread.status.type === "active") {
        continue;
      }
      if (now - record.lastTouched < 90_000) {
        continue;
      }
      try {
        await this.rpc.request("thread/unsubscribe", { threadId });
        this.threadRegistry.setLoaded(threadId, false);
        this.logger.info("bridge", "Unsubscribed idle thread", { threadId });
      } catch (error) {
        this.logger.warn("bridge", "Failed to unsubscribe idle thread", {
          threadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
