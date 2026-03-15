import type { ReasoningEffort } from "@/generated/codex-app-server/ReasoningEffort";
import type { Model } from "@/generated/codex-app-server/v2/Model";
import type { Thread } from "@/generated/codex-app-server/v2/Thread";

export type BridgePhase = "starting" | "ready" | "error";
export type TimelineTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted";
export type TimelineStatus =
  | "idle"
  | "running"
  | "completed"
  | "pending"
  | "error";

export type TimelineEntryKind =
  | "thread"
  | "turn"
  | "message"
  | "reasoning"
  | "plan"
  | "command"
  | "diff"
  | "review"
  | "tool"
  | "approval"
  | "input"
  | "system";

export type TimelineEntry = {
  id: string;
  threadId: string;
  turnId: string | null;
  kind: TimelineEntryKind;
  title: string;
  body: string;
  tone: TimelineTone;
  status: TimelineStatus;
  rawMethod?: string;
  updatedAt: number;
};

export type PendingServerRequest = {
  id: string;
  method: string;
  threadId: string | null;
  turnId: string | null;
  summary: string;
  detail: string;
  params: unknown;
  createdAt: number;
};

export type SessionSettings = {
  model: string | null;
  effort: ReasoningEffort | null;
  planMode: boolean;
};

export type ThreadListItem = {
  id: string;
  title: string;
  workspaceLabel: string;
  workspacePath: string;
  branch: string | null;
  statusLabel: string | null;
  sourceLabel: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  searchText: string;
};

export type BridgeSnapshot = {
  phase: BridgePhase;
  lastError: string | null;
  threads: Thread[];
  threadList: ThreadListItem[];
  activeThreadId: string | null;
  activeTurnId: string | null;
  activeTurnStartedAt: number | null;
  timelineByThread: Record<string, TimelineEntry[]>;
  pendingRequests: PendingServerRequest[];
  models: Model[];
  sessionSettings: SessionSettings;
};

export type SnapshotEnvelope = {
  type: "snapshot";
  snapshot: BridgeSnapshot;
};

export type SlashCommandAction =
  | "new"
  | "resume"
  | "fork"
  | "model"
  | "review"
  | "status"
  | "clear";

export type SlashCommandDefinition = {
  name: string;
  description: string;
  action: SlashCommandAction;
};

export const BUILTIN_COMMANDS: SlashCommandDefinition[] = [
  {
    name: "model",
    description: "Choose the current session model and reasoning effort.",
    action: "model",
  },
  {
    name: "review",
    description: "Run an inline review against uncommitted changes.",
    action: "review",
  },
  {
    name: "new",
    description: "Start a fresh thread in the current browser session.",
    action: "new",
  },
  {
    name: "resume",
    description: "Open the thread drawer for previous local sessions.",
    action: "resume",
  },
  {
    name: "fork",
    description: "Fork the active thread into a new branchable session.",
    action: "fork",
  },
  {
    name: "status",
    description: "Open the runtime and bridge status panel.",
    action: "status",
  },
  {
    name: "clear",
    description: "Clear the working surface by starting a new thread.",
    action: "clear",
  },
];
