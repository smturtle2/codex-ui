export type CompatibilityMode = "full" | "degraded" | "unsupported";

export interface CompatibilityState {
  cliVersion: string;
  mode: CompatibilityMode;
  minimumVersion: string;
  fullSupportRange: string;
  message: string | null;
}

export interface CodexGitInfo {
  root?: string | null;
  branch?: string | null;
  commit?: string | null;
  mainBranch?: string | null;
  [key: string]: unknown;
}

export interface CodexThreadStatusActive {
  type: "active";
  activeFlags?: Array<unknown>;
}

export interface CodexThreadStatusIdle {
  type: "idle" | "notLoaded" | "systemError";
}

export type CodexThreadStatus = CodexThreadStatusActive | CodexThreadStatusIdle | { type: string; [key: string]: unknown };

export interface CodexTurnError {
  message: string;
  additionalDetails?: string | null;
  codexErrorInfo?: unknown;
}

export type CodexUserInput =
  | { type: "text"; text: string; text_elements?: Array<unknown> }
  | { type: "image"; url: string }
  | { type: "localImage"; path: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

export type CodexThreadItem =
  | { type: "userMessage"; id: string; content: CodexUserInput[] }
  | { type: "agentMessage"; id: string; text: string; phase?: "commentary" | "final_answer" | null }
  | { type: "plan"; id: string; text: string }
  | { type: "reasoning"; id: string; summary: string[]; content: string[] }
  | {
      type: "commandExecution";
      id: string;
      command: string;
      cwd: string;
      processId?: string | null;
      status?: string;
      commandActions?: Array<unknown>;
      aggregatedOutput?: string | null;
      exitCode?: number | null;
      durationMs?: number | null;
    }
  | {
      type: "fileChange";
      id: string;
      changes?: Array<unknown>;
      status?: string;
      aggregatedOutput?: string | null;
    }
  | {
      type: "mcpToolCall" | "dynamicToolCall" | "collabAgentToolCall" | "webSearch" | "imageView" | "imageGeneration";
      id: string;
      [key: string]: unknown;
    }
  | { type: "enteredReviewMode" | "exitedReviewMode"; id: string; review: string }
  | { type: "contextCompaction"; id: string }
  | { type: string; id: string; [key: string]: unknown };

export interface CodexTurn {
  id: string;
  items: CodexThreadItem[];
  status: string | { type: string; [key: string]: unknown };
  error?: CodexTurnError | null;
}

export interface CodexThread {
  id: string;
  preview: string;
  ephemeral: boolean;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  status: CodexThreadStatus;
  path?: string | null;
  cwd: string;
  cliVersion: string;
  source: unknown;
  agentNickname?: string | null;
  agentRole?: string | null;
  gitInfo?: CodexGitInfo | null;
  name?: string | null;
  turns: CodexTurn[];
}

export interface ThreadListEntry {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: CodexThreadStatus;
  source: string;
  modelProvider: string;
  cwd: string;
  workspacePath: string;
  workspaceKey: string;
}

export type WorkspaceOptionSource = "launcher" | "project" | "recent";

export interface WorkspaceOption {
  path: string;
  key: string;
  label: string;
  source: WorkspaceOptionSource;
}

export interface WorkspaceBrowseEntry {
  name: string;
  path: string;
  key: string;
}

export interface WorkspaceBrowseResponse {
  path: string;
  key: string;
  label: string;
  parentPath: string | null;
  entries: WorkspaceBrowseEntry[];
}

export interface ThreadHeader {
  model: string | null;
  modelProvider: string | null;
  serviceTier: string | null;
  cwd: string | null;
  approvalPolicy: unknown;
  sandbox: unknown;
  reasoningEffort: string | null;
  gitInfo: CodexGitInfo | null;
  cliVersion: string | null;
  threadStatus: CodexThreadStatus | null;
  codexVersion: string;
}

export interface PlanSnapshot {
  explanation: string | null;
  plan: Array<{
    step: string;
    status: string;
    [key: string]: unknown;
  }>;
}

export type PendingRequestMethod =
  | "item/commandExecution/requestApproval"
  | "item/fileChange/requestApproval"
  | "item/permissions/requestApproval"
  | "item/tool/requestUserInput"
  | "mcpServer/elicitation/request"
  | string;

export interface PendingRequestRecord {
  id: string;
  method: PendingRequestMethod;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  params: Record<string, unknown>;
  createdAt: number;
  resolvedAt: number | null;
}

export interface ParsedReviewFinding {
  title: string;
  body: string;
  file: string | null;
  line: number | null;
}

export interface ParsedReview {
  title: string;
  findings: ParsedReviewFinding[];
  raw: string;
}

export interface ActivityEntry {
  id: string;
  at: number;
  kind: string;
  title: string;
  detail: string | null;
  method: string | null;
  threadId: string;
  turnId: string | null;
  itemId: string | null;
}

export interface LogEntry {
  id: string;
  at: number;
  source: "bridge" | "app-server";
  level: "debug" | "info" | "warn" | "error";
  message: string;
  threadId: string | null;
  payload: unknown;
}

export interface ThreadViewState {
  thread: CodexThread;
  header: ThreadHeader | null;
  diffs: Record<string, string>;
  reviews: Record<string, ParsedReview>;
  plans: Record<string, PlanSnapshot>;
  pendingRequests: PendingRequestRecord[];
  activity: ActivityEntry[];
  disconnected: boolean;
  disconnectedReason: string | null;
  lastSeq: number;
}

export interface GlobalSnapshot {
  compatibility: CompatibilityState;
  sessionSecret: string;
  sessionId: string;
  account: {
    account: unknown;
    requiresOpenaiAuth: boolean;
  };
  config: unknown;
  configRequirements: unknown;
  models: unknown[];
  pendingRequests: PendingRequestRecord[];
  logs: LogEntry[];
  defaultWorkspace: string;
  recentWorkspaces: string[];
  workspaceOptions: WorkspaceOption[];
  forcedLoginMethod: "chatgpt" | "api" | null;
  degradedFeatures: string[];
  skills: unknown[];
  apps: unknown[];
}

export interface ConnectionInfo {
  bindHost: string;
  port: number;
  preferredUrl: string;
  reachableUrls: string[];
  loopbackMode: "not_applicable" | "native" | "unavailable";
}

export interface ThreadDetailResponse {
  snapshot: ThreadViewState;
  availableApps: unknown[];
}

export interface ThreadsListResponse {
  data: ThreadListEntry[];
  nextCursor: string | null;
}

export interface BootstrapResponse extends GlobalSnapshot {
  connection: ConnectionInfo;
}

export type ThreadRealtimeEvent =
  | { kind: "thread.upsert"; thread: CodexThread; header?: ThreadHeader | null }
  | { kind: "thread.status.changed"; threadId: string; status: CodexThreadStatus }
  | { kind: "thread.name.updated"; threadId: string; name: string | null }
  | { kind: "thread.archived"; threadId: string }
  | { kind: "thread.unarchived"; threadId: string }
  | { kind: "thread.closed"; threadId: string }
  | { kind: "turn.started"; threadId: string; turn: CodexTurn }
  | { kind: "turn.completed"; threadId: string; turn: CodexTurn }
  | { kind: "turn.error"; threadId: string; turnId: string; error: CodexTurnError; willRetry: boolean }
  | { kind: "turn.diff.updated"; threadId: string; turnId: string; diff: string }
  | { kind: "turn.plan.updated"; threadId: string; turnId: string; explanation: string | null; plan: PlanSnapshot["plan"] }
  | { kind: "item.started"; threadId: string; turnId: string; item: CodexThreadItem }
  | { kind: "item.completed"; threadId: string; turnId: string; item: CodexThreadItem }
  | { kind: "item.agentMessage.delta"; threadId: string; turnId: string; itemId: string; delta: string }
  | { kind: "item.reasoning.summaryPartAdded"; threadId: string; turnId: string; itemId: string; summaryIndex: number }
  | { kind: "item.reasoning.summaryTextDelta"; threadId: string; turnId: string; itemId: string; summaryIndex: number; delta: string }
  | { kind: "item.reasoning.textDelta"; threadId: string; turnId: string; itemId: string; contentIndex: number; delta: string }
  | { kind: "item.commandExecution.outputDelta"; threadId: string; turnId: string; itemId: string; delta: string }
  | { kind: "item.commandExecution.terminalInteraction"; threadId: string; turnId: string; itemId: string; processId: string; stdin: string }
  | { kind: "item.fileChange.outputDelta"; threadId: string; turnId: string; itemId: string; delta: string }
  | { kind: "pending.request.created"; request: PendingRequestRecord }
  | { kind: "pending.request.resolved"; threadId: string; requestId: string }
  | { kind: "thread.disconnected"; threadId: string; reason: string };

export type BrowserRealtimeClientMessage =
  | { type: "subscribe"; threadId: string; lastSeenSeq?: number | null }
  | { type: "unsubscribe"; threadId: string }
  | { type: "ping" };

export type BrowserRealtimeServerMessage =
  | { type: "hello"; sessionId: string }
  | { type: "global.snapshot"; snapshot: Pick<GlobalSnapshot, "pendingRequests" | "logs" | "account" | "config" | "configRequirements" | "models" | "degradedFeatures" | "apps" | "skills">; seq: number }
  | { type: "global.event"; seq: number; event: GlobalRealtimeEvent }
  | { type: "thread.snapshot"; threadId: string; seq: number; snapshot: ThreadViewState }
  | { type: "thread.event"; threadId: string; seq: number; event: ThreadRealtimeEvent }
  | { type: "thread.resync_required"; threadId: string }
  | { type: "pong"; at: number };

export type GlobalRealtimeEvent =
  | { kind: "pending.updated"; pendingRequests: PendingRequestRecord[] }
  | { kind: "log.entry"; entry: LogEntry }
  | { kind: "account.updated"; account: GlobalSnapshot["account"] }
  | { kind: "config.updated"; config: unknown; configRequirements?: unknown; models?: unknown[] }
  | { kind: "catalog.updated"; apps?: unknown[]; skills?: unknown[] }
  | { kind: "thread.list.upsert"; entry: ThreadListEntry }
  | { kind: "thread.list.remove"; threadId: string };

export function isUserMessageItem(item: CodexThreadItem): item is Extract<CodexThreadItem, { type: "userMessage" }> {
  return item.type === "userMessage" && Array.isArray((item as { content?: unknown }).content);
}

export function isAgentMessageItem(item: CodexThreadItem): item is Extract<CodexThreadItem, { type: "agentMessage" }> {
  return item.type === "agentMessage" && typeof (item as { text?: unknown }).text === "string";
}

export function isReasoningItem(item: CodexThreadItem): item is Extract<CodexThreadItem, { type: "reasoning" }> {
  return (
    item.type === "reasoning" &&
    Array.isArray((item as { summary?: unknown }).summary) &&
    Array.isArray((item as { content?: unknown }).content)
  );
}

export function isCommandExecutionItem(
  item: CodexThreadItem,
): item is Extract<CodexThreadItem, { type: "commandExecution" }> {
  return item.type === "commandExecution" && typeof (item as { command?: unknown }).command === "string";
}

export function isFileChangeItem(item: CodexThreadItem): item is Extract<CodexThreadItem, { type: "fileChange" }> {
  return item.type === "fileChange";
}

export function isReviewItem(
  item: CodexThreadItem,
): item is Extract<CodexThreadItem, { type: "enteredReviewMode" | "exitedReviewMode" }> {
  return (item.type === "enteredReviewMode" || item.type === "exitedReviewMode") && typeof (item as { review?: unknown }).review === "string";
}
