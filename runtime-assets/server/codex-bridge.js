"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexBridge = void 0;
const node_events_1 = require("node:events");
const node_path_1 = require("node:path");
const node_child_process_1 = require("node:child_process");
const node_readline_1 = __importDefault(require("node:readline"));
const STREAMING_NOTIFICATION_METHODS = new Set([
    "item/agentMessage/delta",
    "item/reasoning/summaryPartAdded",
    "item/reasoning/textDelta",
    "item/reasoning/summaryTextDelta",
    "item/plan/delta",
    "item/commandExecution/outputDelta",
    "item/fileChange/outputDelta",
]);
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function extractThreadStatusLabel(status) {
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
function bodyFromLines(lines) {
    return lines
        .filter((line) => Boolean(line && line.trim().length > 0))
        .join("\n");
}
const threadListDateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});
function formatThreadSourceLabel(source) {
    if (typeof source !== "string") {
        return source.subAgent ? `Sub-agent ${source.subAgent}` : "Sub-agent";
    }
    switch (source) {
        case "vscode":
            return "VS Code";
        case "exec":
            return "Exec";
        case "appServer":
            return "App Server";
        case "cli":
        default:
            return "CLI";
    }
}
function getWorkspaceBaseName(cwd) {
    const normalized = cwd.replace(/[\\/]+$/, "");
    return (0, node_path_1.basename)(normalized) || cwd || "workspace";
}
function formatWorkspaceLabel(cwd) {
    const normalized = cwd.replace(/[\\/]+$/, "");
    if (!normalized) {
        return ".";
    }
    const parts = normalized.split(/[\\/]+/).filter(Boolean);
    if (parts.length <= 3) {
        return normalized;
    }
    return `.../${parts.slice(-3).join("/")}`;
}
function stripThreadTurns(thread) {
    if (thread.turns.length === 0) {
        return thread;
    }
    return {
        ...thread,
        turns: [],
    };
}
function formatThreadListTimestamp(unixSeconds) {
    return threadListDateFormatter.format(new Date(unixSeconds * 1000));
}
function buildThreadListTitle(thread) {
    const trimmedName = thread.name?.trim();
    if (trimmedName) {
        return trimmedName;
    }
    return `${getWorkspaceBaseName(thread.cwd)} · ${formatThreadListTimestamp(thread.updatedAt)}`;
}
function buildThreadListItem(thread, isActive) {
    const title = buildThreadListTitle(thread);
    const workspaceLabel = formatWorkspaceLabel(thread.cwd);
    const sourceLabel = formatThreadSourceLabel(thread.source);
    const statusLabel = thread.status.type === "active" || thread.status.type === "systemError"
        ? extractThreadStatusLabel(thread.status)
        : null;
    return {
        id: thread.id,
        title,
        workspaceLabel,
        workspacePath: thread.cwd,
        branch: thread.gitInfo?.branch ?? null,
        statusLabel,
        sourceLabel,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        isActive,
        searchText: [
            title,
            thread.name ?? "",
            thread.cwd,
            thread.gitInfo?.branch ?? "",
            sourceLabel,
            statusLabel ?? "",
        ]
            .join(" ")
            .trim()
            .toLowerCase(),
    };
}
function buildWorkspaceOptions(threads, defaultWorkspacePath) {
    const byPath = new Map();
    for (const thread of threads) {
        const current = byPath.get(thread.cwd);
        const next = {
            path: thread.cwd,
            label: formatWorkspaceLabel(thread.cwd),
            threadCount: (current?.threadCount ?? 0) + 1,
            lastUsedAt: current?.lastUsedAt
                ? Math.max(current.lastUsedAt, thread.updatedAt)
                : thread.updatedAt,
            isCurrent: thread.cwd === defaultWorkspacePath,
        };
        byPath.set(thread.cwd, next);
    }
    if (!byPath.has(defaultWorkspacePath)) {
        byPath.set(defaultWorkspacePath, {
            path: defaultWorkspacePath,
            label: formatWorkspaceLabel(defaultWorkspacePath),
            threadCount: 0,
            lastUsedAt: null,
            isCurrent: true,
        });
    }
    return [...byPath.values()].sort((left, right) => {
        const leftScore = left.lastUsedAt ?? 0;
        const rightScore = right.lastUsedAt ?? 0;
        return rightScore - leftScore;
    });
}
function stringifyUnknown(value) {
    if (typeof value === "string") {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
function summarizeUserInputs(content) {
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
function resolveTimelineEntryId(itemType, itemId, turnId) {
    return turnId ? `${turnId}:${itemType}:${itemId}` : `${itemType}:${itemId}`;
}
function buildFileChangeBody(item) {
    return ((item.changes ?? [])
        .map((change) => bodyFromLines([
        `${formatPatchChangeKind(change.kind)} ${change.path}`.trim(),
        change.diff,
    ]))
        .join("\n\n"));
}
function formatPatchChangeKind(kind) {
    if (!isRecord(kind) || typeof kind.type !== "string") {
        return "UPDATE";
    }
    switch (kind.type) {
        case "add":
            return "ADD";
        case "delete":
            return "DELETE";
        case "update":
            return typeof kind.move_path === "string" && kind.move_path.trim().length > 0
                ? `RENAME ${kind.move_path}`
                : "UPDATE";
        default:
            return kind.type.toUpperCase();
    }
}
function buildReasoningBody(item) {
    return bodyFromLines([
        ...((item.summary ?? []).map((line) => `• ${line}`)),
        ...((item.content ?? []).map((line) => line)),
    ]);
}
function mergeItemChangeRecords(existingValue, completedValue) {
    if (!Array.isArray(existingValue) || !Array.isArray(completedValue)) {
        return typeof completedValue === "undefined" ? existingValue : completedValue;
    }
    const nextLength = Math.max(existingValue.length, completedValue.length);
    const merged = [];
    for (let index = 0; index < nextLength; index += 1) {
        const existingEntry = isRecord(existingValue[index]) ? existingValue[index] : null;
        const completedEntry = isRecord(completedValue[index]) ? completedValue[index] : null;
        if (!existingEntry || !completedEntry) {
            merged.push(completedEntry ?? existingEntry);
            continue;
        }
        merged.push({
            ...existingEntry,
            ...completedEntry,
            diff: typeof completedEntry.diff === "string"
                ? completedEntry.diff
                : existingEntry.diff,
            kind: typeof completedEntry.kind === "undefined"
                ? existingEntry.kind
                : completedEntry.kind,
        });
    }
    return merged;
}
function mergeStreamingCompletionItem(currentValue, completedValue) {
    if (!currentValue) {
        return completedValue;
    }
    const merged = {
        ...currentValue,
        ...completedValue,
    };
    if (typeof completedValue.text === "undefined" && typeof currentValue.text === "string") {
        merged.text = currentValue.text;
    }
    if (typeof completedValue.aggregatedOutput === "undefined" &&
        typeof currentValue.aggregatedOutput === "string") {
        merged.aggregatedOutput = currentValue.aggregatedOutput;
    }
    if (typeof completedValue.summary === "undefined" && Array.isArray(currentValue.summary)) {
        merged.summary = currentValue.summary;
    }
    if (typeof completedValue.content === "undefined" && Array.isArray(currentValue.content)) {
        merged.content = currentValue.content;
    }
    merged.changes = mergeItemChangeRecords(currentValue.changes, completedValue.changes);
    return merged;
}
function ensureTextAtIndex(currentValue, index, delta) {
    const next = Array.isArray(currentValue)
        ? currentValue.map((value) => (typeof value === "string" ? value : ""))
        : [];
    while (next.length <= index) {
        next.push("");
    }
    next[index] += delta;
    return next;
}
function appendText(currentValue, delta, withNewline = false) {
    const current = typeof currentValue === "string" ? currentValue : "";
    if (withNewline &&
        current.length > 0 &&
        !current.endsWith("\n") &&
        delta.length > 0) {
        return `${current}\n${delta}`;
    }
    return `${current}${delta}`;
}
function createStreamingItem(itemType, itemId) {
    switch (itemType) {
        case "agentMessage":
            return {
                type: itemType,
                id: itemId,
                text: "",
                phase: null,
            };
        case "reasoning":
            return {
                type: itemType,
                id: itemId,
                summary: [],
                content: [],
            };
        case "plan":
            return {
                type: itemType,
                id: itemId,
                text: "",
            };
        case "commandExecution":
            return {
                type: itemType,
                id: itemId,
                command: "",
                cwd: "",
                processId: null,
                status: "inProgress",
                commandActions: [],
                aggregatedOutput: "",
                exitCode: null,
                durationMs: null,
            };
        case "fileChange":
            return {
                type: itemType,
                id: itemId,
                changes: [
                    {
                        path: "Live patch",
                        kind: {
                            type: "update",
                            move_path: null,
                        },
                        diff: "",
                    },
                ],
                status: "inProgress",
            };
        default:
            return {
                type: itemType,
                id: itemId,
            };
    }
}
function createTurnTimelineEntry(threadId, turn, updatedAt) {
    return {
        id: `turn:${turn.id}`,
        threadId,
        turnId: turn.id,
        kind: "turn",
        title: `Turn ${turn.id.slice(0, 8)}`,
        body: turn.status === "inProgress"
            ? "Streaming live output."
            : turn.status === "failed" && turn.error
                ? stringifyUnknown(turn.error)
                : `status: ${turn.status}`,
        tone: turn.status === "failed" ? "danger" : "muted",
        status: turn.status === "failed"
            ? "error"
            : turn.status === "inProgress"
                ? "running"
                : "completed",
        updatedAt,
    };
}
function timelineStatusFromItemStatus(status, fallbackStatus) {
    switch (status) {
        case "inProgress":
            return "running";
        case "completed":
        case "declined":
            return "completed";
        case "failed":
            return "error";
        default:
            return fallbackStatus;
    }
}
function getHydratedTimelineStatus(turn, item) {
    const itemType = typeof item.type === "string" ? item.type : "unknown";
    if (itemType === "userMessage") {
        return "completed";
    }
    if (typeof item.status === "string") {
        const fallbackStatus = turn.status === "inProgress" ? "running" : "completed";
        return timelineStatusFromItemStatus(item.status, fallbackStatus);
    }
    if (turn.status === "inProgress") {
        return "running";
    }
    return "completed";
}
function mergeHydratedTimelineEntry(existing, next) {
    if (!existing) {
        return next;
    }
    if (areTimelineEntriesEquivalent(existing, next)) {
        return {
            ...next,
            updatedAt: existing.updatedAt,
        };
    }
    return next;
}
function areTimelineEntriesEquivalent(existing, next) {
    return (existing.id === next.id &&
        existing.threadId === next.threadId &&
        existing.turnId === next.turnId &&
        existing.kind === next.kind &&
        existing.title === next.title &&
        existing.body === next.body &&
        existing.tone === next.tone &&
        existing.status === next.status &&
        existing.rawMethod === next.rawMethod);
}
function timelineEntryFromTurnItem(threadId, turnId, item, status) {
    const itemId = typeof item.id === "string" ? item.id : `item-${Date.now()}`;
    const itemType = typeof item.type === "string" ? item.type : "unknown";
    const entryId = resolveTimelineEntryId(itemType, itemId, turnId);
    const now = Date.now();
    switch (itemType) {
        case "userMessage":
            return {
                id: entryId,
                threadId,
                turnId,
                kind: "message",
                title: "User input",
                body: summarizeUserInputs(item.content ?? []),
                tone: "neutral",
                status,
                rawMethod: "thread/read",
                updatedAt: now,
            };
        case "agentMessage":
            return {
                id: entryId,
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
                id: entryId,
                threadId,
                turnId,
                kind: "reasoning",
                title: "Reasoning",
                body: buildReasoningBody(item),
                tone: "muted",
                status,
                updatedAt: now,
            };
        case "plan":
            return {
                id: entryId,
                threadId,
                turnId,
                kind: "plan",
                title: "Plan",
                body: typeof item.text === "string" ? item.text : "",
                tone: "accent",
                status,
                updatedAt: now,
            };
        case "commandExecution":
            return {
                id: entryId,
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
                id: entryId,
                threadId,
                turnId,
                kind: "diff",
                title: "Edited content",
                body: buildFileChangeBody(item),
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
                id: entryId,
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
                id: entryId,
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
                id: entryId,
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
function isThreadNotMaterializedError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return /not materialized yet|includeTurns is unavailable before first user message/i.test(error.message);
}
function createApprovalTimelineEntry(request) {
    return {
        id: `request:${request.id}`,
        threadId: request.threadId,
        turnId: request.turnId,
        kind: "approval",
        title: request.summary,
        body: request.detail,
        tone: "warning",
        status: request.status,
        rawMethod: request.method,
        updatedAt: request.createdAt,
    };
}
function insertApprovalTimelineEntry(entries, approvalEntry, afterEntryId) {
    if (afterEntryId) {
        const anchorIndex = entries.findIndex((entry) => entry.id === afterEntryId);
        if (anchorIndex !== -1) {
            entries.splice(anchorIndex + 1, 0, approvalEntry);
            return;
        }
    }
    if (!approvalEntry.turnId) {
        entries.push(approvalEntry);
        return;
    }
    const insertionIndex = [...entries]
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.turnId === approvalEntry.turnId)
        .at(-1)?.index;
    if (typeof insertionIndex !== "number") {
        entries.push(approvalEntry);
        return;
    }
    entries.splice(insertionIndex + 1, 0, approvalEntry);
}
class CodexBridge extends node_events_1.EventEmitter {
    child = null;
    requestSeq = 1;
    pendingClientRequests = new Map();
    publishTimer = null;
    state = {
        snapshotRevision: 0,
        phase: "starting",
        lastError: null,
        threads: new Map(),
        activeThreadId: null,
        activeTurnIds: new Map(),
        activeTurnStartedAt: new Map(),
        timelineByThread: new Map(),
        streamingItemsByThread: new Map(),
        pendingRequests: new Map(),
        approvalHistory: new Map(),
        models: [],
        sessionSettings: {
            model: null,
            effort: null,
            fastMode: true,
            planMode: false,
        },
    };
    readyPromise = null;
    async start() {
        if (this.readyPromise) {
            return this.readyPromise;
        }
        this.readyPromise = this.boot();
        return this.readyPromise;
    }
    async stop() {
        if (this.publishTimer) {
            clearTimeout(this.publishTimer);
            this.publishTimer = null;
        }
        if (!this.child) {
            return;
        }
        this.child.kill("SIGTERM");
        this.child = null;
    }
    async ensureReady() {
        await this.start();
    }
    getSnapshot() {
        const threads = [...this.state.threads.values()].sort((left, right) => right.updatedAt - left.updatedAt);
        const defaultWorkspacePath = process.cwd();
        const timelineByThread = {};
        const activeThreadId = this.state.activeThreadId;
        if (activeThreadId) {
            timelineByThread[activeThreadId] = this.state.timelineByThread.get(activeThreadId) ?? [];
        }
        const activeTurnId = activeThreadId
            ? this.state.activeTurnIds.get(activeThreadId) ?? null
            : null;
        const activeTurnStartedAt = activeThreadId
            ? this.state.activeTurnStartedAt.get(activeThreadId) ?? null
            : null;
        const threadList = threads.map((thread) => buildThreadListItem(thread, thread.id === activeThreadId));
        return {
            revision: this.state.snapshotRevision,
            phase: this.state.phase,
            lastError: this.state.lastError,
            threads,
            threadList,
            defaultWorkspacePath,
            workspaceOptions: buildWorkspaceOptions(threads, defaultWorkspacePath),
            activeThreadId,
            activeTurnId,
            activeTurnStartedAt,
            timelineByThread,
            pendingRequests: [...this.state.pendingRequests.values()]
                .sort((left, right) => left.createdAt - right.createdAt)
                .map(({ wireId: _wireId, ...request }) => request),
            models: this.state.models,
            sessionSettings: this.state.sessionSettings,
        };
    }
    async refreshBootstrapData() {
        await this.ensureReady();
        await Promise.allSettled([this.refreshThreads(), this.refreshModels()]);
        await this.hydrateBootstrapThread();
        this.publish();
        return this.getSnapshot();
    }
    async createThread(cwd) {
        await this.ensureReady();
        const response = (await this.sendRequest("thread/start", {
            model: this.state.sessionSettings.model,
            cwd: cwd?.trim() ? cwd.trim() : undefined,
            experimentalRawEvents: false,
            persistExtendedHistory: true,
        }));
        this.state.activeThreadId = response.thread.id;
        this.state.threads.set(response.thread.id, stripThreadTurns(response.thread));
        this.state.timelineByThread.set(response.thread.id, []);
        this.state.streamingItemsByThread.set(response.thread.id, new Map());
        await this.refreshThreads();
        this.publish();
        return this.getSnapshot();
    }
    async resumeThread(threadId) {
        await this.ensureReady();
        const response = (await this.sendRequest("thread/resume", {
            threadId,
            persistExtendedHistory: true,
        }));
        const fullThread = await this.fetchAndHydrateThread(response.thread.id);
        this.state.activeThreadId = fullThread.id;
        await this.refreshThreads();
        this.publish();
        return this.getSnapshot();
    }
    async forkThread(threadId) {
        await this.ensureReady();
        const response = (await this.sendRequest("thread/fork", {
            threadId,
            persistExtendedHistory: true,
        }));
        const fullThread = await this.fetchAndHydrateThread(response.thread.id);
        this.state.activeThreadId = fullThread.id;
        await this.refreshThreads();
        this.publish();
        return this.getSnapshot();
    }
    async readThread(threadId) {
        await this.ensureReady();
        const thread = await this.fetchAndHydrateThread(threadId);
        this.state.activeThreadId = thread.id;
        this.publish();
        return this.getSnapshot();
    }
    async setSessionSettings(settings) {
        this.state.sessionSettings = {
            ...this.state.sessionSettings,
            ...(typeof settings.model !== "undefined" ? { model: settings.model } : {}),
            ...(typeof settings.effort !== "undefined" ? { effort: settings.effort } : {}),
            ...(typeof settings.fastMode !== "undefined"
                ? { fastMode: settings.fastMode }
                : {}),
            ...(typeof settings.planMode !== "undefined"
                ? { planMode: settings.planMode }
                : {}),
        };
        this.publish();
        return this.getSnapshot();
    }
    async sendUserTurn(text) {
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
        const resolvedModel = this.getResolvedModel();
        const resolvedEffort = this.getResolvedEffort(resolvedModel);
        const collaborationMode = resolvedModel && this.state.sessionSettings.planMode
            ? {
                mode: "plan",
                settings: {
                    model: resolvedModel.model,
                    reasoning_effort: resolvedEffort,
                    developer_instructions: null,
                },
            }
            : resolvedModel && this.state.sessionSettings.fastMode
                ? {
                    mode: "default",
                    settings: {
                        model: resolvedModel.model,
                        reasoning_effort: resolvedEffort,
                        developer_instructions: null,
                    },
                }
                : undefined;
        await this.sendRequest("turn/start", {
            threadId,
            input: [
                {
                    type: "text",
                    text: normalized,
                    text_elements: [],
                },
            ],
            model: resolvedModel?.model ?? this.state.sessionSettings.model,
            effort: resolvedEffort,
            collaborationMode,
        });
        return this.getSnapshot();
    }
    async interruptActiveTurn() {
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
    async startReview() {
        await this.ensureReady();
        const threadId = this.state.activeThreadId;
        if (!threadId) {
            throw new Error("Start a thread before requesting review.");
        }
        await this.sendRequest("review/start", {
            threadId,
            target: { type: "uncommittedChanges" },
            delivery: "inline",
        });
        return this.getSnapshot();
    }
    async respondToServerRequest(requestId, result) {
        const pending = this.state.pendingRequests.get(requestId);
        if (!pending) {
            throw new Error(`Pending server request ${requestId} was not found.`);
        }
        this.sendMessage({
            id: pending.wireId,
            result,
        });
        this.state.pendingRequests.delete(requestId);
        if (pending.threadId) {
            const approvalEntry = this.findTimelineEntry(pending.threadId, `request:${requestId}`);
            if (approvalEntry) {
                approvalEntry.status = "completed";
                approvalEntry.updatedAt = Date.now();
            }
        }
        this.publish();
        return this.getSnapshot();
    }
    async boot() {
        this.child = (0, node_child_process_1.spawn)("codex", ["app-server", "--listen", "stdio://"], {
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
        const stdout = node_readline_1.default.createInterface({
            input: this.child.stdout,
            crlfDelay: Infinity,
        });
        stdout.on("line", (line) => this.handleStdoutLine(line));
        const stderr = node_readline_1.default.createInterface({
            input: this.child.stderr,
            crlfDelay: Infinity,
        });
        stderr.on("line", (line) => this.logLine(line));
        const initialize = (await this.sendRequest("initialize", {
            clientInfo: {
                name: "codex_webui",
                title: "Codex WebUI",
                version: "0.1.0",
            },
            capabilities: {
                experimentalApi: true,
            },
        }));
        this.logLine(`Initialized app-server (${initialize.userAgent}).`);
        this.sendMessage({ method: "initialized" });
        await Promise.allSettled([this.refreshThreads(), this.refreshModels()]);
        this.state.phase = "ready";
        this.publish();
    }
    flushPublish() {
        this.state.snapshotRevision += 1;
        this.emit("snapshot", this.getSnapshot());
    }
    publish(immediate = true) {
        if (immediate) {
            if (this.publishTimer) {
                clearTimeout(this.publishTimer);
                this.publishTimer = null;
            }
            this.flushPublish();
            return;
        }
        if (this.publishTimer) {
            return;
        }
        this.publishTimer = setTimeout(() => {
            this.publishTimer = null;
            this.flushPublish();
        }, 48);
    }
    logLine(line) {
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        console.error(`[codex-bridge] ${trimmed}`);
    }
    setError(message) {
        this.state.phase = "error";
        this.state.lastError = message;
        this.logLine(message);
        this.publish();
    }
    sendMessage(message) {
        if (!this.child) {
            throw new Error("codex app-server is not running.");
        }
        this.child.stdin.write(`${JSON.stringify(message)}\n`);
    }
    async refreshThreads() {
        const response = (await this.sendRequest("thread/list", {
            sourceKinds: ["cli", "vscode", "exec", "appServer"],
            sortKey: "updated_at",
        }));
        const nextThreadIds = new Set(response.data.map((thread) => thread.id));
        const preservedThreadIds = new Set();
        if (this.state.activeThreadId) {
            preservedThreadIds.add(this.state.activeThreadId);
        }
        for (const threadId of this.state.activeTurnIds.keys()) {
            preservedThreadIds.add(threadId);
        }
        for (const threadId of this.state.threads.keys()) {
            if (!nextThreadIds.has(threadId) && !preservedThreadIds.has(threadId)) {
                this.state.threads.delete(threadId);
                this.state.timelineByThread.delete(threadId);
                this.state.streamingItemsByThread.delete(threadId);
                this.state.activeTurnIds.delete(threadId);
                this.state.activeTurnStartedAt.delete(threadId);
            }
        }
        if (this.state.activeThreadId &&
            !nextThreadIds.has(this.state.activeThreadId) &&
            !preservedThreadIds.has(this.state.activeThreadId)) {
            this.state.activeThreadId = null;
        }
        for (const thread of response.data) {
            this.state.threads.set(thread.id, stripThreadTurns(thread));
            if (!this.state.timelineByThread.has(thread.id)) {
                this.state.timelineByThread.set(thread.id, []);
            }
            if (!this.state.streamingItemsByThread.has(thread.id)) {
                this.state.streamingItemsByThread.set(thread.id, new Map());
            }
        }
    }
    async refreshModels() {
        const response = (await this.sendRequest("model/list", {}));
        this.state.models = response.data.filter((model) => !model.hidden);
    }
    async readThreadWithTurns(threadId) {
        try {
            const response = (await this.sendRequest("thread/read", {
                threadId,
                includeTurns: true,
            }));
            return response.thread;
        }
        catch (error) {
            if (isThreadNotMaterializedError(error)) {
                const existing = this.state.threads.get(threadId);
                if (existing) {
                    return {
                        ...existing,
                        turns: [],
                    };
                }
            }
            throw error;
        }
    }
    async fetchAndHydrateThread(threadId) {
        const thread = await this.readThreadWithTurns(threadId);
        this.hydrateThreadTimeline(thread);
        const leanThread = stripThreadTurns(thread);
        this.state.threads.set(thread.id, leanThread);
        return leanThread;
    }
    async canonicalizeCompletedTurn(threadId, completedTurnId) {
        try {
            const thread = await this.readThreadWithTurns(threadId);
            const activeTurnId = this.state.activeTurnIds.get(threadId);
            if (activeTurnId && activeTurnId !== completedTurnId) {
                return;
            }
            const completedTurn = thread.turns.find((turn) => turn.id === completedTurnId);
            if (!completedTurn || completedTurn.status === "inProgress") {
                return;
            }
            this.hydrateThreadTimeline(thread);
            this.state.threads.set(thread.id, stripThreadTurns(thread));
            this.publish();
        }
        catch (error) {
            this.logLine(`Failed to canonicalize thread ${threadId} after turn completion: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async syncInProgressTurn(threadId, expectedTurnId) {
        try {
            const thread = await this.readThreadWithTurns(threadId);
            const activeTurnId = this.state.activeTurnIds.get(threadId);
            if (activeTurnId && activeTurnId !== expectedTurnId) {
                return;
            }
            const turn = thread.turns.find((entry) => entry.id === expectedTurnId);
            if (!turn) {
                return;
            }
            this.hydrateThreadTimeline(thread);
            this.state.threads.set(thread.id, stripThreadTurns(thread));
            this.publish();
        }
        catch (error) {
            this.logLine(`Failed to sync live thread ${threadId} while turn ${expectedTurnId} was in progress: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getResolvedModel() {
        return (this.state.models.find((model) => model.model === this.state.sessionSettings.model) ??
            this.state.models.find((model) => model.isDefault) ??
            this.state.models[0] ??
            null);
    }
    getResolvedEffort(model) {
        return this.state.sessionSettings.effort ?? model?.defaultReasoningEffort ?? null;
    }
    hydrateThreadTimeline(thread) {
        const entries = [];
        const streamingItems = new Map();
        const existingEntries = new Map((this.state.timelineByThread.get(thread.id) ?? []).map((entry) => [entry.id, entry]));
        for (const turn of thread.turns) {
            const nextTurnEntry = mergeHydratedTimelineEntry(existingEntries.get(`turn:${turn.id}`), createTurnTimelineEntry(thread.id, turn, Date.now()));
            entries.push(nextTurnEntry);
            const turnEntries = new Map();
            const turnEntryOrder = [];
            for (const item of turn.items) {
                const nextEntry = mergeHydratedTimelineEntry(existingEntries.get(resolveTimelineEntryId(typeof item.type === "string" ? item.type : "unknown", typeof item.id === "string" ? item.id : `item-${Date.now()}`, turn.id)), timelineEntryFromTurnItem(thread.id, turn.id, item, getHydratedTimelineStatus(turn, item)));
                const currentEntry = turnEntries.get(nextEntry.id);
                if (!currentEntry) {
                    turnEntryOrder.push(nextEntry.id);
                }
                turnEntries.set(nextEntry.id, mergeHydratedTimelineEntry(currentEntry, nextEntry));
                if (nextEntry.status === "running") {
                    streamingItems.set(nextEntry.id, {
                        turnId: turn.id,
                        item,
                    });
                }
            }
            for (const entryId of turnEntryOrder) {
                const entry = turnEntries.get(entryId);
                if (entry) {
                    entries.push(entry);
                }
            }
        }
        for (const approval of [...this.state.approvalHistory.values()].sort((left, right) => left.createdAt - right.createdAt)) {
            if (approval.threadId !== thread.id) {
                continue;
            }
            const approvalEntry = createApprovalTimelineEntry(approval);
            if (!approvalEntry) {
                continue;
            }
            insertApprovalTimelineEntry(entries, mergeHydratedTimelineEntry(existingEntries.get(approvalEntry.id), approvalEntry), approval.afterEntryId);
        }
        for (const request of [...this.state.pendingRequests.values()].sort((left, right) => left.createdAt - right.createdAt)) {
            if (!request.threadId || this.state.approvalHistory.has(request.id)) {
                continue;
            }
            const approvalEntry = createApprovalTimelineEntry({
                id: request.id,
                threadId: request.threadId,
                turnId: request.turnId,
                summary: request.summary,
                detail: request.detail,
                method: request.method,
                status: "pending",
                createdAt: request.createdAt,
            });
            if (!approvalEntry || approvalEntry.threadId !== thread.id) {
                continue;
            }
            insertApprovalTimelineEntry(entries, mergeHydratedTimelineEntry(existingEntries.get(approvalEntry.id), approvalEntry));
        }
        this.state.timelineByThread.set(thread.id, entries);
        this.state.streamingItemsByThread.set(thread.id, streamingItems);
    }
    resolveBootstrapThreadId() {
        const threads = [...this.state.threads.values()].sort((left, right) => right.updatedAt - left.updatedAt);
        if (this.state.activeThreadId &&
            threads.some((thread) => thread.id === this.state.activeThreadId)) {
            return this.state.activeThreadId;
        }
        return (threads.find((thread) => thread.status.type === "active")?.id ??
            null);
    }
    async hydrateBootstrapThread() {
        const threadId = this.resolveBootstrapThreadId();
        if (!threadId) {
            return;
        }
        this.state.activeThreadId = threadId;
        await this.fetchAndHydrateThread(threadId);
    }
    async sendRequest(method, params) {
        const requestId = this.requestSeq++;
        const payload = {
            id: requestId,
            method,
        };
        if (typeof params !== "undefined") {
            payload.params = params;
        }
        const promise = new Promise((resolve, reject) => {
            this.pendingClientRequests.set(String(requestId), {
                resolve: (value) => resolve(value),
                reject,
            });
        });
        this.sendMessage(payload);
        return promise;
    }
    handleStdoutLine(line) {
        if (!line.trim()) {
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch (error) {
            this.logLine(`Failed to parse app-server line: ${String(error)}`);
            return;
        }
        if (!isRecord(parsed)) {
            return;
        }
        if (typeof parsed.method === "string" && "id" in parsed) {
            this.handleServerRequest(parsed);
            return;
        }
        if (typeof parsed.method === "string") {
            this.handleNotification(parsed);
            return;
        }
        if ("id" in parsed) {
            this.handleResponse(parsed);
        }
    }
    handleResponse(response) {
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
    handleServerRequest(request) {
        const requestId = String(request.id);
        const paramsRecord = isRecord(request.params) ? request.params : {};
        const threadId = typeof paramsRecord["threadId"] === "string" ? paramsRecord["threadId"] : null;
        const turnId = typeof paramsRecord["turnId"] === "string" ? paramsRecord["turnId"] : null;
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
        const pendingRequest = this.state.pendingRequests.get(requestId);
        const afterEntryId = threadId && turnId
            ? [...(this.state.timelineByThread.get(threadId) ?? [])]
                .filter((entry) => entry.turnId === turnId)
                .at(-1)?.id ?? null
            : threadId
                ? (this.state.timelineByThread.get(threadId) ?? []).at(-1)?.id ?? null
                : null;
        if (threadId) {
            this.state.approvalHistory.set(requestId, {
                id: requestId,
                threadId,
                turnId,
                summary,
                detail,
                method: request.method,
                status: "pending",
                createdAt: pendingRequest.createdAt,
                afterEntryId,
            });
        }
        const approvalEntry = threadId && this.state.approvalHistory.has(requestId)
            ? createApprovalTimelineEntry(this.state.approvalHistory.get(requestId))
            : null;
        if (approvalEntry) {
            this.insertApprovalEntryIntoTimeline(approvalEntry.threadId, approvalEntry, afterEntryId);
        }
        this.publish();
    }
    summarizeServerRequest(method, params) {
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
    handleNotification(notification) {
        const method = notification.method;
        const params = isRecord(notification.params) ? notification.params : {};
        const now = Date.now();
        switch (method) {
            case "thread/started": {
                const thread = params.thread;
                this.state.threads.set(thread.id, stripThreadTurns(thread));
                if (!this.state.timelineByThread.has(thread.id)) {
                    this.state.timelineByThread.set(thread.id, []);
                }
                if (!this.state.streamingItemsByThread.has(thread.id)) {
                    this.state.streamingItemsByThread.set(thread.id, new Map());
                }
                if (!this.state.activeThreadId) {
                    this.state.activeThreadId = thread.id;
                }
                break;
            }
            case "thread/status/changed": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const status = params.status;
                if (threadId && status) {
                    if (!this.state.activeThreadId && status.type === "active") {
                        this.state.activeThreadId = threadId;
                    }
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
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
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
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turn = params.turn;
                if (threadId && turn) {
                    if (!this.state.activeThreadId) {
                        this.state.activeThreadId = threadId;
                    }
                    this.state.activeTurnIds.set(threadId, turn.id);
                    this.state.activeTurnStartedAt.set(threadId, now);
                    this.upsertTimelineEntry(threadId, `turn:${turn.id}`, createTurnTimelineEntry(threadId, turn, now));
                }
                break;
            }
            case "turn/completed": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turn = params.turn;
                if (threadId && turn) {
                    this.state.activeTurnIds.delete(threadId);
                    this.state.activeTurnStartedAt.delete(threadId);
                    this.upsertTimelineEntry(threadId, `turn:${turn.id}`, createTurnTimelineEntry(threadId, turn, now));
                    const existing = this.state.threads.get(threadId);
                    if (existing) {
                        this.state.threads.set(threadId, {
                            ...existing,
                            updatedAt: Math.floor(now / 1000),
                        });
                    }
                    this.clearStreamingItemsForTurn(threadId, turn.id);
                    void this.canonicalizeCompletedTurn(threadId, turn.id);
                }
                break;
            }
            case "item/started": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const item = params.item;
                if (threadId && item) {
                    this.upsertStreamingTimelineEntry(threadId, turnId, item, "running");
                }
                break;
            }
            case "item/completed": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const item = params.item;
                if (threadId && item) {
                    const itemType = typeof item.type === "string" ? item.type : "unknown";
                    const itemId = typeof item.id === "string" ? item.id : `item-${Date.now()}`;
                    const entryId = resolveTimelineEntryId(itemType, itemId, turnId);
                    const streamedItem = this.getStreamingItemsForThread(threadId).get(entryId)?.item;
                    const mergedItem = mergeStreamingCompletionItem(streamedItem, item);
                    const existingEntry = this.findTimelineEntry(threadId, entryId);
                    const completionStatus = typeof mergedItem.status === "string"
                        ? timelineStatusFromItemStatus(mergedItem.status, "completed")
                        : existingEntry?.status ?? "completed";
                    this.upsertStreamingTimelineEntry(threadId, turnId, mergedItem, completionStatus);
                    const entry = timelineEntryFromTurnItem(threadId, turnId, mergedItem, completionStatus);
                    this.clearStreamingItem(threadId, entry.id);
                }
                break;
            }
            case "item/agentMessage/delta": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
                const delta = typeof params.delta === "string" ? params.delta : "";
                if (threadId && itemId) {
                    this.mutateStreamingItem(threadId, turnId, "agentMessage", itemId, (item) => ({
                        ...item,
                        text: appendText(item.text, delta),
                    }));
                }
                break;
            }
            case "item/reasoning/summaryPartAdded": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
                const summaryIndex = typeof params.summaryIndex === "number" ? params.summaryIndex : undefined;
                if (threadId && itemId && typeof summaryIndex === "number") {
                    this.mutateStreamingItem(threadId, turnId, "reasoning", itemId, (item) => ({
                        ...item,
                        summary: ensureTextAtIndex(item.summary, summaryIndex, ""),
                    }));
                }
                break;
            }
            case "item/reasoning/textDelta": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
                const contentIndex = typeof params.contentIndex === "number" ? params.contentIndex : undefined;
                const delta = typeof params.delta === "string" ? params.delta : "";
                if (threadId && itemId && typeof contentIndex === "number") {
                    this.mutateStreamingItem(threadId, turnId, "reasoning", itemId, (item) => ({
                        ...item,
                        content: ensureTextAtIndex(item.content, contentIndex, delta),
                    }));
                }
                break;
            }
            case "item/reasoning/summaryTextDelta": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
                const summaryIndex = typeof params.summaryIndex === "number" ? params.summaryIndex : undefined;
                const delta = typeof params.delta === "string" ? params.delta : "";
                if (threadId && itemId && typeof summaryIndex === "number") {
                    this.mutateStreamingItem(threadId, turnId, "reasoning", itemId, (item) => ({
                        ...item,
                        summary: ensureTextAtIndex(item.summary, summaryIndex, delta),
                    }));
                }
                break;
            }
            case "item/plan/delta": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
                const delta = typeof params.delta === "string" ? params.delta : "";
                if (threadId && itemId) {
                    this.mutateStreamingItem(threadId, turnId, "plan", itemId, (item) => ({
                        ...item,
                        text: appendText(item.text, delta),
                    }));
                }
                break;
            }
            case "item/commandExecution/outputDelta": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
                const delta = typeof params.delta === "string" ? params.delta : "";
                if (threadId && itemId) {
                    this.mutateStreamingItem(threadId, turnId, "commandExecution", itemId, (item) => ({
                        ...item,
                        aggregatedOutput: appendText(item.aggregatedOutput, delta),
                    }));
                }
                break;
            }
            case "item/fileChange/outputDelta": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : null;
                const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
                const delta = typeof params.delta === "string" ? params.delta : "";
                if (threadId && itemId) {
                    this.mutateStreamingItem(threadId, turnId, "fileChange", itemId, (item) => {
                        const nextChanges = Array.isArray(item.changes) ? [...item.changes] : [];
                        const firstChange = (isRecord(nextChanges[0]) ? nextChanges[0] : null) ?? {
                            path: "Live patch",
                            kind: {
                                type: "update",
                                move_path: null,
                            },
                            diff: "",
                        };
                        nextChanges[0] = {
                            ...firstChange,
                            diff: appendText(firstChange.diff, delta),
                        };
                        return {
                            ...item,
                            changes: nextChanges,
                        };
                    });
                }
                break;
            }
            case "turn/plan/updated":
            case "turn/diff/updated": {
                const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
                const turnId = typeof params.turnId === "string" ? params.turnId : undefined;
                if (threadId && turnId) {
                    void this.syncInProgressTurn(threadId, turnId);
                }
                break;
            }
            case "serverRequest/resolved": {
                const requestId = String(params.requestId ?? "");
                const pending = this.state.pendingRequests.get(requestId);
                this.state.pendingRequests.delete(requestId);
                const historyEntry = this.state.approvalHistory.get(requestId);
                if (historyEntry) {
                    historyEntry.status = "completed";
                }
                if (pending?.threadId) {
                    const approvalEntry = this.findTimelineEntry(pending.threadId, `request:${requestId}`);
                    if (approvalEntry) {
                        approvalEntry.status = "completed";
                        approvalEntry.updatedAt = now;
                    }
                }
                break;
            }
            case "error": {
                this.state.lastError = stringifyUnknown(params);
                break;
            }
            default:
                break;
        }
        this.publish(!STREAMING_NOTIFICATION_METHODS.has(method));
    }
    getStreamingItemsForThread(threadId) {
        const current = this.state.streamingItemsByThread.get(threadId);
        if (current) {
            return current;
        }
        const next = new Map();
        this.state.streamingItemsByThread.set(threadId, next);
        return next;
    }
    upsertStreamingTimelineEntry(threadId, turnId, item, status) {
        const entry = timelineEntryFromTurnItem(threadId, turnId, item, status);
        this.upsertTimelineEntry(threadId, entry.id, entry);
        this.getStreamingItemsForThread(threadId).set(entry.id, {
            turnId,
            item,
        });
    }
    mutateStreamingItem(threadId, turnId, itemType, itemId, mutate) {
        const entryId = resolveTimelineEntryId(itemType, itemId, turnId);
        const registry = this.getStreamingItemsForThread(threadId);
        const current = registry.get(entryId)?.item ?? createStreamingItem(itemType, itemId);
        const next = mutate(current);
        registry.set(entryId, {
            turnId,
            item: next,
        });
        this.upsertTimelineEntry(threadId, entryId, timelineEntryFromTurnItem(threadId, turnId, next, "running"));
    }
    clearStreamingItem(threadId, entryId) {
        this.state.streamingItemsByThread.get(threadId)?.delete(entryId);
    }
    clearStreamingItemsForTurn(threadId, turnId) {
        const registry = this.state.streamingItemsByThread.get(threadId);
        if (!registry) {
            return;
        }
        for (const [entryId, entry] of registry.entries()) {
            if (entry.turnId === turnId) {
                registry.delete(entryId);
            }
        }
    }
    findTimelineEntry(threadId, entryId) {
        return this.state.timelineByThread.get(threadId)?.find((entry) => entry.id === entryId);
    }
    appendTimelineEntry(threadId, entry) {
        const timeline = this.state.timelineByThread.get(threadId) ?? [];
        timeline.push(entry);
        this.state.timelineByThread.set(threadId, timeline);
    }
    insertApprovalEntryIntoTimeline(threadId, entry, afterEntryId) {
        const timeline = this.state.timelineByThread.get(threadId) ?? [];
        insertApprovalTimelineEntry(timeline, entry, afterEntryId);
        this.state.timelineByThread.set(threadId, timeline);
    }
    upsertTimelineEntry(threadId, entryId, next) {
        const timeline = this.state.timelineByThread.get(threadId) ?? [];
        const index = timeline.findIndex((entry) => entry.id === entryId);
        if (index === -1) {
            if (next.turnId) {
                const lastTurnEntryIndex = [...timeline]
                    .map((entry, currentIndex) => ({ entry, currentIndex }))
                    .filter(({ entry }) => entry.turnId === next.turnId)
                    .at(-1)?.currentIndex;
                if (typeof lastTurnEntryIndex === "number") {
                    timeline.splice(lastTurnEntryIndex + 1, 0, next);
                }
                else {
                    const turnEntryIndex = timeline.findIndex((entry) => entry.id === `turn:${next.turnId}`);
                    if (turnEntryIndex !== -1) {
                        timeline.splice(turnEntryIndex + 1, 0, next);
                    }
                    else {
                        timeline.push(next);
                    }
                }
            }
            else {
                timeline.push(next);
            }
        }
        else {
            timeline[index] = next;
        }
        this.state.timelineByThread.set(threadId, timeline);
    }
}
exports.CodexBridge = CodexBridge;
