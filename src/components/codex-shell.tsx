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
import { ComposerDock } from "@/components/codex-shell/composer-dock";
import { ShellHeader } from "@/components/codex-shell/shell-header";
import { SurfaceDialog } from "@/components/codex-shell/surface-dialog";
import { ThreadDrawer } from "@/components/codex-shell/thread-drawer";
import { TranscriptPane } from "@/components/codex-shell/transcript-pane";
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
import type { BridgeSnapshot } from "@/lib/shared";
import { BUILTIN_COMMANDS } from "@/lib/shared";

type ApprovalChoice = {
  key: string;
  label: string;
  result: unknown;
  isCancel?: boolean;
};

type ConnectionState = "connecting" | "live" | "reconnecting";

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

export function CodexShell() {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [surface, setSurface] = useState<SurfaceKind | null>(null);
  const [composer, setComposer] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [threadSort, setThreadSort] = useState<ThreadDrawerSort>("updated");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [selectedApprovalIndex, setSelectedApprovalIndex] = useState(0);
  const [commandMenuDismissed, setCommandMenuDismissed] = useState(false);
  const [requestDrafts, setRequestDrafts] = useState<Record<string, string>>({});
  const [requestAnswers, setRequestAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerSessionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const threadDrawerPanelRef = useRef<HTMLDivElement | null>(null);
  const overlayPanelRef = useRef<HTMLDivElement | null>(null);
  const approvalDialogRef = useRef<HTMLDivElement | null>(null);
  const threadButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveThreadIdRef = useRef<string | null>(null);
  const previousTimelineLengthRef = useRef(0);
  const transcriptPinnedRef = useRef(true);
  const surfaceOriginRef = useRef<HTMLElement | null>(null);
  const approvalOriginRef = useRef<HTMLElement | null>(null);
  const previousPendingRequestIdRef = useRef<string | null>(null);
  const deferredThreadSearch = useDeferredValue(threadSearch);

  const applySnapshot = useEffectEvent((nextSnapshot: BridgeSnapshot) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
    });
  });

  const refreshBootstrap = useEffectEvent(async (showToastOnError: boolean) => {
    try {
      const payload = await callApi<{ snapshot: BridgeSnapshot }>("/api/bootstrap");
      applySnapshot(payload.snapshot);
    } catch (error) {
      if (!showToastOnError) {
        return;
      }

      setToast(error instanceof Error ? error.message : "Failed to load bootstrap.");
    }
  });

  useEffect(() => {
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
  }, []);

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

  const recentThreads = useMemo(
    () => filteredThreads.filter((thread) => !thread.isActive),
    [filteredThreads],
  );

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
        if (surface === "threads") {
          const target =
            threadDrawerPanelRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]');
          target?.focus();
          return;
        }

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

        composerRef.current?.focus();
      }, 0);
    }

    previousPendingRequestIdRef.current = currentPendingRequestId;
  }, [pendingRequest?.id, surface]);

  const visibleCommands = !commandMenuDismissed && composer.trimStart().startsWith("/")
    ? filterCommands(composer.trimStart())
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
    const textarea = composerRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const minHeight = window.innerWidth <= 980 ? 68 : 76;
    const maxHeight = window.innerWidth <= 980 ? 160 : 208;
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
    setSurface(nextSurface);
  }

  function restoreFocusToOrigin() {
    window.setTimeout(() => {
      const origin = surfaceOriginRef.current;
      if (origin?.isConnected) {
        origin.focus();
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

  async function handleCreateThread(closeCurrentSurface = false) {
    await syncSnapshotFromResult(() => callApi("/api/thread/start", {}), "Starting thread");

    if (closeCurrentSurface) {
      setSurface(null);
    }

    setComposer("");
    window.setTimeout(() => {
      composerRef.current?.focus();
    }, 0);
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
      "Sending turn",
    );
    setComposer("");
  }

  async function handleSlashCommand(rawValue: string) {
    const commandName = rawValue.replace(/^\//, "").trim().split(/\s+/)[0]?.toLowerCase();
    const command = BUILTIN_COMMANDS.find((entry) => entry.name === commandName);

    if (!command) {
      setToast(`Unknown slash command: ${rawValue}`);
      return;
    }

    switch (command.action) {
      case "new":
      case "clear":
        await handleCreateThread();
        break;
      case "resume":
        openSurface("threads", threadButtonRef.current);
        break;
      case "fork":
        if (!snapshot?.activeThreadId) {
          setToast("No active thread to fork.");
          return;
        }

        await syncSnapshotFromResult(
          () => callApi("/api/thread/fork", { threadId: snapshot.activeThreadId }),
          "Forking thread",
        );
        break;
      case "model":
        window.setTimeout(() => {
          composerSessionTriggerRef.current?.focus();
        }, 0);
        break;
      case "review":
        await syncSnapshotFromResult(
          () => callApi("/api/review/start", {}),
          "Starting review",
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
    await syncSnapshotFromResult(
      () => callApi("/api/thread/resume", { threadId }),
      "Resuming thread",
    );
    setSurface(null);
    window.setTimeout(() => {
      composerRef.current?.focus();
    }, 0);
  }

  async function handleInterrupt() {
    await syncSnapshotFromResult(
      () => callApi("/api/turn/interrupt", {}),
      "Interrupting turn",
    );
  }

  async function handleModelChange(model: string, effort: string | null) {
    await syncSnapshotFromResult(
      () => callApi("/api/session/settings", { model, effort }),
      "Updating session settings",
    );
    window.setTimeout(() => {
      composerRef.current?.focus();
    }, 0);
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

  async function handlePlanModeToggle() {
    await syncSnapshotFromResult(
      () =>
        callApi("/api/session/settings", {
          planMode: !(snapshot?.sessionSettings.planMode ?? false),
        }),
      "Updating session settings",
    );
    window.setTimeout(() => {
      composerRef.current?.focus();
    }, 0);
  }

  async function handleServerRequestResponse(requestId: string, result: unknown) {
    await syncSnapshotFromResult(
      () =>
        callApi("/api/server-request/respond", {
          requestId,
          result,
        }),
      "Responding to server request",
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
  const activeOverlay = surface && surface !== "threads" ? surface : null;
  const sessionTitle = activeThreadSummary?.title ?? "New session";
  const sessionMeta = activeThreadSummary
    ? [
        activeThreadSummary.workspaceLabel,
        activeThreadSummary.branch,
        activeThreadSummary.statusLabel,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Open a thread or send the first message.";
  const sessionMetaTitle = activeThreadSummary?.workspacePath ?? activeThreadSummary?.title ?? null;
  const headerStatus = connectionState !== "live"
    ? {
        label: connectionState === "connecting" ? "connecting" : "reconnecting",
        tone: "starting" as const,
      }
    : snapshot?.lastError
      ? { label: "error", tone: "error" as const }
      : pendingRequest
        ? { label: "pending request", tone: "pending" as const }
        : snapshot?.activeTurnId
          ? { label: "working", tone: "working" as const }
          : snapshot?.phase && snapshot.phase !== "ready"
            ? { label: snapshot.phase, tone: "starting" as const }
            : { label: "ready", tone: "ready" as const };
  const selectedModelValue = currentModel?.model ?? "";
  const selectedEffortValue = currentEffort ?? currentModel?.defaultReasoningEffort ?? "";
  const selectedPlanMode = snapshot?.sessionSettings.planMode ?? false;
  const sessionModelOptions = (snapshot?.models ?? []).map((model) => ({
    value: model.model,
    label: model.displayName,
  }));
  const sessionEffortOptions = (currentModel?.supportedReasoningEfforts ?? []).map((effort) => ({
    value: effort.reasoningEffort,
    label: effort.reasoningEffort,
  }));
  const composerHelper = connectionState !== "live"
    ? "WebSocket reconnects automatically."
    : visibleCommands.length
      ? "Arrow keys move. Enter runs. Tab completes. Esc hides."
      : snapshot?.activeTurnId
        ? "Streaming live. Diffs stay folded until opened."
        : "/ commands. Enter sends. Shift+Enter adds a newline.";
  const composerStatus = connectionState !== "live"
    ? connectionState === "connecting"
      ? "Connecting"
      : "Reconnecting"
    : snapshot?.activeTurnId
      ? "Working"
      : pendingRequest
        ? pendingRequest.summary
        : busyAction
        ? busyAction
        : selectedPlanMode
          ? "Ready · plan"
          : "Ready";

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
          label: approvalDecisionLabel(decision, currentCommandText),
          result: { decision },
          isCancel: decision === "cancel",
        }));

      case "item/fileChange/requestApproval":
        return ["accept", "acceptForSession", "decline", "cancel"].map((decision) => ({
          key: decision,
          label: fileApprovalDecisionLabel(decision),
          result: { decision },
          isCancel: decision === "cancel",
        }));

      case "item/permissions/requestApproval":
        return [
          { label: "Default", scope: "turn" },
          { label: "Full Access", scope: "session" },
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
  }, [currentCommandText, pendingRequest]);

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
      ? "Run command?"
      : pendingRequest?.method === "item/fileChange/requestApproval"
        ? "Approve file changes?"
        : pendingRequest?.method === "item/permissions/requestApproval"
          ? "Update permissions?"
          : pendingRequest?.method === "item/tool/requestUserInput"
            ? "Additional input required"
            : "Server request";
  const approvalIntro =
    pendingRequest?.method === "item/commandExecution/requestApproval"
      ? "Codex wants to run the following command."
      : pendingRequest?.method === "item/fileChange/requestApproval"
        ? "Codex wants to make the following edits."
        : pendingRequest?.method === "item/permissions/requestApproval"
          ? "Codex wants to update model permissions."
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
        ? "Use ↑/↓ then Enter to choose. Esc cancels."
        : "Use ↑/↓ then Enter to choose."
      : approvalQuestionModels.length > 0
        ? "Fill in the answers, then submit."
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
      : surface === "threads"
        ? threadDrawerPanelRef.current
        : surface
          ? overlayPanelRef.current
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
  }, [pendingRequest?.id, surface]);

  useEffect(() => {
    if (pendingRequest) {
      return;
    }

    if (surface) {
      return;
    }

    if (document.activeElement === document.body) {
      composerRef.current?.focus();
    }
  }, [pendingRequest, surface]);

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
      {surface === "threads" ? (
        <ThreadDrawer
          ref={threadDrawerPanelRef}
          search={threadSearch}
          sort={threadSort}
          filteredCount={filteredThreads.length}
          activeThread={activeThreadSummary}
          recentThreads={recentThreads}
          onSearchChange={setThreadSearch}
          onSortChange={setThreadSort}
          onClose={() => closeSurface()}
          onCreateThread={() => {
            void handleCreateThread(true);
          }}
          onResumeThread={(threadId) => {
            void handleResumeThread(threadId);
          }}
        />
      ) : null}

      <section className="tui-shell">
        <ShellHeader
          threadCount={snapshot?.threadList.length ?? 0}
          threadDrawerOpen={surface === "threads"}
          sessionTitle={sessionTitle}
          sessionMeta={sessionMeta}
          sessionMetaTitle={sessionMetaTitle}
          statusLabel={headerStatus.label}
          statusTone={headerStatus.tone}
          threadButtonRef={threadButtonRef}
          onThreadsClick={() => {
            if (surface === "threads") {
              closeSurface();
              return;
            }

            openSurface("threads", threadButtonRef.current);
          }}
        />

        <section className="transcript-surface">
          <TranscriptPane
            scrollRef={transcriptScrollRef}
            timeline={activeTimeline}
            emptyTitle={activeThread ? "No transcript yet" : "No active session"}
            emptyBody={
              activeThread
                ? "Send the first turn to begin."
                : "Type a message or open the thread drawer."
            }
          />
        </section>

        <ComposerDock
          composer={composer}
          visibleCommands={visibleCommands}
          selectedCommandIndex={selectedCommandIndex}
          composerRef={composerRef}
          sessionTriggerRef={composerSessionTriggerRef}
          helperText={composerHelper}
          statusText={composerStatus}
          canSubmit={Boolean(composer.trim())}
          activeTurn={Boolean(snapshot?.activeTurnId)}
          selectedModel={selectedModelValue}
          selectedEffort={selectedEffortValue}
          planMode={selectedPlanMode}
          modelOptions={sessionModelOptions}
          effortOptions={sessionEffortOptions}
          onComposerChange={handleComposerChange}
          onComposerKeyDown={handleComposerKeyDown}
          onCommandPick={(commandName) => {
            setComposer(`/${commandName}`);
            setCommandMenuDismissed(false);
            window.setTimeout(() => {
              composerRef.current?.focus();
            }, 0);
          }}
          onModelChange={(value) => {
            void handleComposerModelChange(value);
          }}
          onEffortChange={(value) => {
            void handleComposerEffortChange(value);
          }}
          onPlanModeToggle={() => {
            void handlePlanModeToggle();
          }}
          onSurfaceOpen={(nextSurface) => {
            openSurface(
              nextSurface,
              document.activeElement instanceof HTMLElement ? document.activeElement : null,
            );
          }}
          onSubmit={() => {
            void handleSubmit();
          }}
          onInterrupt={() => {
            void handleInterrupt();
          }}
        />
      </section>

      {activeOverlay === "status" && snapshot ? (
        <SurfaceDialog
          ref={overlayPanelRef}
          title="Status"
          subtitle={buildStatusLine(snapshot)}
          footer="Esc closes this overlay."
          onClose={() => closeSurface()}
        >
          <div className="picker-scroll">
            <pre className="status-pre">
{`bridge: ${snapshot.phase}
connection: ${connectionState}
active thread: ${activeThreadSummary?.title ?? "none"}
model: ${currentModel?.displayName ?? currentModel?.model ?? "default"}
reasoning: ${currentEffort ?? "default"}
plan mode: ${selectedPlanMode ? "on" : "off"}
pending requests: ${snapshot.pendingRequests.length}
runtime: ${runtime}
last error: ${snapshot.lastError ?? "none"}`}
            </pre>
          </div>
        </SurfaceDialog>
      ) : null}

      {activeOverlay === "shortcuts" ? (
        <SurfaceDialog
          ref={overlayPanelRef}
          title="Shortcuts"
          subtitle="Keyboard help that matches the current browser behavior."
          footer="Browser-reserved shortcuts keep visible fallback controls in the shell."
          onClose={() => closeSurface()}
        >
          <div className="picker-scroll">
            <pre className="status-pre">
{`Enter            send current turn
Shift + Enter    insert newline
Esc              close overlays / interrupt / hide slash suggestions
?                open shortcut panel
/                trigger slash command suggestions`}
            </pre>
          </div>
        </SurfaceDialog>
      ) : null}

      {pendingRequest ? (
        <ApprovalDialog
          ref={approvalDialogRef}
          title={approvalTitle}
          intro={approvalIntro}
          reason={approvalReason}
          detail={approvalDetail}
          options={approvalOptions}
          selectedOptionIndex={selectedApprovalIndex}
          questions={approvalQuestionModels}
          submitLabel={
            approvalQuestionModels.length > 0 ? "Submit answers" : null
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
                  : "Invalid JSON for server request response.",
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
