"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { ApprovalDialog, type ApprovalOption, type ApprovalQuestion } from "@/components/codex-shell/approval-dialog";
import {
  LANGUAGE_STORAGE_KEY,
  getLanguageOptions,
  getUiCopy,
  parseUiLanguage,
  resolveUiLocale,
  type UiLanguage,
} from "@/components/codex-shell/copy";
import { ComposerDock } from "@/components/codex-shell/composer-dock";
import { HomeScreen } from "@/components/codex-shell/home-screen";
import { SettingsPanel } from "@/components/codex-shell/settings-panel";
import { ShellHeader } from "@/components/codex-shell/shell-header";
import { SurfaceDialog } from "@/components/codex-shell/surface-dialog";
import { ThreadDrawer } from "@/components/codex-shell/thread-drawer";
import { TranscriptPane } from "@/components/codex-shell/transcript-pane";
import { WorkspacePicker } from "@/components/codex-shell/workspace-picker";
import type { SurfaceKind, ThreadDrawerSort } from "@/components/codex-shell/types";
import {
  approvalDecisionLabel,
  buildDefaultServerResponse,
  buildStatusLine,
  fileApprovalDecisionLabel,
  filterCommands,
  formatRuntime,
  getCurrentEffort,
  getCurrentModel,
  getFocusableElements,
  summarizeDecision,
} from "@/components/codex-shell/utils";
import type { CommandExecutionApprovalDecision } from "@/generated/codex-app-server/v2/CommandExecutionApprovalDecision";
import type { ToolRequestUserInputQuestion } from "@/generated/codex-app-server/v2/ToolRequestUserInputQuestion";
import {
  activateDemoThread,
  createDemoSnapshot,
  createDemoThreadSnapshot,
  createDemoWorkspaceListing,
  updateDemoSessionSettings,
} from "@/lib/demo";
import type { BridgeSnapshot, WorkspaceListing } from "@/lib/shared";
import { BUILTIN_COMMANDS } from "@/lib/shared";

type ApprovalChoice = {
  key: string;
  label: string;
  result: unknown;
  isCancel?: boolean;
};

type ConnectionState = "connecting" | "live" | "reconnecting";
type ViewMode = "home" | "chat";

const WORKSPACE_STORAGE_KEY = "codex-ui-workspace";

type CodexShellProps = {
  demoMode?: boolean;
};

async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request to ${path} failed.`);
  }
  return payload;
}

function isTypingElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function resolveSlashCommand(
  rawValue: string,
  visibleCommands: typeof BUILTIN_COMMANDS,
  selectedCommandIndex: number,
): string {
  const commandName = rawValue.replace(/^\//, "").trim().split(/\s+/)[0]?.toLowerCase();
  const exactCommand = BUILTIN_COMMANDS.find((command) => command.name === commandName);
  if (exactCommand) {
    return `/${exactCommand.name}`;
  }

  const selectedCommand = visibleCommands[selectedCommandIndex];
  if (selectedCommand) {
    return `/${selectedCommand.name}`;
  }

  return rawValue;
}

function formatWorkspacePathLabel(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  if (!normalized) {
    return ".";
  }

  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 3) {
    return normalized;
  }

  return `.../${parts.slice(-3).join("/")}`;
}

export function CodexShell({ demoMode = false }: CodexShellProps) {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(() =>
    demoMode ? createDemoSnapshot() : null,
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    demoMode ? "live" : "connecting",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [surface, setSurface] = useState<SurfaceKind | null>(null);
  const [composer, setComposer] = useState("");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("system");
  const [browserLanguage, setBrowserLanguage] = useState("en");
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [threadSort, setThreadSort] = useState<ThreadDrawerSort>("updated");
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [selectedApprovalIndex, setSelectedApprovalIndex] = useState(0);
  const [commandMenuDismissed, setCommandMenuDismissed] = useState(false);
  const [requestDrafts, setRequestDrafts] = useState<Record<string, string>>({});
  const [requestAnswers, setRequestAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [workspaceListing, setWorkspaceListing] = useState<WorkspaceListing | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [threadDrawerOpen, setThreadDrawerOpen] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerModelSelectRef = useRef<HTMLSelectElement | null>(null);
  const homeSearchRef = useRef<HTMLInputElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const overlayPanelRef = useRef<HTMLDivElement | null>(null);
  const threadDrawerRef = useRef<HTMLDivElement | null>(null);
  const approvalDialogRef = useRef<HTMLDivElement | null>(null);
  const homeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveThreadIdRef = useRef<string | null>(null);
  const previousTimelineLengthRef = useRef(0);
  const transcriptPinnedRef = useRef(true);
  const surfaceOriginRef = useRef<HTMLElement | null>(null);
  const approvalOriginRef = useRef<HTMLElement | null>(null);
  const previousPendingRequestIdRef = useRef<string | null>(null);
  const deferredThreadSearch = useDeferredValue(threadSearch);
  const locale = useMemo(
    () => resolveUiLocale(uiLanguage, browserLanguage),
    [browserLanguage, uiLanguage],
  );
  const copy = useMemo(() => getUiCopy(locale), [locale]);

  const applySnapshot = useEffectEvent((nextSnapshot: BridgeSnapshot) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
    });
  });

  const applyDemoSnapshot = useEffectEvent(
    (mutate: (current: BridgeSnapshot) => BridgeSnapshot) => {
      startTransition(() => {
        setSnapshot((current) => (current ? mutate(current) : current));
      });
    },
  );

  const refreshBootstrap = useEffectEvent(async (showToastOnError: boolean) => {
    try {
      const payload = await callApi<{ snapshot: BridgeSnapshot }>("/api/bootstrap");
      applySnapshot(payload.snapshot);
    } catch (error) {
      if (!showToastOnError) {
        return;
      }

      setToast(error instanceof Error ? error.message : copy.common.bootstrapError);
    }
  });

  useEffect(() => {
    if (demoMode) {
      return;
    }

    let mounted = true;
    let reconnectTimer: number | null = null;
    let websocket: WebSocket | null = null;
    let reconnectAttempts = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimer === null) {
        return;
      }

      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const connect = () => {
      if (!mounted) {
        return;
      }

      clearReconnectTimer();
      setConnectionState(reconnectAttempts === 0 ? "connecting" : "reconnecting");

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      websocket = new WebSocket(`${protocol}://${window.location.host}/ws`);

      websocket.onopen = () => {
        if (!mounted) {
          return;
        }

        reconnectAttempts = 0;
        setConnectionState("live");
        void refreshBootstrap(false);
      };

      websocket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as {
          type: "snapshot";
          snapshot: BridgeSnapshot;
        };

        applySnapshot(payload.snapshot);
      };

      websocket.onerror = () => {
        // Let the subsequent close event drive reconnect scheduling.
      };

      websocket.onclose = () => {
        if (!mounted) {
          return;
        }

        setConnectionState("reconnecting");
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 8000);
        reconnectAttempts += 1;
        clearReconnectTimer();
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, delay);
      };
    };

    void refreshBootstrap(true);
    connect();

    return () => {
      mounted = false;
      clearReconnectTimer();
      websocket?.close();
    };
  }, [demoMode, refreshBootstrap]);

  useEffect(() => {
    setBrowserLanguage(window.navigator.language || "en");
    setUiLanguage(parseUiLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)));
    setWorkspaceDraft(
      demoMode
        ? window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ??
            createDemoSnapshot().defaultWorkspacePath
        : window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? "",
    );
  }, [demoMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const syncLayout = () => {
      setIsPhoneLayout(mediaQuery.matches);
    };

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => {
      mediaQuery.removeEventListener("change", syncLayout);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    const nextWorkspace = workspaceDraft.trim();
    if (!nextWorkspace) {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspace);
  }, [workspaceDraft]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (viewMode !== "chat" && threadDrawerOpen) {
      setThreadDrawerOpen(false);
    }
  }, [threadDrawerOpen, viewMode]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast]);

  const activeThread = useMemo(() => {
    if (!snapshot?.activeThreadId) {
      return null;
    }

    return snapshot.threads.find((thread) => thread.id === snapshot.activeThreadId) ?? null;
  }, [snapshot]);

  const activeThreadSummary = useMemo(() => {
    if (!snapshot?.activeThreadId) {
      return null;
    }

    return snapshot.threadList.find((thread) => thread.id === snapshot.activeThreadId) ?? null;
  }, [snapshot]);

  const activeTimeline = useMemo(() => {
    if (!snapshot?.activeThreadId) {
      return [];
    }

    return snapshot.timelineByThread[snapshot.activeThreadId] ?? [];
  }, [snapshot]);

  useEffect(() => {
    const nextWorkspace =
      activeThreadSummary?.workspacePath ?? snapshot?.defaultWorkspacePath ?? "";
    if (!nextWorkspace) {
      return;
    }

    setWorkspaceDraft((current) => current || nextWorkspace);
  }, [activeThreadSummary?.workspacePath, snapshot?.defaultWorkspacePath]);

  const launchWorkspacePath = snapshot?.defaultWorkspacePath ?? "";
  const currentWorkspacePath = activeThreadSummary?.workspacePath ?? launchWorkspacePath;
  const preferredWorkspacePath =
    workspaceDraft.trim() || currentWorkspacePath || launchWorkspacePath;

  const filteredThreads = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const query = deferredThreadSearch.trim().toLowerCase();
    const threads = snapshot.threadList.filter((thread) =>
      thread.searchText.includes(query),
    );

    return [...threads].sort((left, right) => {
      const leftValue = threadSort === "created" ? left.createdAt : left.updatedAt;
      const rightValue = threadSort === "created" ? right.createdAt : right.updatedAt;
      return rightValue - leftValue;
    });
  }, [deferredThreadSearch, snapshot, threadSort]);

  const visibleHomeThreads = useMemo(() => {
    if (!activeThreadSummary) {
      return filteredThreads;
    }

    return filteredThreads.some((thread) => thread.id === activeThreadSummary.id)
      ? filteredThreads
      : [activeThreadSummary, ...filteredThreads];
  }, [activeThreadSummary, filteredThreads]);

  const pendingRequest = useMemo(() => {
    if (!snapshot?.pendingRequests.length) {
      return null;
    }

    return (
      snapshot.pendingRequests.find(
        (request) =>
          request.threadId === snapshot.activeThreadId || request.threadId === null,
      ) ?? snapshot.pendingRequests[0]
    );
  }, [snapshot]);

  useEffect(() => {
    if (!pendingRequest) {
      return;
    }

    setRequestDrafts((current) => {
      if (current[pendingRequest.id]) {
        return current;
      }

      return {
        ...current,
        [pendingRequest.id]: buildDefaultServerResponse(pendingRequest),
      };
    });
  }, [pendingRequest]);

  useEffect(() => {
    const currentPendingRequestId = pendingRequest?.id ?? null;
    if (!previousPendingRequestIdRef.current && currentPendingRequestId) {
      approvalOriginRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSelectedApprovalIndex(0);
    }

    if (previousPendingRequestIdRef.current && !currentPendingRequestId) {
      window.setTimeout(() => {
        if (surface) {
          const target =
            overlayPanelRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]');
          target?.focus();
          return;
        }

        const origin = approvalOriginRef.current;
        if (origin?.isConnected) {
          origin.focus();
          return;
        }

        if (viewMode === "home") {
          homeSearchRef.current?.focus();
          return;
        }

        if (isPhoneLayout) {
          return;
        }

        composerRef.current?.focus();
      }, 0);
    }

    previousPendingRequestIdRef.current = currentPendingRequestId;
  }, [isPhoneLayout, pendingRequest?.id, surface, viewMode]);

  const visibleCommands = !commandMenuDismissed && composer.trimStart().startsWith("/")
    ? filterCommands(composer.trimStart(), locale)
    : [];

  useEffect(() => {
    setSelectedCommandIndex((current) => {
      if (visibleCommands.length === 0) {
        return 0;
      }

      return Math.min(current, visibleCommands.length - 1);
    });
  }, [visibleCommands.length]);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) {
      return;
    }

    const updatePinnedState = () => {
      transcriptPinnedRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight < 96;
    };

    updatePinnedState();
    container.addEventListener("scroll", updatePinnedState, { passive: true });

    return () => {
      container.removeEventListener("scroll", updatePinnedState);
    };
  }, []);

  const lastTimelineEntry = activeTimeline[activeTimeline.length - 1] ?? null;

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) {
      previousActiveThreadIdRef.current = snapshot?.activeThreadId ?? null;
      previousTimelineLengthRef.current = activeTimeline.length;
      return;
    }

    const previousThreadId = previousActiveThreadIdRef.current;
    const previousTimelineLength = previousTimelineLengthRef.current;
    const nextThreadId = snapshot?.activeThreadId ?? null;
    const threadChanged = previousThreadId !== nextThreadId;
    const timelineGrew = activeTimeline.length > previousTimelineLength;
    const shouldFollowLiveOutput =
      transcriptPinnedRef.current &&
      (timelineGrew || Boolean(snapshot?.activeTurnId) || lastTimelineEntry?.status === "running");

    if (threadChanged || shouldFollowLiveOutput) {
      container.scrollTop = container.scrollHeight;
      transcriptPinnedRef.current = true;
    }

    previousActiveThreadIdRef.current = nextThreadId;
    previousTimelineLengthRef.current = activeTimeline.length;
  }, [
    activeTimeline.length,
    lastTimelineEntry?.id,
    lastTimelineEntry?.updatedAt,
    lastTimelineEntry?.status,
    snapshot?.activeThreadId,
    snapshot?.activeTurnId,
  ]);

  useEffect(() => {
    if (viewMode !== "chat") {
      return;
    }

    const container = transcriptScrollRef.current;
    if (!container) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      transcriptPinnedRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [viewMode, snapshot?.activeThreadId]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const minHeight = window.innerWidth <= 760 ? 44 : 60;
    const maxHeight = window.innerWidth <= 760 ? 112 : 164;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
  }, [composer]);

  function rememberSurfaceOrigin(origin?: HTMLElement | null) {
    surfaceOriginRef.current =
      origin ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }

  function openSurface(nextSurface: SurfaceKind, origin?: HTMLElement | null) {
    rememberSurfaceOrigin(origin);
    setThreadDrawerOpen(false);
    setSurface(nextSurface);
  }

  function focusComposerSoon(forceMobile = false) {
    window.setTimeout(() => {
      if (isPhoneLayout && !forceMobile) {
        return;
      }

      composerRef.current?.focus();
    }, 0);
  }

  function restoreFocusToOrigin() {
    window.setTimeout(() => {
      const origin = surfaceOriginRef.current;
      if (origin?.isConnected) {
        origin.focus();
        return;
      }

      if (viewMode === "home") {
        homeSearchRef.current?.focus();
        return;
      }

      if (isPhoneLayout) {
        return;
      }

      composerRef.current?.focus();
    }, 0);
  }

  function closeSurface(restoreFocus = true) {
    setSurface(null);
    if (restoreFocus) {
      restoreFocusToOrigin();
    }
  }

  function openThreadDrawer(origin?: HTMLElement | null) {
    rememberSurfaceOrigin(origin);
    setThreadDrawerOpen(true);
  }

  function closeThreadDrawer(restoreFocus = true) {
    setThreadDrawerOpen(false);
    if (restoreFocus) {
      restoreFocusToOrigin();
    }
  }

  function openHome() {
    setThreadDrawerOpen(false);
    setSurface(null);
    setWorkspaceDraft(preferredWorkspacePath);
    setViewMode("home");
    window.setTimeout(() => {
      homeSearchRef.current?.focus();
    }, 0);
  }

  async function loadWorkspaceListing(path?: string | null) {
    if (demoMode) {
      setWorkspaceLoading(true);
      startTransition(() => {
        setWorkspaceListing(createDemoWorkspaceListing(path ?? preferredWorkspacePath));
      });
      setWorkspaceLoading(false);
      return;
    }

    try {
      setWorkspaceLoading(true);
      const nextPath = path?.trim();
      const query = nextPath ? `?path=${encodeURIComponent(nextPath)}` : "";
      const listing = await callApi<WorkspaceListing>(`/api/workspace/list${query}`);
      setWorkspaceListing(listing);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to load directories.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleOpenWorkspacePicker(origin?: HTMLElement | null) {
    openSurface("workspace", origin);
    await loadWorkspaceListing(preferredWorkspacePath);
  }

  function handleChooseWorkspace(path: string) {
    setWorkspaceDraft(path.trim());
    closeSurface();
  }

  async function syncSnapshotFromResult(
    runner: () => Promise<{ snapshot: BridgeSnapshot }>,
    busyLabel: string,
  ) {
    try {
      setBusyAction(busyLabel);
      const payload = await runner();
      startTransition(() => {
        setSnapshot(payload.snapshot);
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : `${busyLabel} failed.`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateThread(options?: {
    closeCurrentSurface?: boolean;
    workspacePath?: string | null;
  }) {
    const workspacePath =
      options?.workspacePath?.trim() || preferredWorkspacePath || launchWorkspacePath;
    setWorkspaceDraft(workspacePath);

    if (demoMode) {
      applyDemoSnapshot((current) => createDemoThreadSnapshot(current, workspacePath));

      if (options?.closeCurrentSurface) {
        setSurface(null);
      }

      setViewMode("chat");
      setComposer("");
      focusComposerSoon();
      return;
    }

    await syncSnapshotFromResult(
      () =>
        callApi("/api/thread/start", {
          cwd: workspacePath || undefined,
        }),
      copy.actions.startingThread,
    );

    if (options?.closeCurrentSurface) {
      setSurface(null);
    }

    setViewMode("chat");
    setComposer("");
    focusComposerSoon();
  }

  async function handleSubmit() {
    const value = composer.trim();
    if (!value) {
      return;
    }

    if (value.startsWith("/")) {
      await handleSlashCommand(resolveSlashCommand(value, visibleCommands, selectedCommandIndex));
      return;
    }

    await syncSnapshotFromResult(
      () => callApi("/api/turn/start", { text: value }),
      copy.actions.sendingTurn,
    );
    setComposer("");
  }

  async function handleSlashCommand(rawValue: string) {
    const commandName = rawValue.replace(/^\//, "").trim().split(/\s+/)[0]?.toLowerCase();
    const command = BUILTIN_COMMANDS.find((entry) => entry.name === commandName);

    if (!command) {
      setToast(copy.common.unknownSlashCommand(rawValue));
      return;
    }

    switch (command.action) {
      case "new":
      case "clear":
        openHome();
        break;
      case "resume":
        openHome();
        break;
      case "fork":
        if (!snapshot?.activeThreadId) {
          setToast(copy.common.noActiveThreadToFork);
          return;
        }

        {
          const threadId = snapshot.activeThreadId;

          if (demoMode) {
            applyDemoSnapshot((current) => activateDemoThread(current, threadId));
            break;
          }

          await syncSnapshotFromResult(
            () => callApi("/api/thread/fork", { threadId }),
            copy.actions.forkingThread,
          );
          break;
        }
      case "model":
        window.setTimeout(() => {
          composerModelSelectRef.current?.focus();
        }, 0);
        break;
      case "review":
        await syncSnapshotFromResult(
          () => callApi("/api/review/start", {}),
          copy.actions.startingReview,
        );
        break;
      case "status":
        openSurface(
          "status",
          document.activeElement instanceof HTMLElement ? document.activeElement : null,
        );
        break;
    }

    setComposer("");
  }

  async function handleResumeThread(threadId: string) {
    if (demoMode) {
      applyDemoSnapshot((current) => activateDemoThread(current, threadId));
      setThreadDrawerOpen(false);
      setViewMode("chat");
      focusComposerSoon();
      return;
    }

    await syncSnapshotFromResult(
      () => callApi("/api/thread/resume", { threadId }),
      copy.actions.resumingThread,
    );
    setThreadDrawerOpen(false);
    setViewMode("chat");
    focusComposerSoon();
  }

  async function handleOpenThread(threadId: string) {
    if (demoMode) {
      await handleResumeThread(threadId);
      return;
    }

    if (threadId === snapshot?.activeThreadId) {
      await syncSnapshotFromResult(
        () => callApi("/api/thread/read", { threadId }),
        copy.actions.loadingThread,
      );
      setThreadDrawerOpen(false);
      setViewMode("chat");
      focusComposerSoon();
      return;
    }

    await handleResumeThread(threadId);
  }

  async function handleInterrupt() {
    if (demoMode) {
      return;
    }

    await syncSnapshotFromResult(
      () => callApi("/api/turn/interrupt", {}),
      copy.actions.interruptingTurn,
    );
  }

  async function handleModelChange(model: string, effort: string | null) {
    if (demoMode) {
      applyDemoSnapshot((current) =>
        updateDemoSessionSettings(current, {
          model,
          effort: effort as BridgeSnapshot["sessionSettings"]["effort"],
        }),
      );
      focusComposerSoon();
      return;
    }

    await syncSnapshotFromResult(
      () => callApi("/api/session/settings", { model, effort }),
      copy.actions.updatingSessionSettings,
    );
    focusComposerSoon();
  }

  async function handleComposerModelChange(model: string) {
    const nextModel = snapshot?.models.find((entry) => entry.model === model);
    if (!nextModel) {
      return;
    }

    const preferredEffort = selectedEffortValue || nextModel.defaultReasoningEffort;
    const nextEffort = nextModel.supportedReasoningEfforts.some(
      (entry) => entry.reasoningEffort === preferredEffort,
    )
      ? preferredEffort
      : nextModel.defaultReasoningEffort;

    await handleModelChange(nextModel.model, nextEffort);
  }

  async function handleComposerEffortChange(effort: string) {
    if (!currentModel) {
      return;
    }

    await handleModelChange(currentModel.model, effort);
  }

  function handleLanguageChange(language: UiLanguage) {
    setUiLanguage(language);
    if (viewMode !== "chat") {
      return;
    }

    focusComposerSoon();
  }

  async function handleSessionModeChange(planMode: boolean) {
    if ((snapshot?.sessionSettings.planMode ?? false) === planMode && !demoMode) {
      return;
    }

    if (demoMode) {
      if ((snapshot?.sessionSettings.planMode ?? false) === planMode) {
        return;
      }

      applyDemoSnapshot((current) =>
        updateDemoSessionSettings(current, {
          planMode,
        }),
      );
      focusComposerSoon();
      return;
    }

    await syncSnapshotFromResult(
      () =>
        callApi("/api/session/settings", {
          planMode,
        }),
      copy.actions.updatingSessionSettings,
    );
    focusComposerSoon();
  }

  async function handleServerRequestResponse(requestId: string, result: unknown) {
    if (demoMode) {
      return;
    }

    await syncSnapshotFromResult(
      () =>
        callApi("/api/server-request/respond", {
          requestId,
          result,
        }),
      copy.actions.respondingToServerRequest,
    );
  }

  function handleComposerChange(nextValue: string) {
    setComposer(nextValue);
    setCommandMenuDismissed(false);
  }

  const currentModel = getCurrentModel(snapshot);
  const currentEffort = getCurrentEffort(snapshot);
  const runtime = snapshot?.activeTurnId
    ? formatRuntime(snapshot.activeTurnStartedAt ?? null)
    : "idle";
  const currentCommandText =
    typeof (pendingRequest?.params as { command?: string } | undefined)?.command === "string"
      ? ((pendingRequest?.params as { command?: string }).command ?? null)
      : null;
  const activeOverlay = surface;
  const sessionTitle = activeThreadSummary?.title ?? (locale === "ko" ? "새 세션" : "New session");
  const sessionMeta = activeThreadSummary
    ? [
        activeThreadSummary.workspaceLabel,
        activeThreadSummary.branch,
        activeThreadSummary.statusLabel,
      ]
        .filter(Boolean)
        .join(" · ")
    : locale === "ko"
      ? "Home에서 thread를 열거나 새로 시작하세요."
      : "Open a thread from Home or start a new one.";
  const sessionMetaTitle = activeThreadSummary?.workspacePath ?? activeThreadSummary?.title ?? null;
  const headerStatus = connectionState !== "live"
    ? {
        label:
          connectionState === "connecting"
            ? copy.header.connecting
            : copy.header.reconnecting,
        tone: "starting" as const,
      }
    : snapshot?.lastError
      ? { label: copy.header.error, tone: "error" as const }
      : pendingRequest
        ? { label: copy.header.pendingRequest, tone: "pending" as const }
        : snapshot?.activeTurnId
          ? { label: copy.header.working, tone: "working" as const }
          : snapshot?.phase && snapshot.phase !== "ready"
            ? { label: copy.statusPanel.phase[snapshot.phase], tone: "starting" as const }
            : { label: copy.header.ready, tone: "ready" as const };
  const selectedModelValue = currentModel?.model ?? "";
  const selectedEffortValue = currentEffort ?? currentModel?.defaultReasoningEffort ?? "";
  const selectedPlanMode = snapshot?.sessionSettings.planMode ?? false;
  const selectedLanguageValue = uiLanguage;
  const sessionModelOptions = (snapshot?.models ?? []).map((model) => ({
    value: model.model,
    label: model.displayName,
  }));
  const sessionEffortOptions = (currentModel?.supportedReasoningEfforts ?? []).map((effort) => ({
    value: effort.reasoningEffort,
    label: effort.reasoningEffort,
  }));
  const languageOptions = getLanguageOptions(locale);
  const selectedModelLabel =
    sessionModelOptions.find((option) => option.value === selectedModelValue)?.label ??
    selectedModelValue ??
    copy.common.unavailable;
  const selectedEffortLabel =
    sessionEffortOptions.find((option) => option.value === selectedEffortValue)?.label ??
    selectedEffortValue ??
    copy.common.unavailable;
  const selectedLanguageLabel =
    languageOptions.find((option) => option.value === selectedLanguageValue)?.label ??
    selectedLanguageValue;
  const selectedModeLabel = selectedPlanMode ? copy.composer.plan : copy.composer.fast;
  const sessionSummary = [
    selectedModelLabel,
    selectedEffortLabel,
    selectedModeLabel,
  ]
    .filter(Boolean)
    .join(" / ");
  const workspacePickerOptions = useMemo(() => {
    const draftPath = workspaceDraft.trim();
    const options = [...(snapshot?.workspaceOptions ?? [])];
    const hasDraftPath = draftPath.length > 0 && options.some((option) => option.path === draftPath);

    if (draftPath.length > 0 && !hasDraftPath) {
      options.unshift({
        path: draftPath,
        label: formatWorkspacePathLabel(draftPath),
        threadCount: 0,
        lastUsedAt: null,
        isCurrent: true,
      });
    }

    return options.map((option) => ({
      ...option,
      isCurrent:
        option.path === (draftPath || preferredWorkspacePath || snapshot?.defaultWorkspacePath),
    }));
  }, [preferredWorkspacePath, snapshot?.defaultWorkspacePath, snapshot?.workspaceOptions, workspaceDraft]);
  const settingsFacts = [
    {
      label: copy.statusPanel.connection,
      value: connectionState === "live" ? copy.statusPanel.live : headerStatus.label,
    },
    {
      label: copy.statusPanel.activeThread,
      value: activeThreadSummary?.title ?? copy.common.none,
    },
    {
      label: copy.statusPanel.model,
      value: currentModel?.displayName ?? currentModel?.model ?? "default",
    },
    {
      label: copy.statusPanel.reasoning,
      value: currentEffort ?? "default",
    },
    {
      label: copy.statusPanel.mode,
      value: selectedModeLabel,
    },
    {
      label: copy.statusPanel.uiLanguage,
      value: selectedLanguageLabel,
    },
  ];
  const composerHelper = connectionState !== "live"
    ? copy.composer.helperReconnect
    : visibleCommands.length
      ? copy.composer.helperSlash
      : snapshot?.activeTurnId
        ? copy.composer.helperStreaming
        : copy.composer.helperIdle;
  const composerStatus = connectionState !== "live"
    ? connectionState === "connecting"
      ? copy.composer.connecting
      : copy.composer.reconnecting
    : snapshot?.activeTurnId
      ? copy.composer.working
      : pendingRequest
        ? pendingRequest.summary
        : busyAction
        ? busyAction
        : selectedPlanMode
          ? copy.composer.readyPlan
          : copy.composer.ready;
  const hidePhoneIdleChrome =
    isPhoneLayout &&
    connectionState === "live" &&
    headerStatus.tone === "ready" &&
    !snapshot?.activeTurnId &&
    !pendingRequest &&
    !busyAction;

  const approvalChoices = useMemo<ApprovalChoice[]>(() => {
    if (!pendingRequest) {
      return [];
    }

    switch (pendingRequest.method) {
      case "item/commandExecution/requestApproval":
        return (
          ((pendingRequest.params as {
            availableDecisions?: CommandExecutionApprovalDecision[];
          })?.availableDecisions as CommandExecutionApprovalDecision[] | undefined) ?? [
            "accept",
            "decline",
            "cancel",
          ]
        ).map((decision) => ({
          key: summarizeDecision(decision),
          label: approvalDecisionLabel(decision, currentCommandText, locale),
          result: { decision },
          isCancel: decision === "cancel",
        }));

      case "item/fileChange/requestApproval":
        return ["accept", "acceptForSession", "decline", "cancel"].map((decision) => ({
          key: decision,
          label: fileApprovalDecisionLabel(decision, locale),
          result: { decision },
          isCancel: decision === "cancel",
        }));

      case "item/permissions/requestApproval":
        return [
          {
            label: locale === "ko" ? "기본 권한" : "Default",
            scope: "turn",
          },
          {
            label: locale === "ko" ? "전체 권한" : "Full Access",
            scope: "session",
          },
        ].map((option) => {
          const params = (pendingRequest.params as { permissions?: unknown }) ?? {};
          return {
            key: option.scope,
            label: option.label,
            result: {
              permissions: params.permissions ?? {},
              scope: option.scope,
            },
          };
        });

      default:
        return [];
    }
  }, [currentCommandText, locale, pendingRequest]);

  const approvalQuestionModels = useMemo<ApprovalQuestion[]>(() => {
    if (pendingRequest?.method !== "item/tool/requestUserInput") {
      return [];
    }

    const questions =
      ((pendingRequest.params as { questions?: ToolRequestUserInputQuestion[] })?.questions as
        | ToolRequestUserInputQuestion[]
        | undefined) ?? [];

    return questions.map((question) => ({
      id: question.id,
      header: question.header,
      question: question.question,
      options: question.options?.map((option) => option.label) ?? [],
      allowsFreeform: Boolean(question.isOther),
      value: requestAnswers[pendingRequest.id]?.[question.id] ?? "",
      onChange: (value: string) => {
        setRequestAnswers((current) => ({
          ...current,
          [pendingRequest.id]: {
            ...current[pendingRequest.id],
            [question.id]: value,
          },
        }));
      },
    }));
  }, [pendingRequest, requestAnswers]);

  const cancelApprovalChoice = approvalChoices.find((choice) => choice.isCancel);
  const approvalOptions: ApprovalOption[] = pendingRequest
    ? approvalChoices.map((choice) => ({
        key: choice.key,
        label: choice.label,
        onSelect: () => {
          void handleServerRequestResponse(pendingRequest.id, choice.result);
        },
      }))
    : [];

  const approvalTitle =
    pendingRequest?.method === "item/commandExecution/requestApproval"
      ? copy.approval.runCommandTitle
      : pendingRequest?.method === "item/fileChange/requestApproval"
        ? copy.approval.approveFilesTitle
        : pendingRequest?.method === "item/permissions/requestApproval"
          ? copy.approval.updatePermissionsTitle
          : pendingRequest?.method === "item/tool/requestUserInput"
            ? copy.approval.additionalInputTitle
            : copy.approval.serverRequestTitle;
  const approvalIntro =
    pendingRequest?.method === "item/commandExecution/requestApproval"
      ? copy.approval.runCommandIntro
      : pendingRequest?.method === "item/fileChange/requestApproval"
        ? copy.approval.editFilesIntro
        : pendingRequest?.method === "item/permissions/requestApproval"
          ? copy.approval.updatePermissionsIntro
          : pendingRequest?.summary ?? "";
  const approvalReason =
    typeof (pendingRequest?.params as { reason?: string | null } | undefined)?.reason ===
    "string"
      ? ((pendingRequest?.params as { reason?: string | null }).reason ?? null)
      : null;
  const approvalDetail =
    pendingRequest?.method === "item/commandExecution/requestApproval"
      ? currentCommandText
        ? `$ ${currentCommandText}`
        : pendingRequest.detail
      : pendingRequest?.detail ?? null;
  const approvalFooter = pendingRequest
    ? approvalChoices.length > 0
      ? cancelApprovalChoice
        ? copy.approval.footerChooseWithEsc
        : copy.approval.footerChoose
      : approvalQuestionModels.length > 0
        ? copy.approval.footerSubmit
        : null
    : null;

  useEffect(() => {
    if (pendingRequest) {
      setSelectedApprovalIndex((current) =>
        approvalChoices.length === 0
          ? 0
          : Math.min(current, approvalChoices.length - 1),
      );
      return;
    }

    setSelectedApprovalIndex(0);
  }, [approvalChoices.length, pendingRequest]);

  useEffect(() => {
    const panel = pendingRequest
      ? approvalDialogRef.current
      : surface
        ? overlayPanelRef.current
        : threadDrawerOpen
          ? threadDrawerRef.current
        : null;

    if (!panel) {
      return;
    }

    const focusTarget =
      panel.querySelector<HTMLElement>('[data-autofocus="true"]') ??
      getFocusableElements(panel)[0] ??
      panel;

    const raf = window.requestAnimationFrame(() => {
      focusTarget.focus();
    });

    const handleTrapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === first || !panel.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last || !panel.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTrapFocus);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleTrapFocus);
    };
  }, [pendingRequest?.id, surface, threadDrawerOpen]);

  useEffect(() => {
    if (pendingRequest) {
      return;
    }

    if (surface) {
      return;
    }

    if (threadDrawerOpen) {
      return;
    }

    if (document.activeElement !== document.body) {
      return;
    }

    if (viewMode === "chat") {
      if (isPhoneLayout) {
        return;
      }

      composerRef.current?.focus();
      return;
    }

    homeSearchRef.current?.focus();
  }, [isPhoneLayout, pendingRequest, surface, threadDrawerOpen, viewMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pendingRequest) {
        if (event.key === "Escape" && cancelApprovalChoice) {
          event.preventDefault();
          void handleServerRequestResponse(pendingRequest.id, cancelApprovalChoice.result);
          return;
        }

        if (approvalChoices.length > 0 && !isTypingElement(event.target)) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedApprovalIndex((current) =>
              Math.min(current + 1, approvalChoices.length - 1),
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedApprovalIndex((current) => Math.max(current - 1, 0));
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            const selectedChoice = approvalChoices[selectedApprovalIndex];
            if (selectedChoice) {
              void handleServerRequestResponse(pendingRequest.id, selectedChoice.result);
            }
          }
        }

        return;
      }

      if (surface && event.key === "Escape") {
        event.preventDefault();
        closeSurface();
        return;
      }

      if (threadDrawerOpen && event.key === "Escape") {
        event.preventDefault();
        closeThreadDrawer();
        return;
      }

      if (event.key === "?" && document.activeElement !== composerRef.current) {
        event.preventDefault();
        openSurface("shortcuts", document.activeElement as HTMLElement | null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    approvalChoices,
    cancelApprovalChoice,
    pendingRequest,
    selectedApprovalIndex,
    surface,
    threadDrawerOpen,
  ]);

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      if (visibleCommands.length > 0) {
        event.preventDefault();
        setCommandMenuDismissed(true);
        return;
      }

      if (snapshot?.activeTurnId) {
        event.preventDefault();
        void handleInterrupt();
      }
      return;
    }

    if (visibleCommands.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedCommandIndex((current) =>
          Math.min(current + 1, visibleCommands.length - 1),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedCommandIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const selected = visibleCommands[selectedCommandIndex];
        if (selected) {
          setComposer(`/${selected.name}`);
        }
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSlashCommand(resolveSlashCommand(composer, visibleCommands, selectedCommandIndex));
        setComposer("");
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <main className="tui-page">
      {viewMode === "home" ? (
        <HomeScreen
          locale={locale}
          copy={{
            eyebrow: copy.home.eyebrow,
            title: copy.home.title,
            intro: copy.home.intro,
            settings: copy.home.settings,
            currentThread: copy.home.currentThread,
            threadList: copy.home.threadList,
            createTitle: copy.home.createTitle,
            createIntro: copy.home.createIntro,
            workspace: copy.home.workspace,
            workspaceSelected: copy.home.workspaceSelected,
            browseWorkspace: copy.home.browseWorkspace,
            currentWorkspace: copy.home.currentWorkspace,
            startThread: copy.home.startThread,
            search: copy.home.search,
            searchPlaceholder: copy.home.searchPlaceholder,
            sortThreads: copy.home.sortThreads,
            noThreads: copy.home.noThreads,
            noOtherThreads: copy.home.noOtherThreads,
            noMatchingThreads: copy.home.noMatchingThreads,
            sessionLabel: copy.home.sessionLabel,
            openThread: copy.home.openThread,
            updatedSort: copy.home.updatedSort,
            createdSort: copy.home.createdSort,
          }}
          sessionSummary={sessionSummary}
          search={threadSearch}
          sort={threadSort}
          activeThread={activeThreadSummary}
          filteredThreads={visibleHomeThreads}
          workspaceDraft={workspaceDraft}
          statusLabel={headerStatus.label}
          statusTone={headerStatus.tone}
          searchInputRef={homeSearchRef}
          onOpenSettings={() => {
            openSurface(
              "settings",
              document.activeElement instanceof HTMLElement ? document.activeElement : null,
            );
          }}
          onSearchChange={setThreadSearch}
          onSortChange={setThreadSort}
          onUseDefaultWorkspace={() => {
            setWorkspaceDraft(currentWorkspacePath);
          }}
          onOpenWorkspacePicker={() => {
            void handleOpenWorkspacePicker(
              document.activeElement instanceof HTMLElement ? document.activeElement : null,
            );
          }}
          onCreateThread={() => {
            void handleCreateThread({
              workspacePath: workspaceDraft,
            });
          }}
          onOpenThread={(threadId) => {
            void handleOpenThread(threadId);
          }}
        />
      ) : null}

      {viewMode === "chat" ? (
        <section className="tui-shell">
          <ShellHeader
            threadCount={snapshot?.threadList.length ?? 0}
            sessionTitle={sessionTitle}
            sessionMeta={sessionMeta}
            sessionMetaTitle={sessionMetaTitle}
            homeLabel={copy.header.home}
            threadsLabel={copy.header.threads}
            settingsLabel={copy.header.settings}
            statusLabel={headerStatus.label}
            statusTone={headerStatus.tone}
            showStatusLine={!hidePhoneIdleChrome}
            homeButtonRef={homeButtonRef}
            onHomeClick={() => {
              openHome();
            }}
            onThreadsClick={() => {
              openThreadDrawer(
                document.activeElement instanceof HTMLElement ? document.activeElement : null,
              );
            }}
            onSettingsClick={() => {
              openSurface(
                "settings",
                document.activeElement instanceof HTMLElement ? document.activeElement : null,
              );
            }}
          />

          <section className="transcript-surface">
            <TranscriptPane
              scrollRef={transcriptScrollRef}
              timeline={activeTimeline}
              locale={locale}
              copy={copy.transcript}
              emptyTitle={
                activeThread ? copy.transcript.noTranscriptYet : copy.transcript.noActiveSession
              }
              emptyBody={
                activeThread
                  ? copy.transcript.sendFirstTurn
                  : copy.transcript.typeMessageOrOpenThreadDrawer
              }
            />
          </section>

          <ComposerDock
            composer={composer}
            visibleCommands={visibleCommands}
            selectedCommandIndex={selectedCommandIndex}
            composerRef={composerRef}
            modelSelectRef={composerModelSelectRef}
            helperText={composerHelper}
            statusText={composerStatus}
            canSubmit={Boolean(composer.trim())}
            activeTurn={Boolean(snapshot?.activeTurnId)}
            showToolbar={!hidePhoneIdleChrome}
            selectedModel={selectedModelValue}
            selectedEffort={selectedEffortValue}
            planMode={selectedPlanMode}
            modelOptions={sessionModelOptions}
            effortOptions={sessionEffortOptions}
            labels={{
              model: copy.composer.model,
              reasoning: copy.composer.reasoning,
              mode: copy.composer.mode,
              fast: copy.composer.fast,
              plan: copy.composer.plan,
              placeholder: copy.composer.placeholder,
              interrupt: copy.composer.interrupt,
              send: copy.composer.send,
              unavailable: copy.common.unavailable,
            }}
            onComposerChange={handleComposerChange}
            onComposerKeyDown={handleComposerKeyDown}
            onCommandPick={(commandName) => {
              setComposer(`/${commandName}`);
              setCommandMenuDismissed(false);
              focusComposerSoon(true);
            }}
            onModelChange={(value) => {
              void handleComposerModelChange(value);
            }}
            onEffortChange={(value) => {
              void handleComposerEffortChange(value);
            }}
            onModeChange={(planMode) => {
              void handleSessionModeChange(planMode);
            }}
            onSubmit={() => {
              void handleSubmit();
            }}
            onInterrupt={() => {
              void handleInterrupt();
            }}
          />
        </section>
      ) : null}

      {threadDrawerOpen && viewMode === "chat" ? (
        <ThreadDrawer
          ref={threadDrawerRef}
          locale={locale}
          copy={{
            title: copy.header.threads,
            sessions: copy.threadDrawer.sessions,
            close: copy.common.close,
            search: copy.threadDrawer.search,
            searchPlaceholder: copy.threadDrawer.searchPlaceholder,
            newThread: copy.threadDrawer.newThread,
            threadControls: copy.threadDrawer.threadControls,
            sortThreads: copy.threadDrawer.sortThreads,
            current: copy.common.current,
            recent: copy.common.recent,
            recentAvailable: copy.threadDrawer.recentAvailable,
            noMatchingThreads: copy.threadDrawer.noMatchingThreads,
            noOtherThreads: copy.threadDrawer.noOtherThreads,
            recentSort: copy.threadDrawer.recentSort,
            createdSort: copy.threadDrawer.createdSort,
          }}
          search={threadSearch}
          sort={threadSort}
          visibleCount={filteredThreads.filter((thread) => !thread.isActive).length + (activeThreadSummary ? 1 : 0)}
          activeThread={activeThreadSummary}
          recentThreads={filteredThreads.filter((thread) => !thread.isActive)}
          onSearchChange={setThreadSearch}
          onSortChange={setThreadSort}
          onClose={() => closeThreadDrawer()}
          onCreateThread={() => {
            setThreadDrawerOpen(false);
            openHome();
          }}
          onResumeThread={(threadId) => {
            void handleOpenThread(threadId);
          }}
        />
      ) : null}

      {activeOverlay === "workspace" ? (
        <SurfaceDialog
          ref={overlayPanelRef}
          title={copy.workspacePicker.title}
          subtitle={copy.workspacePicker.subtitle}
          footer={copy.surface.statusFooter}
          kickerLabel={copy.home.workspace}
          closeLabel={copy.common.close}
          size="wide"
          onClose={() => closeSurface()}
        >
          <WorkspacePicker
            listing={workspaceListing}
            loading={workspaceLoading}
            recentWorkspaces={workspacePickerOptions}
            labels={{
              currentPath: copy.workspacePicker.currentPath,
              recent: copy.workspacePicker.recent,
              folders: copy.workspacePicker.folders,
              selectCurrent: copy.workspacePicker.selectCurrent,
              goUp: copy.workspacePicker.goUp,
              empty: copy.workspacePicker.empty,
              current: copy.workspacePicker.current,
              threads: copy.workspacePicker.threads,
              loading: copy.workspacePicker.loading,
            }}
            onNavigate={(path) => {
              void loadWorkspaceListing(path);
            }}
            onChoose={handleChooseWorkspace}
          />
        </SurfaceDialog>
      ) : null}

      {activeOverlay === "settings" ? (
        <SurfaceDialog
          ref={overlayPanelRef}
          title={copy.surface.settingsTitle}
          subtitle={copy.surface.settingsSubtitle}
          footer={copy.surface.settingsFooter}
          kickerLabel={copy.header.settings}
          closeLabel={copy.common.close}
          onClose={() => closeSurface()}
        >
          <SettingsPanel
            selectedLanguage={selectedLanguageValue}
            languageOptions={languageOptions}
            facts={settingsFacts}
            labels={{
              interfaceTitle: copy.settingsPanel.interfaceTitle,
              language: copy.settingsPanel.language,
              sessionTitle: copy.settingsPanel.sessionTitle,
              applyHint: copy.settingsPanel.applyHint,
            }}
            onLanguageChange={handleLanguageChange}
          />
        </SurfaceDialog>
      ) : null}

      {activeOverlay === "status" && snapshot ? (
        <SurfaceDialog
          ref={overlayPanelRef}
          title={copy.surface.statusTitle}
          subtitle={buildStatusLine(snapshot, locale)}
          footer={copy.surface.statusFooter}
          kickerLabel={copy.surface.overlay}
          closeLabel={copy.common.close}
          onClose={() => closeSurface()}
        >
          <div className="picker-scroll">
            <pre className="status-pre">
{`${copy.statusPanel.bridge}: ${copy.statusPanel.phase[snapshot.phase]}
${copy.statusPanel.connection}: ${connectionState === "live" ? copy.statusPanel.live : headerStatus.label}
${copy.statusPanel.activeThread}: ${activeThreadSummary?.title ?? copy.common.none}
${copy.statusPanel.model}: ${currentModel?.displayName ?? currentModel?.model ?? "default"}
${copy.statusPanel.reasoning}: ${currentEffort ?? "default"}
${copy.statusPanel.mode}: ${selectedModeLabel}
${copy.statusPanel.uiLanguage}: ${languageOptions.find((option) => option.value === selectedLanguageValue)?.label ?? selectedLanguageValue}
${copy.statusPanel.pendingRequests}: ${snapshot.pendingRequests.length}
${copy.statusPanel.runtime}: ${runtime}
${copy.statusPanel.lastError}: ${snapshot.lastError ?? copy.common.none}`}
            </pre>
          </div>
        </SurfaceDialog>
      ) : null}

      {activeOverlay === "shortcuts" ? (
        <SurfaceDialog
          ref={overlayPanelRef}
          title={copy.surface.shortcutsTitle}
          subtitle={copy.surface.shortcutsSubtitle}
          footer={copy.surface.shortcutsFooter}
          kickerLabel={copy.surface.overlay}
          closeLabel={copy.common.close}
          onClose={() => closeSurface()}
        >
          <div className="picker-scroll">
            <pre className="status-pre">{copy.shortcutsPanel.lines.join("\n")}</pre>
          </div>
        </SurfaceDialog>
      ) : null}

      {pendingRequest ? (
        <ApprovalDialog
          ref={approvalDialogRef}
          title={approvalTitle}
          intro={approvalIntro}
          kickerLabel={copy.approval.approval}
          cancelLabel={copy.common.cancel}
          reasonLabel={copy.approval.reason}
          typeAnswerLabel={copy.approval.typeAnswer}
          advancedJsonLabel={copy.approval.advancedJson}
          sendJsonLabel={copy.approval.sendJson}
          reason={approvalReason}
          detail={approvalDetail}
          options={approvalOptions}
          selectedOptionIndex={selectedApprovalIndex}
          questions={approvalQuestionModels}
          submitLabel={
            approvalQuestionModels.length > 0 ? copy.approval.submitAnswers : null
          }
          onSubmitQuestions={
            approvalQuestionModels.length > 0
              ? () => {
                  const questions =
                    ((pendingRequest.params as {
                      questions?: ToolRequestUserInputQuestion[];
                    })?.questions as ToolRequestUserInputQuestion[] | undefined) ?? [];
                  const answers = Object.fromEntries(
                    questions.map((question) => [
                      question.id,
                      {
                        answers: [
                          requestAnswers[pendingRequest.id]?.[question.id] ?? "",
                        ].filter(Boolean),
                      },
                    ]),
                  );
                  void handleServerRequestResponse(pendingRequest.id, { answers });
                }
              : null
          }
          requestDraft={requestDrafts[pendingRequest.id] ?? ""}
          onRequestDraftChange={(value) => {
            setRequestDrafts((current) => ({
              ...current,
              [pendingRequest.id]: value,
            }));
          }}
          onSendJson={() => {
            try {
              const parsed = JSON.parse(requestDrafts[pendingRequest.id] ?? "{}");
              void handleServerRequestResponse(pendingRequest.id, parsed);
            } catch (error) {
              setToast(
                error instanceof Error
                  ? error.message
                  : copy.common.invalidJson,
              );
            }
          }}
          footer={approvalFooter}
          onCancel={
            cancelApprovalChoice
              ? () => {
                  void handleServerRequestResponse(
                    pendingRequest.id,
                    cancelApprovalChoice.result,
                  );
                }
              : null
          }
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
