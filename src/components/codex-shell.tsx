"use client";

import { startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { applyThreadEvent } from "@/lib/thread-state";
import {
  BootstrapResponse,
  BrowserRealtimeServerMessage,
  CodexThread,
  CodexThreadItem,
  PendingRequestRecord,
  ThreadViewState,
  isAgentMessageItem,
  isCommandExecutionItem,
  isFileChangeItem,
  isReasoningItem,
  isReviewItem,
  isUserMessageItem,
} from "@/lib/types";

type ComposerAttachment =
  | { id: string; type: "localImage"; label: string; path: string }
  | { id: string; type: "skill"; label: string; name: string; path: string }
  | { id: string; type: "mention"; label: string; name: string; path: string };

type RightTab = "activity" | "pending" | "diff" | "review" | "logs";

function createTextInput(text: string) {
  return {
    type: "text" as const,
    text,
    text_elements: [],
  };
}

function threadProjectKey(thread: CodexThread) {
  const gitInfo = thread.gitInfo as { root?: string | null } | null | undefined;
  return gitInfo?.root ?? thread.cwd;
}

function formatDate(timestamp: number) {
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

function activeTurn(threadState: ThreadViewState | null) {
  return threadState?.thread.turns.find((turn) => {
    const status = turn.status;
    return typeof status === "string" ? status === "active" || status === "retrying" : status.type === "active";
  }) ?? null;
}

function latestDiff(state: ThreadViewState | null) {
  if (!state) {
    return null;
  }
  const turnIds = Object.keys(state.diffs);
  return turnIds.length > 0 ? state.diffs[turnIds[turnIds.length - 1]!] : null;
}

function latestReview(state: ThreadViewState | null) {
  if (!state) {
    return null;
  }
  const turnIds = Object.keys(state.reviews);
  return turnIds.length > 0 ? state.reviews[turnIds[turnIds.length - 1]!] : null;
}

function requestLabel(request: PendingRequestRecord) {
  switch (request.method) {
    case "item/commandExecution/requestApproval":
      return "Command approval";
    case "item/fileChange/requestApproval":
      return "File change approval";
    case "item/permissions/requestApproval":
      return "Permissions approval";
    case "item/tool/requestUserInput":
      return "request_user_input";
    case "mcpServer/elicitation/request":
      return "MCP elicitation";
    default:
      return request.method;
  }
}

function decisionLabel(decision: unknown) {
  if (typeof decision === "string") {
    return decision;
  }

  if (decision && typeof decision === "object") {
    return Object.keys(decision)[0] ?? "custom";
  }

  return "unknown";
}

function itemTitle(item: CodexThreadItem): string {
  if (isAgentMessageItem(item)) {
    return item.phase === "final_answer" ? "Final answer" : "Commentary";
  }

  if (isCommandExecutionItem(item)) {
    return item.command || "Command";
  }

  if (isFileChangeItem(item)) {
    return "File change";
  }

  if (isReasoningItem(item)) {
    return "Reasoning";
  }

  if (isPlanItem(item)) {
    return "Plan";
  }

  if (isReviewItem(item)) {
    return "Review";
  }

  if (isUserMessageItem(item)) {
    return "User";
  }

  return item.type;
}

function renderUserContent(content: Array<{ type: string; text?: string; path?: string; name?: string; url?: string }>) {
  return content
    .map((entry) => {
      switch (entry.type) {
        case "text":
          return entry.text ?? "";
        case "localImage":
          return `[localImage] ${entry.path ?? ""}`;
        case "skill":
          return `[skill] ${entry.name ?? ""}`;
        case "mention":
          return `[mention] ${entry.name ?? ""}`;
        case "image":
          return `[image] ${entry.url ?? ""}`;
        default:
          return `[${entry.type}]`;
      }
    })
    .join("\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlanItem(item: CodexThreadItem): item is Extract<CodexThreadItem, { type: "plan" }> {
  return item.type === "plan" && typeof (item as { text?: unknown }).text === "string";
}

function renderItemBody(item: CodexThreadItem): ReactNode {
  if (isUserMessageItem(item)) {
    return <pre>{renderUserContent(item.content)}</pre>;
  }

  if (isAgentMessageItem(item)) {
    return <pre>{item.text}</pre>;
  }

  if (isReasoningItem(item)) {
    return <pre>{[...item.summary, "", ...item.content].join("\n")}</pre>;
  }

  if (isPlanItem(item)) {
    return <pre>{item.text}</pre>;
  }

  if (isCommandExecutionItem(item)) {
    return <pre>{[item.command, "", typeof item.aggregatedOutput === "string" ? item.aggregatedOutput : ""].join("\n")}</pre>;
  }

  if (isFileChangeItem(item)) {
    return <pre>{JSON.stringify(item.changes ?? [], null, 2)}</pre>;
  }

  if (isReviewItem(item)) {
    return <pre>{item.review}</pre>;
  }

  return <pre>{JSON.stringify(item, null, 2)}</pre>;
}

export function CodexShell() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [threads, setThreads] = useState<CodexThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadViewState | null>(null);
  const [availableApps, setAvailableApps] = useState<unknown[]>([]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("activity");
  const [workspace, setWorkspace] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [manualImagePath, setManualImagePath] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const sessionSecretRef = useRef<string | null>(null);

  selectedThreadIdRef.current = selectedThreadId;

  useEffect(() => {
    const savedTab = window.localStorage.getItem("codex-ui:right-tab") as RightTab | null;
    const savedThreadId = window.localStorage.getItem("codex-ui:selected-thread");
    if (savedTab) {
      setRightTab(savedTab);
    }
    if (savedThreadId) {
      setSelectedThreadId(savedThreadId);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("codex-ui:right-tab", rightTab);
  }, [rightTab]);

  useEffect(() => {
    if (selectedThreadId) {
      window.localStorage.setItem("codex-ui:selected-thread", selectedThreadId);
    }
  }, [selectedThreadId]);

  async function apiFetch<T>(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    if (sessionSecretRef.current) {
      headers.set("x-codex-webui-session", sessionSecretRef.current);
    }
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(path, {
      ...init,
      headers,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return (await response.json()) as T;
  }

  async function loadBootstrap(options?: { cwd?: string; threadId?: string | null }) {
    const url = new URL("/api/bootstrap", window.location.origin);
    if (options?.cwd) {
      url.searchParams.set("cwd", options.cwd);
    }
    if (options?.threadId) {
      url.searchParams.set("threadId", options.threadId);
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const nextBootstrap = (await response.json()) as BootstrapResponse;
    sessionSecretRef.current = nextBootstrap.sessionSecret;
    setBootstrap(nextBootstrap);
    setWorkspace(nextBootstrap.defaultWorkspace);
    setRuntimeError(null);
    return nextBootstrap;
  }

  async function loadThreads() {
    const response = await apiFetch<{ data: CodexThread[] }>("/api/threads");
    setThreads(response.data);
    setRuntimeError(null);
    return response.data;
  }

  async function loadThread(threadId: string) {
    try {
      const response = await apiFetch<{ snapshot: ThreadViewState; availableApps: unknown[] }>(`/api/threads/${threadId}`);
      setThreadDetail(response.snapshot);
      setAvailableApps(response.availableApps);
      setRuntimeError(null);
      return response.snapshot;
    } catch {
      const response = await apiFetch<{ snapshot: ThreadViewState; availableApps: unknown[] }>(`/api/threads/${threadId}/resume`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setThreadDetail(response.snapshot);
      setAvailableApps(response.availableApps);
      setRuntimeError(null);
      return response.snapshot;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        setLoading(true);
        const nextBootstrap = await loadBootstrap();
        if (cancelled) {
          return;
        }
        const nextThreads = await loadThreads();
        if (cancelled) {
          return;
        }

        if (selectedThreadIdRef.current) {
          await loadThread(selectedThreadIdRef.current);
        } else if (nextThreads[0]) {
          startTransition(() => {
            setSelectedThreadId(nextThreads[0]!.id);
          });
          await loadThread(nextThreads[0]!.id);
        }

        setBootstrap(nextBootstrap);
      } catch (error) {
        if (!cancelled) {
          setRuntimeError(error instanceof Error ? error.message : "Failed to load Codex WebUI.");
          setThreadDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!selectedThreadId || !sessionSecretRef.current) {
      return;
    }

    const socket = new WebSocket(
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/realtime?sessionSecret=${encodeURIComponent(sessionSecretRef.current)}`,
    );
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "subscribe", threadId: selectedThreadId, lastSeenSeq: threadDetail?.lastSeq ?? 0 }));
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as BrowserRealtimeServerMessage;
      if (payload.type === "global.event") {
        const globalEvent = payload.event;
        switch (globalEvent.kind) {
          case "pending.updated":
            setBootstrap((current) => (current ? { ...current, pendingRequests: globalEvent.pendingRequests } : current));
            break;
          case "log.entry":
            setBootstrap((current) =>
              current
                ? {
                    ...current,
                    logs: [...current.logs, globalEvent.entry].slice(-500),
                  }
                : current,
            );
            break;
          case "account.updated":
            setBootstrap((current) => (current ? { ...current, account: globalEvent.account } : current));
            break;
          case "config.updated":
            setBootstrap((current) =>
              current
                ? {
                    ...current,
                    config: globalEvent.config,
                    configRequirements: globalEvent.configRequirements ?? current.configRequirements,
                    models: globalEvent.models ?? current.models,
                  }
                : current,
            );
            break;
          case "catalog.updated":
            setBootstrap((current) =>
              current
                ? {
                    ...current,
                    apps: globalEvent.apps ?? current.apps,
                    skills: globalEvent.skills ?? current.skills,
                  }
                : current,
            );
            break;
        }
        return;
      }

      if (payload.type === "thread.snapshot" && payload.threadId === selectedThreadIdRef.current) {
        setThreadDetail(payload.snapshot);
        return;
      }

      if (payload.type === "thread.event" && payload.threadId === selectedThreadIdRef.current) {
        setThreadDetail((current) => (current ? applyThreadEvent(current, payload.event) : current));
        void loadThreads();
        return;
      }

      if (payload.type === "thread.resync_required" && payload.threadId === selectedThreadIdRef.current) {
        void loadThread(payload.threadId);
      }
    });

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "unsubscribe", threadId: selectedThreadId }));
      }
      socket.close();
      socketRef.current = null;
    };
  }, [selectedThreadId, threadDetail?.lastSeq]);

  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }
    void (async () => {
      try {
        await loadBootstrap({ cwd: workspace, threadId: selectedThreadId });
        await loadThread(selectedThreadId);
      } catch (error) {
        setRuntimeError(error instanceof Error ? error.message : "Failed to load the selected thread.");
        setThreadDetail(null);
      }
    })();
  }, [selectedThreadId]);

  const groupedThreads = useMemo(() => {
    const map = new Map<string, CodexThread[]>();
    for (const thread of threads) {
      const key = threadProjectKey(thread);
      const current = map.get(key) ?? [];
      current.push(thread);
      map.set(key, current);
    }
    return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [threads]);

  const pendingRequests = threadDetail?.pendingRequests ?? bootstrap?.pendingRequests ?? [];
  const statusBanner =
    bootstrap?.compatibility.mode === "degraded"
      ? "Degraded compatibility mode: experimentalApi, request_user_input, persistExtendedHistory are disabled."
      : bootstrap?.compatibility.message;

  function clearComposer() {
    setMessage("");
    setAttachments([]);
    setManualImagePath("");
    setShowImagePicker(false);
    setShowSkillPicker(false);
    setShowMentionPicker(false);
  }

  async function sendMessage() {
    if (!message.trim() && attachments.length === 0) {
      return;
    }

    setSending(true);
    try {
      const input = [
        ...(message.trim() ? [createTextInput(message.trim())] : []),
        ...attachments.map((attachment) => {
          if (attachment.type === "localImage") {
            return {
              type: "localImage" as const,
              path: attachment.path,
            };
          }

          return {
            type: attachment.type,
            name: attachment.name,
            path: attachment.path,
          };
        }),
      ];

      if (!selectedThreadId) {
        const response = await apiFetch<{ snapshot: ThreadViewState; availableApps: unknown[] }>("/api/threads", {
          method: "POST",
          body: JSON.stringify({
            cwd: workspace,
            input,
          }),
        });
        setSelectedThreadId(response.snapshot.thread.id);
        setThreadDetail(response.snapshot);
        setAvailableApps(response.availableApps);
      } else {
        const response = await apiFetch<{ snapshot: ThreadViewState; availableApps?: unknown[] }>(`/api/threads/${selectedThreadId}/turns`, {
          method: "POST",
          body: JSON.stringify({ input }),
        });
        setThreadDetail(response.snapshot ?? threadDetail);
      }

      clearComposer();
      await loadThreads();
    } finally {
      setSending(false);
    }
  }

  async function handleResume() {
    if (!selectedThreadId) {
      return;
    }
    const response = await apiFetch<{ snapshot: ThreadViewState; availableApps: unknown[] }>(`/api/threads/${selectedThreadId}/resume`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setThreadDetail(response.snapshot);
    await loadThreads();
  }

  async function handleInterrupt() {
    const turn = activeTurn(threadDetail);
    if (!selectedThreadId || !turn) {
      return;
    }
    await apiFetch(`/api/threads/${selectedThreadId}/turns/${turn.id}/interrupt`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async function handleReview(detached: boolean) {
    if (!selectedThreadId) {
      return;
    }
    await apiFetch(`/api/threads/${selectedThreadId}/review`, {
      method: "POST",
      body: JSON.stringify({
        target: { type: "uncommittedChanges" },
        delivery: detached ? "detached" : "inline",
      }),
    });
  }

  async function handleConfigWrite(keyPath: string, value: unknown) {
    await apiFetch("/api/config/batch", {
      method: "POST",
      body: JSON.stringify({
        edits: [
          {
            keyPath,
            value,
            mergeStrategy: "replace",
          },
        ],
      }),
    });
    setRefreshToken((current) => current + 1);
  }

  async function handleLogin(type: "chatgpt" | "apiKey") {
    setLoginError(null);
    try {
      const payload = type === "chatgpt" ? { type: "chatgpt" } : { type: "apiKey", apiKey };
      const result = await apiFetch<{ authUrl?: string }>("/api/account/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result.authUrl) {
        window.open(result.authUrl, "_blank", "noopener,noreferrer");
      }

      setRefreshToken((current) => current + 1);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    }
  }

  async function handleRequestDecision(request: PendingRequestRecord, body: unknown) {
    await apiFetch(`/api/server-requests/${request.id}/respond`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function addAttachment(attachment: ComposerAttachment) {
    setAttachments((current) => [...current, attachment]);
  }

  if (loading || !bootstrap) {
    return (
      <main className="codex-shell">
        <div className="gate">
          <p className="brand-kicker">codex_webui</p>
          <h1 className="brand-title">Starting bridge</h1>
          <p className="brand-copy">codex app-server handshake, account bootstrap, and workspace metadata are loading.</p>
        </div>
      </main>
    );
  }

  const accountMissing = bootstrap.account.requiresOpenaiAuth && !bootstrap.account.account;

  if (accountMissing) {
    return (
      <main className="codex-shell">
        <div className="gate">
          <p className="brand-kicker">Authentication</p>
          <h1 className="brand-title">Codex account bootstrap required</h1>
          <p className="brand-copy">
            The local bridge is ready, but codex-cli reported `requiresOpenaiAuth=true` with no active account.
          </p>
          {statusBanner ? <div className="status-banner">{statusBanner}</div> : null}
          <div className="section" style={{ paddingInline: 0, borderBottom: "none" }}>
            <div className="button-row">
              {bootstrap.forcedLoginMethod !== "api" ? (
                <button className="button" onClick={() => void handleLogin("chatgpt")}>
                  ChatGPT login
                </button>
              ) : null}
            </div>
            {bootstrap.forcedLoginMethod !== "chatgpt" ? (
              <div className="two-column" style={{ marginTop: 14 }}>
                <input
                  className="text-input"
                  type="password"
                  placeholder="OpenAI API key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button className="ghost-button" onClick={() => void handleLogin("apiKey")}>
                  API key login
                </button>
              </div>
            ) : null}
            {loginError ? <div className="status-banner error">{loginError}</div> : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="codex-shell">
      <div className="codex-grid">
        <aside className="sidebar">
          <div className="sidebar-header">
            <p className="brand-kicker">codex_webui</p>
            <h1 className="brand-title">Local Agent Desk</h1>
            <p className="brand-copy">Thread / turn / item / server-request를 raw stdout 없이 그대로 보여주는 local-first shell.</p>
          </div>

          <div className="section">
            <p className="section-title">Workspace</p>
            <input className="workspace-input" value={workspace} onChange={(event) => setWorkspace(event.target.value)} />
            <div className="button-row" style={{ marginTop: 12 }}>
              <button
                className="button"
                onClick={() =>
                  startTransition(() => {
                    setSelectedThreadId(null);
                    setThreadDetail(null);
                  })
                }
              >
                New thread
              </button>
              <button className="ghost-button" onClick={() => void loadBootstrap({ cwd: workspace, threadId: selectedThreadId })}>
                Refresh
              </button>
            </div>
          </div>

          <div className="sidebar-scroll">
            <div className="section">
              <p className="section-title">Threads</p>
              {groupedThreads.length === 0 ? (
                <div className="empty-state">아직 스레드가 없습니다.</div>
              ) : (
                groupedThreads.map(([project, projectThreads]) => (
                  <div className="thread-group" key={project}>
                    <h3 className="thread-group-title">{project.split("/").pop() || project}</h3>
                    {projectThreads
                      .sort((left, right) => right.updatedAt - left.updatedAt)
                      .map((thread) => (
                        <button
                          key={thread.id}
                          className={`thread-card ${thread.id === selectedThreadId ? "active" : ""}`}
                          onClick={() =>
                            startTransition(() => {
                              setSelectedThreadId(thread.id);
                            })
                          }
                        >
                          <p className="thread-name">{thread.name || thread.preview || "Untitled thread"}</p>
                          <p className="thread-preview">{thread.preview || "No preview yet."}</p>
                          <div className="thread-meta">
                            <span className="pill">{thread.status.type}</span>
                            <span className="pill">{formatDate(thread.updatedAt)}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="main-panel">
          <div className="panel-header">
            <div>
              <p className="brand-kicker">Thread</p>
              <h2 className="header-title">{threadDetail?.thread.name || threadDetail?.thread.preview || "New conversation"}</h2>
              <p className="header-subtitle">{threadDetail?.thread.cwd || workspace}</p>
            </div>
            <div className="header-badges">
              {threadDetail?.header?.model ? <span className="pill accent">{threadDetail.header.model}</span> : null}
              {threadDetail?.header?.serviceTier ? <span className="pill">{threadDetail.header.serviceTier}</span> : null}
              <span className="pill">{bootstrap.compatibility.cliVersion}</span>
              <span className={`pill ${threadDetail?.disconnected ? "warn" : ""}`}>{threadDetail?.thread.status.type || "idle"}</span>
            </div>
          </div>

          {statusBanner ? <div className="section status-banner">{statusBanner}</div> : null}
          {runtimeError ? <div className="section status-banner error">{runtimeError}</div> : null}
          {threadDetail?.disconnected ? <div className="section status-banner error">{threadDetail.disconnectedReason || "Bridge disconnected."}</div> : null}

          <div className="messages-scroll">
            {threadDetail ? (
              threadDetail.thread.turns.flatMap((turn) =>
                turn.items.map((item) => {
                  const messageTone = isAgentMessageItem(item) ? (item.phase === "final_answer" ? "final" : "commentary") : "";
                  return (
                    <article className={`message-card ${messageTone}`} key={`${turn.id}:${item.id}`}>
                      <p className="item-title">
                        {itemTitle(item)} · {turn.id}
                      </p>
                      {renderItemBody(item)}
                    </article>
                  );
                }),
              )
            ) : (
              <div className="empty-state">왼쪽에서 thread를 선택하거나 새 thread를 시작하세요.</div>
            )}
          </div>

          <div className="composer">
            <div className="button-row">
              <button className="ghost-button" onClick={() => setShowImagePicker((current) => !current)}>
                Add localImage
              </button>
              <button className="ghost-button" onClick={() => setShowSkillPicker((current) => !current)}>
                Add skill
              </button>
              <button className="ghost-button" onClick={() => setShowMentionPicker((current) => !current)}>
                Add mention
              </button>
              {selectedThreadId ? (
                <button className="ghost-button" onClick={() => void handleResume()}>
                  Resume
                </button>
              ) : null}
              {activeTurn(threadDetail) ? (
                <button className="danger-button" onClick={() => void handleInterrupt()}>
                  Interrupt
                </button>
              ) : null}
              {selectedThreadId ? (
                <>
                  <button className="ghost-button" onClick={() => void handleReview(false)}>
                    Inline review
                  </button>
                  <button className="ghost-button" onClick={() => void handleReview(true)}>
                    Detached review
                  </button>
                </>
              ) : null}
            </div>

            {showImagePicker ? (
              <div className="tool-panel">
                <input
                  className="text-input"
                  placeholder="/absolute/path/to/image.png"
                  value={manualImagePath}
                  onChange={(event) => setManualImagePath(event.target.value)}
                />
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() => {
                      if (!manualImagePath.trim()) {
                        return;
                      }
                      addAttachment({
                        id: crypto.randomUUID(),
                        type: "localImage",
                        label: manualImagePath.trim().split("/").pop() || manualImagePath.trim(),
                        path: manualImagePath.trim(),
                      });
                      setManualImagePath("");
                      setShowImagePicker(false);
                    }}
                  >
                    Add image path
                  </button>
                </div>
              </div>
            ) : null}

            {showSkillPicker ? (
              <div className="tool-panel">
                <div className="catalog-list">
                  {(bootstrap.skills as Array<{ name?: string; path?: string; description?: string }>).map((skill, index) => (
                    <button
                      className="catalog-item"
                      key={`${skill.name ?? "skill"}-${index}`}
                      onClick={() => {
                        addAttachment({
                          id: crypto.randomUUID(),
                          type: "skill",
                          label: skill.name ?? skill.path ?? "skill",
                          name: skill.name ?? "skill",
                          path: skill.path ?? "",
                        });
                        setShowSkillPicker(false);
                      }}
                    >
                      <strong>{skill.name ?? skill.path ?? "skill"}</strong>
                      <div>{skill.description ?? skill.path ?? ""}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {showMentionPicker ? (
              <div className="tool-panel">
                <div className="catalog-list">
                  {(availableApps.length > 0 ? availableApps : bootstrap.apps).map((app, index) => {
                    const resolved = isObject(app) ? app : {};
                    const name = typeof resolved.name === "string" ? resolved.name : typeof resolved.id === "string" ? resolved.id : "app";
                    const description = typeof resolved.description === "string" ? resolved.description : typeof resolved.id === "string" ? resolved.id : "";
                    return (
                      <button
                        className="catalog-item"
                        key={`${name}-${index}`}
                        onClick={() => {
                          addAttachment({
                            id: crypto.randomUUID(),
                            type: "mention",
                            label: name,
                            name,
                            path: name,
                          });
                          setShowMentionPicker(false);
                        }}
                      >
                        <strong>{name}</strong>
                        <div>{description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {attachments.length > 0 ? (
              <div className="chip-row">
                {attachments.map((attachment) => (
                  <div className="chip" key={attachment.id}>
                    <span>
                      {attachment.type}: {attachment.label}
                    </span>
                    <button onClick={() => setAttachments((current) => current.filter((entry) => entry.id !== attachment.id))}>x</button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="composer-grid">
              <textarea
                className="text-area"
                placeholder="Message Codex..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <button className="button" onClick={() => void sendMessage()} disabled={sending}>
                {sending ? "Sending" : "Send"}
              </button>
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <div className="right-header">
            <p className="brand-kicker">Panels</p>
            <h3 className="header-title" style={{ color: "var(--text-inverse)" }}>
              Activity stack
            </h3>
            <p className="header-subtitle" style={{ color: "rgba(247, 244, 238, 0.72)" }}>
              diff / review / pending requests / logs
            </p>
          </div>

          <div className="tab-row">
            {(["activity", "pending", "diff", "review", "logs"] as RightTab[]).map((tab) => (
              <button key={tab} className={`tab-button ${rightTab === tab ? "active" : ""}`} onClick={() => setRightTab(tab)}>
                {tab}
              </button>
            ))}
            <button className={`tab-button ${showSettings ? "active" : ""}`} onClick={() => setShowSettings((current) => !current)}>
              settings
            </button>
          </div>

          <div className="right-scroll">
            {showSettings ? (
              <div className="settings-card">
                <p className="item-title">Quick controls</p>
                <div className="two-column">
                  <select
                    className="select-input"
                    value={(bootstrap.config as { model?: string | null })?.model ?? ""}
                    onChange={(event) => void handleConfigWrite("model", event.target.value || null)}
                  >
                    <option value="">Default model</option>
                    {(bootstrap.models as Array<{ model?: string; displayName?: string }>).map((model) => (
                      <option key={model.model} value={model.model}>
                        {model.displayName ?? model.model}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select-input"
                    value={(bootstrap.config as { approval_policy?: string | null })?.approval_policy ?? ""}
                    onChange={(event) => void handleConfigWrite("approval_policy", event.target.value || null)}
                  >
                    <option value="">Default approval</option>
                    <option value="untrusted">untrusted</option>
                    <option value="on-request">on-request</option>
                    <option value="never">never</option>
                  </select>
                  <select
                    className="select-input"
                    value={(bootstrap.config as { sandbox_mode?: string | null })?.sandbox_mode ?? ""}
                    onChange={(event) => void handleConfigWrite("sandbox_mode", event.target.value || null)}
                  >
                    <option value="">Default sandbox</option>
                    <option value="read-only">read-only</option>
                    <option value="workspace-write">workspace-write</option>
                    <option value="danger-full-access">danger-full-access</option>
                  </select>
                  <select
                    className="select-input"
                    value={(bootstrap.config as { web_search?: string | null })?.web_search ?? ""}
                    onChange={(event) => void handleConfigWrite("web_search", event.target.value || null)}
                  >
                    <option value="">Default web search</option>
                    <option value="disabled">disabled</option>
                    <option value="cached">cached</option>
                    <option value="live">live</option>
                  </select>
                </div>
              </div>
            ) : null}

            {rightTab === "activity"
              ? (threadDetail?.activity ?? []).slice().reverse().map((entry) => (
                  <div className="right-card" key={entry.id}>
                    <h4>{entry.title}</h4>
                    <p>{entry.detail || entry.method || entry.kind}</p>
                  </div>
                ))
              : null}

            {rightTab === "pending"
              ? pendingRequests.map((request) => {
                  const params = isObject(request.params) ? request.params : {};
                  const availableDecisions =
                    request.method === "item/commandExecution/requestApproval" && Array.isArray(params.availableDecisions)
                      ? params.availableDecisions
                      : request.method === "item/fileChange/requestApproval"
                        ? ["accept", "acceptForSession", "decline", "cancel"]
                        : null;

                  return (
                    <div className="pending-card" key={request.id}>
                      <p className="item-title">{requestLabel(request)}</p>
                      <pre>{JSON.stringify(request.params, null, 2)}</pre>
                      <div className="button-row" style={{ marginTop: 12 }}>
                        {availableDecisions
                          ? availableDecisions.map((decision) => (
                              <button
                                className="ghost-button"
                                key={decisionLabel(decision)}
                                onClick={() => void handleRequestDecision(request, { decision })}
                              >
                                {decisionLabel(decision)}
                              </button>
                            ))
                          : null}
                        {request.method === "item/permissions/requestApproval" ? (
                          <>
                            <button
                              className="button"
                              onClick={() =>
                                void handleRequestDecision(request, {
                                  permissions: params.permissions ?? {},
                                  scope: "turn",
                                })
                              }
                            >
                              approve for turn
                            </button>
                            <button
                              className="ghost-button"
                              onClick={() =>
                                void handleRequestDecision(request, {
                                  permissions: params.permissions ?? {},
                                  scope: "session",
                                })
                              }
                            >
                              approve for session
                            </button>
                          </>
                        ) : null}
                        {request.method === "item/tool/requestUserInput" ? (
                          <button
                            className="button"
                            onClick={() => {
                              const answers: Record<string, { answers: string[] }> = {};
                              const questions = Array.isArray(params.questions) ? params.questions : [];
                              for (const question of questions) {
                                if (isObject(question) && typeof question.id === "string") {
                                  answers[question.id] = { answers: ["Approved from WebUI"] };
                                }
                              }
                              void handleRequestDecision(request, { answers });
                            }}
                          >
                            submit placeholder answer
                          </button>
                        ) : null}
                        {request.method === "mcpServer/elicitation/request" ? (
                          <>
                            <button className="button" onClick={() => void handleRequestDecision(request, { action: "accept", content: {}, _meta: null })}>
                              accept
                            </button>
                            <button className="ghost-button" onClick={() => void handleRequestDecision(request, { action: "decline", content: null, _meta: null })}>
                              decline
                            </button>
                            <button className="ghost-button" onClick={() => void handleRequestDecision(request, { action: "cancel", content: null, _meta: null })}>
                              cancel
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              : null}

            {rightTab === "diff" && latestDiff(threadDetail) ? (
              <div className="right-card">
                <h4>Latest diff</h4>
                <pre>{latestDiff(threadDetail)}</pre>
              </div>
            ) : null}

            {rightTab === "review" && latestReview(threadDetail) ? (
              <div className="right-card">
                <h4>{latestReview(threadDetail)?.title}</h4>
                {(latestReview(threadDetail)?.findings ?? []).map((finding, index) => (
                  <p key={`${finding.title}-${index}`}>
                    {finding.title}
                    {finding.file ? ` · ${finding.file}${finding.line ? `:${finding.line}` : ""}` : ""}
                    <br />
                    {finding.body}
                  </p>
                ))}
              </div>
            ) : null}

            {rightTab === "logs"
              ? bootstrap.logs
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div className="right-card" key={entry.id}>
                      <h4>
                        {entry.source} · {entry.level}
                      </h4>
                      <p>{entry.message}</p>
                      {entry.payload ? <pre>{JSON.stringify(entry.payload, null, 2)}</pre> : null}
                    </div>
                  ))
              : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
