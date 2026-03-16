import type { ReasoningEffort } from "@/generated/codex-app-server/ReasoningEffort";
import type { Model } from "@/generated/codex-app-server/v2/Model";
import type { Thread } from "@/generated/codex-app-server/v2/Thread";
import type {
  BridgeSnapshot,
  SessionSettings,
  ThreadListItem,
  TimelineEntry,
  WorkspaceListing,
  WorkspaceOption,
} from "@/lib/shared";

const DEMO_ROOT = "/mnt/s/ProjectForFast/codex-ui";
const DEMO_PARENT = "/mnt/s/ProjectForFast";

const NOW = Math.floor(Date.now() / 1000);

function createModel(
  id: string,
  model: string,
  displayName: string,
  defaultReasoningEffort: ReasoningEffort,
  supportedReasoningEfforts: ReasoningEffort[],
  isDefault = false,
): Model {
  return {
    id,
    model,
    upgrade: null,
    upgradeInfo: null,
    availabilityNux: null,
    displayName,
    description: `${displayName} demo model`,
    hidden: false,
    supportedReasoningEfforts: supportedReasoningEfforts.map((reasoningEffort) => ({
      reasoningEffort,
      description: reasoningEffort,
    })),
    defaultReasoningEffort,
    inputModalities: ["text"],
    supportsPersonality: true,
    isDefault,
  };
}

function createThread(
  id: string,
  name: string,
  cwd: string,
  createdAt: number,
  updatedAt: number,
  source: Thread["source"],
  branch: string | null,
  status: Thread["status"],
): Thread {
  return {
    id,
    preview: name,
    ephemeral: false,
    modelProvider: "openai",
    createdAt,
    updatedAt,
    status,
    path: null,
    cwd,
    cliVersion: "0.114.0",
    source,
    agentNickname: null,
    agentRole: null,
    gitInfo: {
      sha: "demo-sha",
      branch,
      originUrl: "https://github.com/smturtle2/codex-ui",
    },
    name,
    turns: [],
  };
}

function createThreadListItem(
  thread: Thread,
  isActive: boolean,
): ThreadListItem {
  const title = thread.name?.trim() || "Untitled thread";
  const workspaceLabel = thread.cwd.split("/").slice(-3).join("/") || thread.cwd;
  const sourceLabel =
    typeof thread.source === "string"
      ? thread.source === "cli"
        ? "CLI"
        : thread.source === "vscode"
          ? "VS Code"
          : thread.source === "appServer"
            ? "App Server"
            : thread.source === "exec"
              ? "Exec"
              : "Unknown"
      : "Sub-agent";
  const statusLabel =
    thread.status.type === "active"
      ? "active"
      : thread.status.type === "systemError"
        ? "system error"
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
      thread.cwd,
      workspaceLabel,
      thread.gitInfo?.branch ?? "",
      sourceLabel,
      statusLabel ?? "",
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function createWorkspaceOptions(
  threadList: ThreadListItem[],
  defaultWorkspacePath: string,
): WorkspaceOption[] {
  const byPath = new Map<string, WorkspaceOption>();

  for (const item of threadList) {
    const current = byPath.get(item.workspacePath);
    byPath.set(item.workspacePath, {
      path: item.workspacePath,
      label: item.workspaceLabel,
      threadCount: (current?.threadCount ?? 0) + 1,
      lastUsedAt: current?.lastUsedAt
        ? Math.max(current.lastUsedAt, item.updatedAt)
        : item.updatedAt,
      isCurrent: item.workspacePath === defaultWorkspacePath,
    });
  }

  if (!byPath.has(defaultWorkspacePath)) {
    byPath.set(defaultWorkspacePath, {
      path: defaultWorkspacePath,
      label: defaultWorkspacePath.split("/").slice(-3).join("/"),
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

function createTimeline(threadId: string): TimelineEntry[] {
  const updatedAt = Date.now();

  return [
    {
      id: "turn:demo-turn-1",
      threadId,
      turnId: "demo-turn-1",
      kind: "turn",
      title: "Turn demo-turn",
      body: "status: completed",
      tone: "muted",
      status: "completed",
      updatedAt,
    },
    {
      id: "demo-turn-1:userMessage:1",
      threadId,
      turnId: "demo-turn-1",
      kind: "message",
      title: "User input",
      body:
        "모바일에서는 transcript가 가장 크게 보이고, 새 thread는 workspace를 고른 뒤 시작해야 해.",
      tone: "neutral",
      status: "completed",
      updatedAt,
    },
    {
      id: "demo-turn-1:agentMessage:1",
      threadId,
      turnId: "demo-turn-1",
      kind: "message",
      title: "Agent message",
      body:
        "홈에서 기존 thread를 고르거나 새 thread를 시작하게 두고, Model/Reasoning/Plan은 composer에 남겼습니다.",
      tone: "accent",
      status: "completed",
      updatedAt,
    },
    {
      id: "demo-turn-1:plan:1",
      threadId,
      turnId: "demo-turn-1",
      kind: "plan",
      title: "Plan",
      body: [
        "1. Audit launcher and chat layout",
        "2. Make mobile transcript dominant",
        "3. Refresh README screenshots",
      ].join("\n"),
      tone: "accent",
      status: "completed",
      updatedAt,
    },
    {
      id: "demo-turn-1:agentMessage:2",
      threadId,
      turnId: "demo-turn-1",
      kind: "message",
      title: "Agent message",
      body:
        "실시간 출력과 thread load는 같은 transcript 구조를 유지합니다.",
      tone: "accent",
      status: "completed",
      updatedAt,
    },
    {
      id: "demo-turn-1:fileChange:1",
      threadId,
      turnId: "demo-turn-1",
      kind: "diff",
      title: "Edited content",
      body: [
        "UPDATE src/components/codex-shell.tsx",
        "@@",
        "-old launcher flow",
        "+launcher-first thread flow",
      ].join("\n"),
      tone: "warning",
      status: "completed",
      updatedAt,
    },
  ];
}

function createThreads(): Thread[] {
  return [
    createThread(
      "thread-demo-active",
      "codex-ui · Mobile-first transcript refresh",
      DEMO_ROOT,
      NOW - 3_600,
      NOW - 120,
      "cli",
      "main",
      {
        type: "active",
        activeFlags: [],
      },
    ),
    createThread(
      "thread-demo-docs",
      "README polish · screenshots",
      DEMO_ROOT,
      NOW - 8_400,
      NOW - 900,
      "vscode",
      "main",
      {
        type: "idle",
      },
    ),
    createThread(
      "thread-demo-funnel",
      "Funnel launch flow",
      `${DEMO_PARENT}/deployment-lab`,
      NOW - 18_000,
      NOW - 5_100,
      "cli",
      "docs",
      {
        type: "idle",
      },
    ),
  ];
}

function createThreadList(threads: Thread[], activeThreadId: string | null): ThreadListItem[] {
  return threads.map((thread) => createThreadListItem(thread, thread.id === activeThreadId));
}

function cloneSnapshot(snapshot: BridgeSnapshot): BridgeSnapshot {
  return {
    ...snapshot,
    threads: snapshot.threads.map((thread) => ({ ...thread, turns: [...thread.turns] })),
    threadList: snapshot.threadList.map((thread) => ({ ...thread })),
    workspaceOptions: snapshot.workspaceOptions.map((workspace) => ({ ...workspace })),
    timelineByThread: Object.fromEntries(
      Object.entries(snapshot.timelineByThread).map(([threadId, timeline]) => [
        threadId,
        timeline.map((entry) => ({ ...entry })),
      ]),
    ),
    pendingRequests: snapshot.pendingRequests.map((request) => ({ ...request })),
    models: snapshot.models.map((model) => ({
      ...model,
      supportedReasoningEfforts: model.supportedReasoningEfforts.map((effort) => ({ ...effort })),
      inputModalities: [...model.inputModalities],
    })),
    sessionSettings: { ...snapshot.sessionSettings },
  };
}

function applyActiveThread(
  snapshot: BridgeSnapshot,
  activeThreadId: string,
): BridgeSnapshot {
  return {
    ...snapshot,
    activeThreadId,
    activeTurnId: null,
    activeTurnStartedAt: null,
    threads: snapshot.threads.map((thread) => ({
      ...thread,
      turns: [...thread.turns],
      status:
        thread.id === activeThreadId
          ? {
              type: "active",
              activeFlags: [],
            }
          : thread.status.type === "systemError"
            ? thread.status
            : {
                type: "idle",
              },
    })),
    threadList: snapshot.threadList.map((thread) => ({
      ...thread,
      isActive: thread.id === activeThreadId,
    })),
  };
}

export function createDemoSnapshot(): BridgeSnapshot {
  const threads = createThreads();
  const activeThreadId = threads[0]?.id ?? null;
  const threadList = createThreadList(threads, activeThreadId);

  const snapshot: BridgeSnapshot = {
    phase: "ready",
    lastError: null,
    threads,
    threadList,
    defaultWorkspacePath: DEMO_ROOT,
    workspaceOptions: createWorkspaceOptions(threadList, DEMO_ROOT),
    activeThreadId,
    activeTurnId: null,
    activeTurnStartedAt: null,
    timelineByThread: {
      "thread-demo-active": createTimeline("thread-demo-active"),
      "thread-demo-docs": [],
      "thread-demo-funnel": [],
    },
    pendingRequests: [],
    models: [
      createModel("model-1", "gpt-5.4", "gpt-5.4", "medium", ["low", "medium", "high"], true),
      createModel("model-2", "gpt-5.4-mini", "gpt-5.4 mini", "low", ["minimal", "low", "medium"]),
    ],
    sessionSettings: {
      model: "gpt-5.4",
      effort: "medium",
      planMode: false,
    },
  };

  return cloneSnapshot(snapshot);
}

export function createDemoWorkspaceListing(path?: string | null): WorkspaceListing {
  const currentPath = path?.trim() || DEMO_ROOT;

  if (currentPath === DEMO_PARENT) {
    return {
      currentPath,
      parentPath: "/mnt/s",
      directories: [
        { name: "ProjectForFast", path: DEMO_PARENT },
        { name: "deployment-lab", path: `${DEMO_PARENT}/deployment-lab` },
      ],
    };
  }

  return {
    currentPath,
    parentPath: currentPath === DEMO_ROOT ? DEMO_PARENT : DEMO_ROOT,
    directories: [
      { name: ".git", path: `${currentPath}/.git` },
      { name: "app", path: `${currentPath}/app` },
      { name: "docs", path: `${currentPath}/docs` },
      { name: "scripts", path: `${currentPath}/scripts` },
      { name: "server", path: `${currentPath}/server` },
      { name: "src", path: `${currentPath}/src` },
    ],
  };
}

export function updateDemoSessionSettings(
  snapshot: BridgeSnapshot,
  settings: Partial<SessionSettings>,
): BridgeSnapshot {
  return {
    ...snapshot,
    sessionSettings: {
      ...snapshot.sessionSettings,
      ...settings,
    },
  };
}

export function activateDemoThread(
  snapshot: BridgeSnapshot,
  threadId: string,
): BridgeSnapshot {
  return applyActiveThread(snapshot, threadId);
}

export function createDemoThreadSnapshot(
  snapshot: BridgeSnapshot,
  cwd: string,
): BridgeSnapshot {
  const createdAt = Math.floor(Date.now() / 1000);
  const thread = createThread(
    `thread-demo-${createdAt}`,
    `New thread · ${cwd.split("/").slice(-1)[0] || "workspace"}`,
    cwd,
    createdAt,
    createdAt,
    "cli",
    "main",
    {
      type: "active",
      activeFlags: [],
    },
  );

  const threads = [thread, ...snapshot.threads.map((entry) => ({ ...entry, turns: [...entry.turns] }))];
  const nextThreadList = createThreadList(threads, thread.id);

  return {
    ...snapshot,
    threads,
    threadList: nextThreadList,
    activeThreadId: thread.id,
    activeTurnId: null,
    activeTurnStartedAt: null,
    workspaceOptions: createWorkspaceOptions(nextThreadList, snapshot.defaultWorkspacePath),
    timelineByThread: {
      ...snapshot.timelineByThread,
      [thread.id]: [],
    },
  };
}
