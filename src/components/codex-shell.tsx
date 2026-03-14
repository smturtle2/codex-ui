"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { ComposerPanel } from "@/components/shell/composer-panel";
import { ComposerAttachment, UtilityView } from "@/components/shell/shared";
import { ThreadHeader } from "@/components/shell/thread-header";
import { ThreadListPane } from "@/components/shell/thread-list-pane";
import { ThreadTimeline } from "@/components/shell/thread-timeline";
import { UtilityDrawer } from "@/components/shell/utility-drawer";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import {
  removeThreadListEntry,
  resolveTheme,
  ThemePreference,
  threadEventTouchesList,
  upsertThreadListEntry,
  upsertThreadListEntryFromThread,
} from "@/lib/shell-ui";
import { createThreadTitle } from "@/lib/thread-list";
import { applyThreadEvent } from "@/lib/thread-state";
import {
  BootstrapResponse,
  BrowserRealtimeServerMessage,
  PendingRequestRecord,
  ThreadListEntry,
  ThreadViewState,
  WorkspaceBrowseResponse,
} from "@/lib/types";
import { normalizeWorkspacePath } from "@/lib/workspace-utils";

const THEME_STORAGE_KEY = "codex-ui:theme";

function createTextInput(text: string) {
  return {
    type: "text" as const,
    text,
    text_elements: [],
  };
}

function connectionMessage(bootstrap: BootstrapResponse | null) {
  if (!bootstrap) {
    return null;
  }

  switch (bootstrap.connection.loopbackMode) {
    case "unavailable":
      return `Open this session through ${bootstrap.connection.preferredUrl}. Loopback access is not available right now.`;
    default:
      return null;
  }
}

function activeTurn(threadState: ThreadViewState | null) {
  return (
    threadState?.thread.turns.find((turn) => {
      const status = turn.status;
      return typeof status === "string" ? status === "active" || status === "retrying" : status.type === "active";
    }) ?? null
  );
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

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function CodexShell() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [threads, setThreads] = useState<ThreadListEntry[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadViewState | null>(null);
  const [availableApps, setAvailableApps] = useState<unknown[]>([]);
  const [draftWorkspacePath, setDraftWorkspacePath] = useState("");
  const [workspaceBrowse, setWorkspaceBrowse] = useState<WorkspaceBrowseResponse | null>(null);
  const [workspaceBrowseLoading, setWorkspaceBrowseLoading] = useState(false);
  const [workspaceBrowseError, setWorkspaceBrowseError] = useState<string | null>(null);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<UtilityView>("pending");
  const [apiKey, setApiKey] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const deferredThreadQuery = useDeferredValue(threadQuery);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [composerPrefillText, setComposerPrefillText] = useState("");
  const [composerPrefillToken, setComposerPrefillToken] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const threadDetailRef = useRef<ThreadViewState | null>(null);
  const sessionSecretRef = useRef<string | null>(null);
  const subscribedThreadIdRef = useRef<string | null>(null);
  const themeInitializedRef = useRef(false);

  selectedThreadIdRef.current = selectedThreadId;
  threadDetailRef.current = threadDetail;

  useEffect(() => {
    if (selectedThreadId) {
      window.localStorage.setItem("codex-ui:selected-thread", selectedThreadId);
      return;
    }

    window.localStorage.removeItem("codex-ui:selected-thread");
  }, [selectedThreadId]);

  useEffect(() => {
    if (draftWorkspacePath) {
      window.localStorage.setItem("codex-ui:draft-workspace", draftWorkspacePath);
      return;
    }

    window.localStorage.removeItem("codex-ui:draft-workspace");
  }, [draftWorkspacePath]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(storedTheme)) {
      setThemePreference(storedTheme);
    }
    themeInitializedRef.current = true;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPrefersDark(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const resolvedTheme = resolveTheme(themePreference, systemPrefersDark);
  const selectedThreadSummary = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    if (!themeInitializedRef.current) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

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
    setRuntimeError(null);
    return nextBootstrap;
  }

  async function loadThreads() {
    const response = await apiFetch<{ data: ThreadListEntry[] }>("/api/threads");
    setThreads(response.data);
    setRuntimeError(null);
    return response.data;
  }

  function syncThreadIntoList(thread: ThreadViewState["thread"]) {
    setThreads((current) => upsertThreadListEntryFromThread(current, thread));
  }

  async function loadThread(threadId: string) {
    try {
      const response = await apiFetch<{ snapshot: ThreadViewState; availableApps: unknown[] }>(`/api/threads/${threadId}`);
      threadDetailRef.current = response.snapshot;
      setThreadDetail(response.snapshot);
      setAvailableApps(response.availableApps);
      syncThreadIntoList(response.snapshot.thread);
      setRuntimeError(null);
      return response.snapshot;
    } catch {
      const response = await apiFetch<{ snapshot: ThreadViewState; availableApps: unknown[] }>(`/api/threads/${threadId}/resume`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      threadDetailRef.current = response.snapshot;
      setThreadDetail(response.snapshot);
      setAvailableApps(response.availableApps);
      syncThreadIntoList(response.snapshot.thread);
      setRuntimeError(null);
      return response.snapshot;
    }
  }

  async function loadWorkspaceBrowse(path: string) {
    const normalizedPath = normalizeWorkspacePath(path);
    if (!normalizedPath) {
      return null;
    }

    setWorkspaceBrowseLoading(true);
    setWorkspaceBrowseError(null);
    try {
      const response = await apiFetch<WorkspaceBrowseResponse>(
        `/api/workspaces/browse?path=${encodeURIComponent(normalizedPath)}`,
      );
      setWorkspaceBrowse(response);
      return response;
    } catch (error) {
      setWorkspaceBrowseError(error instanceof Error ? error.message : "Failed to browse workspaces.");
      return null;
    } finally {
      setWorkspaceBrowseLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        setLoading(true);

        const savedThreadId = window.localStorage.getItem("codex-ui:selected-thread");
        const savedWorkspace = normalizeWorkspacePath(window.localStorage.getItem("codex-ui:draft-workspace"));
        const nextBootstrap = await loadBootstrap({ cwd: savedWorkspace || undefined });
        if (cancelled) {
          return;
        }

        setDraftWorkspacePath(savedWorkspace || nextBootstrap.defaultWorkspace);
        const nextThreads = await loadThreads();
        if (cancelled) {
          return;
        }

        if (savedThreadId) {
          setSelectedThreadId(savedThreadId);
        } else if (nextThreads[0]) {
          startTransition(() => {
            setSelectedThreadId(nextThreads[0]!.id);
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeError(error instanceof Error ? error.message : "Failed to load Codex WebUI.");
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
  }, []);

  useEffect(() => {
    if (!workspaceModalOpen) {
      return;
    }

    const workspace = draftWorkspacePath || bootstrap?.defaultWorkspace;
    if (!workspace) {
      return;
    }

    if (!workspaceBrowse || workspaceBrowse.path !== workspace) {
      void loadWorkspaceBrowse(workspace);
    }
  }, [bootstrap?.defaultWorkspace, draftWorkspacePath, workspaceBrowse, workspaceModalOpen]);

  function syncThreadSubscription(socket = socketRef.current) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const nextThreadId = selectedThreadIdRef.current;
    const previousThreadId = subscribedThreadIdRef.current;

    if (previousThreadId && previousThreadId !== nextThreadId) {
      socket.send(JSON.stringify({ type: "unsubscribe", threadId: previousThreadId }));
      subscribedThreadIdRef.current = null;
    }

    if (nextThreadId && previousThreadId !== nextThreadId) {
      const lastSeenSeq = threadDetailRef.current?.thread.id === nextThreadId ? threadDetailRef.current.lastSeq : null;
      socket.send(
        JSON.stringify({
          type: "subscribe",
          threadId: nextThreadId,
          lastSeenSeq,
        }),
      );
      subscribedThreadIdRef.current = nextThreadId;
    }
  }

  useEffect(() => {
    if (!bootstrap || !sessionSecretRef.current) {
      return;
    }

    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      const socket = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/realtime?sessionSecret=${encodeURIComponent(sessionSecretRef.current!)}`,
      );
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        syncThreadSubscription(socket);
      });

      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(String(event.data)) as BrowserRealtimeServerMessage;

        if (payload.type === "global.snapshot") {
          setBootstrap((current) =>
            current
              ? {
                  ...current,
                  pendingRequests: payload.snapshot.pendingRequests,
                  logs: payload.snapshot.logs,
                  account: payload.snapshot.account,
                  config: payload.snapshot.config,
                  configRequirements: payload.snapshot.configRequirements,
                  models: payload.snapshot.models,
                  degradedFeatures: payload.snapshot.degradedFeatures,
                  apps: payload.snapshot.apps,
                  skills: payload.snapshot.skills,
                }
              : current,
          );
          return;
        }

        if (payload.type === "global.event") {
          const globalEvent = payload.event;
          switch (globalEvent.kind) {
            case "pending.updated":
              setBootstrap((current) => (current ? { ...current, pendingRequests: globalEvent.pendingRequests } : current));
              setThreadDetail((current) => {
                if (!current) {
                  return current;
                }

                const nextState = {
                  ...current,
                  pendingRequests: globalEvent.pendingRequests.filter((request) => request.threadId === current.thread.id),
                };
                threadDetailRef.current = nextState;
                return nextState;
              });
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
            case "thread.list.upsert":
              setThreads((current) => upsertThreadListEntry(current, globalEvent.entry));
              break;
            case "thread.list.remove":
              setThreads((current) => removeThreadListEntry(current, globalEvent.threadId));
              if (selectedThreadIdRef.current === globalEvent.threadId) {
                startTransition(() => {
                  setSelectedThreadId(null);
                  setThreadDetail(null);
                  setAvailableApps([]);
                });
                threadDetailRef.current = null;
              }
              break;
          }
          return;
        }

        if (payload.type === "thread.snapshot" && payload.threadId === selectedThreadIdRef.current) {
          threadDetailRef.current = payload.snapshot;
          setThreadDetail(payload.snapshot);
          syncThreadIntoList(payload.snapshot.thread);
          return;
        }

        if (payload.type === "thread.event" && payload.threadId === selectedThreadIdRef.current) {
          const currentState = threadDetailRef.current;
          if (!currentState) {
            return;
          }

          const nextState = applyThreadEvent(currentState, payload.event);
          threadDetailRef.current = nextState;
          setThreadDetail(nextState);

          if (payload.event.kind === "thread.archived" || payload.event.kind === "thread.closed") {
            setThreads((current) => removeThreadListEntry(current, payload.threadId));
            return;
          }

          if (threadEventTouchesList(payload.event)) {
            setThreads((current) => upsertThreadListEntryFromThread(current, nextState.thread));
          }
          return;
        }

        if (payload.type === "thread.resync_required" && payload.threadId === selectedThreadIdRef.current) {
          void loadThread(payload.threadId);
        }
      });

      socket.addEventListener("error", () => {
        socket.close();
      });

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (subscribedThreadIdRef.current) {
          subscribedThreadIdRef.current = null;
        }

        if (!disposed) {
          reconnectTimerRef.current = window.setTimeout(connect, 1500);
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      const socket = socketRef.current;
      if (socket) {
        socket.close();
      }
      socketRef.current = null;
      subscribedThreadIdRef.current = null;
    };
  }, [bootstrap?.connection.preferredUrl, bootstrap?.sessionSecret]);

  useEffect(() => {
    syncThreadSubscription();
  }, [selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) {
      threadDetailRef.current = null;
      setThreadDetail(null);
      setAvailableApps([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const snapshot = await loadThread(selectedThreadId);
        if (cancelled) {
          return;
        }
        threadDetailRef.current = snapshot;
      } catch (error) {
        if (!cancelled) {
          setRuntimeError(error instanceof Error ? error.message : "Failed to load the selected thread.");
          setThreadDetail(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedThreadId]);

  async function refreshConversationData() {
    const workspace = draftWorkspacePath || bootstrap?.defaultWorkspace;
    await Promise.all([
      loadBootstrap({
        cwd: workspace || undefined,
        threadId: selectedThreadId || undefined,
      }),
      loadThreads(),
      selectedThreadId ? loadThread(selectedThreadId) : Promise.resolve(null),
    ]);
  }

  async function handleSelectWorkspace(path: string) {
    const normalizedPath = normalizeWorkspacePath(path);
    if (!normalizedPath) {
      return;
    }

    setDraftWorkspacePath(normalizedPath);
    await Promise.all([
      loadBootstrap({
        cwd: normalizedPath,
        threadId: selectedThreadId || undefined,
      }),
      loadWorkspaceBrowse(normalizedPath),
    ]);
  }

  function focusComposer() {
    setComposerFocusToken((current) => current + 1);
  }

  function prefillComposer(prompt: string) {
    setComposerPrefillText(prompt);
    setComposerPrefillToken((current) => current + 1);
    focusComposer();
  }

  async function handleSelectWorkspaceForNewConversation(path: string) {
    await handleSelectWorkspace(path);
    handleCreateThread();
    setWorkspaceModalOpen(false);
    setSidebarOpen(false);
    focusComposer();
  }

  async function sendMessage(payload: { message: string; attachments: ComposerAttachment[] }) {
    if (!payload.message.trim() && payload.attachments.length === 0) {
      return;
    }

    setSending(true);
    try {
      const input = [
        ...(payload.message.trim() ? [createTextInput(payload.message.trim())] : []),
        ...payload.attachments.map((attachment) => {
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
            cwd: draftWorkspacePath || bootstrap?.defaultWorkspace,
            input,
          }),
        });
        setSelectedThreadId(response.snapshot.thread.id);
        threadDetailRef.current = response.snapshot;
        setThreadDetail(response.snapshot);
        setAvailableApps(response.availableApps);
        syncThreadIntoList(response.snapshot.thread);
      } else {
        const response = await apiFetch<{ snapshot: ThreadViewState; availableApps?: unknown[] }>(
          `/api/threads/${selectedThreadId}/turns`,
          {
            method: "POST",
            body: JSON.stringify({ input }),
          },
        );
        if (response.snapshot) {
          threadDetailRef.current = response.snapshot;
          setThreadDetail(response.snapshot);
          syncThreadIntoList(response.snapshot.thread);
        }
      }
    } finally {
      setSending(false);
    }
  }

  async function handleResume() {
    if (!selectedThreadId) {
      return;
    }

    const response = await apiFetch<{ snapshot: ThreadViewState; availableApps: unknown[] }>(
      `/api/threads/${selectedThreadId}/resume`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    threadDetailRef.current = response.snapshot;
    setThreadDetail(response.snapshot);
    setAvailableApps(response.availableApps);
    syncThreadIntoList(response.snapshot.thread);
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

    await loadBootstrap({
      cwd: draftWorkspacePath || bootstrap?.defaultWorkspace,
      threadId: selectedThreadId || undefined,
    });
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

      await loadBootstrap({
        cwd: draftWorkspacePath || bootstrap?.defaultWorkspace,
        threadId: selectedThreadId || undefined,
      });
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

  function handleCreateThread() {
    startTransition(() => {
      setSelectedThreadId(null);
      setThreadDetail(null);
      setAvailableApps([]);
      setRuntimeError(null);
    });
  }

  function handleOpenNewConversation() {
    setWorkspaceModalOpen(true);
    setSidebarOpen(false);
  }

  function openUtilityView(view: UtilityView) {
    setDrawerView(view);
    setDrawerOpen(true);
  }

  if (loading || !bootstrap) {
    return (
      <main className="codex-shell">
        <div className="gate">
          <p className="modal-kicker">codex_webui</p>
          <h1 className="brand-title">Preparing your session</h1>
          <p className="brand-copy">Loading the bridge, workspace metadata, and conversation history.</p>
        </div>
      </main>
    );
  }

  const accountMissing = bootstrap.account.requiresOpenaiAuth && !bootstrap.account.account;
  const pendingRequests = threadDetail?.pendingRequests ?? bootstrap.pendingRequests ?? [];
  const statusBanner =
    bootstrap.compatibility.mode === "degraded"
      ? "Degraded compatibility mode: experimentalApi, request_user_input, and persistExtendedHistory are disabled."
      : bootstrap.compatibility.message;
  const loopbackBanner = connectionMessage(bootstrap);

  if (accountMissing) {
    return (
      <main className="codex-shell">
        <div className="gate auth-gate">
          <p className="modal-kicker">Authentication</p>
          <h1 className="brand-title">Sign in to continue</h1>
          <p className="brand-copy">The bridge is ready, but this session still needs an authenticated account.</p>
          {statusBanner ? <div className="status-banner">{statusBanner}</div> : null}
          {loopbackBanner ? <div className="status-banner">{loopbackBanner}</div> : null}
          <div className="auth-actions">
            {bootstrap.forcedLoginMethod !== "api" ? (
              <button className="button" onClick={() => void handleLogin("chatgpt")}>
                Continue with ChatGPT
              </button>
            ) : null}
            {bootstrap.forcedLoginMethod !== "chatgpt" ? (
              <div className="path-input-row">
                <input
                  className="text-input"
                  type="password"
                  placeholder="OpenAI API key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button className="ghost-button" onClick={() => void handleLogin("apiKey")}>
                  Use API key
                </button>
              </div>
            ) : null}
            {loginError ? <div className="status-banner error inline-banner">{loginError}</div> : null}
          </div>
        </div>
      </main>
    );
  }

  const currentWorkspace = draftWorkspacePath || bootstrap.defaultWorkspace;
  const hasActiveTurn = Boolean(activeTurn(threadDetail));
  const headerTitle = threadDetail
    ? createThreadTitle(threadDetail.thread.name, threadDetail.thread.preview)
    : selectedThreadSummary?.title ?? "New chat";
  const notices = [
    runtimeError ? { tone: "error" as const, text: runtimeError } : null,
    threadDetail?.disconnected ? { tone: "error" as const, text: threadDetail.disconnectedReason || "Bridge disconnected." } : null,
    loopbackBanner ? { tone: "info" as const, text: loopbackBanner } : null,
    statusBanner ? { tone: "info" as const, text: statusBanner } : null,
  ].filter(Boolean) as Array<{ tone: "info" | "error"; text: string }>;

  return (
    <main className="codex-shell">
      <div className="shell-layout">
        <button
          className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
          aria-hidden={!sidebarOpen}
          tabIndex={sidebarOpen ? 0 : -1}
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-top">
            <div className="sidebar-brand-row">
              <div className="brand-lockup">
                <p className="modal-kicker">codex_webui</p>
                <h1 className="brand-title">Codex</h1>
              </div>
              <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close conversation list">
                x
              </button>
            </div>

            <button className="button primary-cta" onClick={handleOpenNewConversation}>
              New chat
            </button>

            <label className="search-field">
              <span className="search-label">Search conversations</span>
              <input
                className="text-input search-input"
                value={threadQuery}
                placeholder="Search by title or workspace"
                onChange={(event) => setThreadQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="sidebar-scroll">
            <ThreadListPane
              threads={threads}
              selectedThreadId={selectedThreadId}
              query={deferredThreadQuery}
              onSelectThread={(threadId) =>
                startTransition(() => {
                  setSelectedThreadId(threadId);
                  setThreadDetail(null);
                  setSidebarOpen(false);
                })
              }
            />
          </div>
        </aside>

        <section className="conversation-stage">
          <ThreadHeader
            title={headerTitle}
            workspacePath={threadDetail?.thread.cwd ?? selectedThreadSummary?.workspacePath ?? currentWorkspace}
            pendingCount={pendingRequests.length}
            selectedThreadId={selectedThreadId}
            hasActiveTurn={hasActiveTurn}
            onOpenSidebar={() => setSidebarOpen(true)}
            onOpenWorkspace={handleOpenNewConversation}
            onOpenUtilityView={openUtilityView}
            onResume={handleResume}
            onInterrupt={handleInterrupt}
            onReview={handleReview}
            onReload={refreshConversationData}
          />

          {notices.length > 0 ? (
            <div className="notice-stack">
              {notices.map((notice, index) => (
                <div key={`${notice.tone}-${index}`} className={`status-banner ${notice.tone === "error" ? "error" : ""}`}>
                  {notice.text}
                </div>
              ))}
            </div>
          ) : null}

          <ThreadTimeline
            threadDetail={threadDetail}
            loading={Boolean(selectedThreadId && !threadDetail && !runtimeError)}
            draftWorkspacePath={currentWorkspace}
            onOpenWorkspace={handleOpenNewConversation}
            onPickStarter={prefillComposer}
          />

          <ComposerPanel
            skills={bootstrap.skills}
            apps={availableApps.length > 0 ? availableApps : bootstrap.apps}
            selectedThreadId={selectedThreadId}
            sending={sending}
            focusToken={composerFocusToken}
            prefillText={composerPrefillText}
            prefillToken={composerPrefillToken}
            draftWorkspacePath={currentWorkspace}
            onOpenWorkspace={handleOpenNewConversation}
            onSend={sendMessage}
          />
        </section>
      </div>

      <WorkspaceSwitcher
        open={workspaceModalOpen}
        draftWorkspacePath={currentWorkspace}
        workspaceOptions={bootstrap.workspaceOptions}
        workspaceBrowse={workspaceBrowse}
        workspaceBrowseLoading={workspaceBrowseLoading}
        workspaceBrowseError={workspaceBrowseError}
        onBrowseWorkspace={loadWorkspaceBrowse}
        onSelectWorkspace={handleSelectWorkspaceForNewConversation}
        onClose={() => setWorkspaceModalOpen(false)}
      />

      <UtilityDrawer
        open={drawerOpen}
        view={drawerView}
        pendingRequests={pendingRequests}
        latestDiff={latestDiff(threadDetail)}
        latestReview={latestReview(threadDetail)}
        logs={bootstrap.logs}
        config={bootstrap.config}
        models={bootstrap.models}
        connectionUrl={bootstrap.connection.preferredUrl}
        reachableUrls={bootstrap.connection.reachableUrls}
        selectedThreadId={selectedThreadId}
        hasActiveTurn={hasActiveTurn}
        themePreference={themePreference}
        onClose={() => setDrawerOpen(false)}
        onViewChange={setDrawerView}
        onRequestDecision={handleRequestDecision}
        onConfigWrite={handleConfigWrite}
        onThemePreferenceChange={setThemePreference}
        onResume={handleResume}
        onInterrupt={handleInterrupt}
        onReview={handleReview}
        onOpenWorkspace={handleOpenNewConversation}
        onReload={refreshConversationData}
      />
    </main>
  );
}
