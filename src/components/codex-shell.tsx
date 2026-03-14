"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { CommandExecutionApprovalDecision } from "@/generated/codex-app-server/v2/CommandExecutionApprovalDecision";
import type { ToolRequestUserInputQuestion } from "@/generated/codex-app-server/v2/ToolRequestUserInputQuestion";
import type {
  BridgeSnapshot,
  PendingServerRequest,
  SlashCommandDefinition,
} from "@/lib/shared";
import { BUILTIN_COMMANDS } from "@/lib/shared";

type OverlayState =
  | { kind: null }
  | { kind: "resume" }
  | { kind: "models" }
  | { kind: "transcript" }
  | { kind: "status" }
  | { kind: "shortcuts" };

type ResumeSort = "created" | "updated";

function formatRelativeTime(unixSeconds: number): string {
  const delta = Date.now() - unixSeconds * 1000;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < minute) {
    return "just now";
  }
  if (delta < hour) {
    return `${Math.floor(delta / minute)}m ago`;
  }
  if (delta < day) {
    return `${Math.floor(delta / hour)}h ago`;
  }
  return `${Math.floor(delta / day)}d ago`;
}

function formatClock(updatedAt: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(updatedAt));
}

function formatRuntime(startedAt: number | null): string {
  if (!startedAt) {
    return "0s";
  }

  return `${Math.max(0, Math.floor((Date.now() - startedAt) / 1000))}s`;
}

function formatThreadLabel(
  thread: NonNullable<BridgeSnapshot["threads"]>[number],
): string {
  return thread.name || thread.preview || thread.cwd || thread.id;
}

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

function buildDefaultServerResponse(request: PendingServerRequest): string {
  const params =
    typeof request.params === "object" && request.params !== null
      ? (request.params as Record<string, unknown>)
      : {};

  switch (request.method) {
    case "item/commandExecution/requestApproval":
      return JSON.stringify(
        {
          decision: "accept",
        },
        null,
        2,
      );
    case "item/fileChange/requestApproval":
      return JSON.stringify(
        {
          decision: "accept",
        },
        null,
        2,
      );
    case "item/permissions/requestApproval":
      return JSON.stringify(
        {
          permissions: params.permissions ?? {},
          scope: "turn",
        },
        null,
        2,
      );
    case "item/tool/requestUserInput":
      return JSON.stringify(
        {
          answers: {},
        },
        null,
        2,
      );
    case "mcpServer/elicitation/request":
      return JSON.stringify(
        {
          action: "cancel",
          content: null,
          _meta: null,
        },
        null,
        2,
      );
    default:
      return JSON.stringify({}, null, 2);
  }
}

function summarizeDecision(decision: CommandExecutionApprovalDecision): string {
  if (typeof decision === "string") {
    return decision;
  }

  if ("acceptWithExecpolicyAmendment" in decision) {
    return "acceptWithExecpolicyAmendment";
  }

  return "applyNetworkPolicyAmendment";
}

function approvalDecisionLabel(
  decision: CommandExecutionApprovalDecision,
  commandText: string | null,
): string {
  if (typeof decision === "string") {
    switch (decision) {
      case "accept":
        return "Yes, proceed (y)";
      case "acceptForSession":
        return "Yes, proceed for this session";
      case "decline":
        return "No, and tell Codex what to do differently (esc)";
      case "cancel":
        return "Cancel";
    }
  }

  if ("acceptWithExecpolicyAmendment" in decision) {
    return `Yes, and don't ask again for commands that start with \`${commandText ?? ""}\` (p)`;
  }

  return "Allow the proposed network rule";
}

function fileApprovalDecisionLabel(decision: string): string {
  switch (decision) {
    case "accept":
      return "Yes, make the edits";
    case "acceptForSession":
      return "Yes, allow edits for this session";
    case "decline":
      return "No, and tell Codex what to do differently";
    case "cancel":
      return "Cancel";
    default:
      return decision;
  }
}

function filterCommands(input: string): SlashCommandDefinition[] {
  const query = input.replace(/^\//, "").trim().toLowerCase();
  if (!query) {
    return BUILTIN_COMMANDS;
  }

  return BUILTIN_COMMANDS.filter((command) =>
    `${command.name} ${command.description}`.toLowerCase().includes(query),
  );
}

function getCurrentModel(snapshot: BridgeSnapshot | null) {
  if (!snapshot) {
    return null;
  }

  return (
    snapshot.models.find((model) => model.model === snapshot.sessionSettings.model) ??
    snapshot.models.find((model) => model.isDefault) ??
    snapshot.models[0] ??
    null
  );
}

function getCurrentEffort(snapshot: BridgeSnapshot | null): string | null {
  const currentModel = getCurrentModel(snapshot);
  return (
    snapshot?.sessionSettings.effort ??
    currentModel?.defaultReasoningEffort ??
    null
  );
}

function buildStatusLine(snapshot: BridgeSnapshot | null): string {
  if (!snapshot) {
    return "starting";
  }

  const currentModel = getCurrentModel(snapshot);
  const effort = getCurrentEffort(snapshot);

  return [
    currentModel?.displayName ?? currentModel?.model ?? "default",
    effort,
    snapshot.phase,
    `${snapshot.threads.length} sessions`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function historyCellText(
  entry: NonNullable<BridgeSnapshot["timelineByThread"][string]>[number],
): string {
  return entry.body ? `${entry.title}\n${entry.body}` : entry.title;
}

function overlayBanner(title: string): string {
  return `/ ${title.toUpperCase()} / / / / / / / / /`;
}

export function CodexShell() {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ kind: null });
  const [composer, setComposer] = useState("");
  const [resumeSearch, setResumeSearch] = useState("");
  const [resumeSort, setResumeSort] = useState<ResumeSort>("created");
  const [selectedResumeIndex, setSelectedResumeIndex] = useState(0);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [requestDrafts, setRequestDrafts] = useState<Record<string, string>>({});
  const [requestAnswers, setRequestAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const deferredResumeSearch = useDeferredValue(resumeSearch);
  const [, setClockTick] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    void callApi<{ snapshot: BridgeSnapshot }>("/api/bootstrap")
      .then((payload) => {
        if (!mounted) {
          return;
        }
        startTransition(() => {
          setSnapshot(payload.snapshot);
        });
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setToast(error instanceof Error ? error.message : "Failed to load bootstrap.");
      });

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const websocket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    websocket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        type: "snapshot";
        snapshot: BridgeSnapshot;
      };
      startTransition(() => {
        setSnapshot(payload.snapshot);
      });
    };

    websocket.onerror = () => {
      setToast("WebSocket connection to the local bridge failed.");
    };

    return () => {
      mounted = false;
      websocket.close();
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

    return (
      snapshot.threads.find((thread) => thread.id === snapshot.activeThreadId) ?? null
    );
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

    const query = deferredResumeSearch.trim().toLowerCase();
    const threads = snapshot.threads.filter((thread) =>
      `${thread.name ?? ""} ${thread.preview} ${thread.cwd}`.toLowerCase().includes(query),
    );

    return [...threads].sort((left, right) => {
      const leftValue = resumeSort === "created" ? left.createdAt : left.updatedAt;
      const rightValue = resumeSort === "created" ? right.createdAt : right.updatedAt;
      return rightValue - leftValue;
    });
  }, [deferredResumeSearch, resumeSort, snapshot]);

  useEffect(() => {
    setSelectedResumeIndex((current) => {
      if (filteredThreads.length === 0) {
        return 0;
      }
      return Math.min(current, filteredThreads.length - 1);
    });
  }, [filteredThreads]);

  useEffect(() => {
    if (overlay.kind === "resume") {
      setSelectedResumeIndex(0);
    }
  }, [deferredResumeSearch, overlay.kind, resumeSort]);

  const selectedResumeThread =
    filteredThreads.length > 0 ? filteredThreads[selectedResumeIndex] ?? filteredThreads[0] : null;

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

  const visibleCommands = composer.trimStart().startsWith("/")
    ? filterCommands(composer.trimStart())
    : [];

  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [composer]);

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

  async function handleCreateThread(closeOverlay = false) {
    await syncSnapshotFromResult(
      () => callApi("/api/thread/start", {}),
      "Starting thread",
    );
    if (closeOverlay) {
      setOverlay({ kind: null });
    }
  }

  async function handleSubmit() {
    const value = composer.trim();
    if (!value) {
      return;
    }

    if (value.startsWith("/")) {
      await handleSlashCommand(value);
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
        setComposer("");
        break;
      case "resume":
        setOverlay({ kind: "resume" });
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
        setComposer("");
        break;
      case "model":
        setOverlay({ kind: "models" });
        break;
      case "review":
        await syncSnapshotFromResult(
          () => callApi("/api/review/start", {}),
          "Starting review",
        );
        setComposer("");
        break;
      case "status":
        setOverlay({ kind: "status" });
        break;
    }
  }

  async function handleResumeThread(threadId: string) {
    await syncSnapshotFromResult(
      () => callApi("/api/thread/resume", { threadId }),
      "Resuming thread",
    );
    setOverlay({ kind: null });
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
    setOverlay({ kind: null });
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;

      if (overlay.kind === "resume") {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedResumeIndex((current) =>
            Math.min(current + 1, Math.max(filteredThreads.length - 1, 0)),
          );
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedResumeIndex((current) => Math.max(current - 1, 0));
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          setResumeSort((current) => (current === "created" ? "updated" : "created"));
          return;
        }

        if (event.key === "Enter" && selectedResumeThread) {
          event.preventDefault();
          void handleResumeThread(selectedResumeThread.id);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          void handleCreateThread(true);
          return;
        }
      }

      if (
        overlay.kind === "transcript" &&
        (event.key === "Escape" || event.key.toLowerCase() === "q")
      ) {
        event.preventDefault();
        setOverlay({ kind: null });
        return;
      }

      if (overlay.kind !== null && event.key === "Escape") {
        event.preventDefault();
        setOverlay({ kind: null });
        return;
      }

      if (isMeta && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setOverlay({ kind: "transcript" });
        return;
      }

      if (event.key === "?" && document.activeElement !== composerRef.current) {
        event.preventDefault();
        setOverlay({ kind: "shortcuts" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filteredThreads.length, overlay.kind, selectedResumeThread]);

  const currentModel = getCurrentModel(snapshot);
  const currentEffort = getCurrentEffort(snapshot);
  const currentCliVersion = activeThread?.cliVersion ?? snapshot?.threads[0]?.cliVersion ?? null;
  const headerDirectory =
    activeThread?.cwd ?? snapshot?.threads[0]?.cwd ?? "new thread on first send";
  const footerInstruction = visibleCommands.length
    ? "↑/↓ to navigate · tab to complete"
    : composer.trim()
      ? "enter to send · shift+enter for newline"
      : "? for shortcuts";
  const statusLine = buildStatusLine(snapshot);
  const runtime = snapshot?.activeTurnId
    ? formatRuntime(snapshot.activeTurnStartedAt ?? null)
    : "idle";
  const currentCommandText =
    typeof (pendingRequest?.params as { command?: string } | undefined)?.command === "string"
      ? ((pendingRequest?.params as { command?: string }).command ?? null)
      : null;

  return (
    <main className="tui-page">
      <section className="tui-shell">
        <header className="session-box">
          <div className="session-box-title">
            <span>
              &gt;_ OpenAI Codex
              {currentCliVersion ? ` (v${currentCliVersion})` : ""}
            </span>
            <span className={`session-phase phase-${snapshot?.phase ?? "starting"}`}>
              {snapshot?.phase ?? "starting"}
            </span>
          </div>

          <div className="session-box-line">
            <span className="session-box-key">model:</span>
            <span className="session-box-value">
              {currentModel?.displayName ?? currentModel?.model ?? "default"}
              {currentEffort ? ` ${currentEffort}` : ""}
            </span>
            <button className="inline-command" onClick={() => setOverlay({ kind: "models" })}>
              /model to change
            </button>
          </div>

          <div className="session-box-line">
            <span className="session-box-key">directory:</span>
            <span className="session-box-value session-box-truncate">{headerDirectory}</span>
            <button className="inline-command" onClick={() => setOverlay({ kind: "resume" })}>
              /resume to browse
            </button>
          </div>

          <div className="session-box-line">
            <span className="session-box-key">thread:</span>
            <span className="session-box-value session-box-truncate">
              {activeThread ? formatThreadLabel(activeThread) : "new session on first send"}
            </span>
            <span className="session-box-actions">
              <button
                className="inline-command"
                onClick={() => setOverlay({ kind: "transcript" })}
              >
                /transcript
              </button>
              <button className="inline-command" onClick={() => setOverlay({ kind: "status" })}>
                /status
              </button>
            </span>
          </div>
        </header>

        <section className="transcript-surface">
          <div className="transcript-scroll">
            {activeTimeline.length === 0 ? (
              <div className="history-empty">
                <pre>
                  {activeThread
                    ? "No transcript yet.\n\nSend the first turn to begin."
                    : "No active session.\n\nType a message or use /resume."}
                </pre>
              </div>
            ) : (
              activeTimeline.map((entry) => (
                <article key={entry.id} className={`history-cell tone-${entry.tone}`}>
                  <div className="history-meta">
                    <span>{entry.kind}</span>
                    <span>{formatClock(entry.updatedAt)}</span>
                  </div>
                  <pre className="history-body">{historyCellText(entry)}</pre>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="bottom-dock">
          {(snapshot?.activeTurnId || pendingRequest) && (
            <div className="status-widget">
              <div className="status-widget-line">
                <span className={`status-dot ${snapshot?.activeTurnId ? "is-live" : ""}`}>•</span>
                <span>
                  {snapshot?.activeTurnId
                    ? `Working (${runtime} • esc to interrupt)`
                    : pendingRequest?.summary ?? busyAction ?? "Working"}
                </span>
              </div>
              {pendingRequest ? (
                <div className="status-widget-detail">
                  <span>↳ {pendingRequest.summary}</span>
                </div>
              ) : null}
            </div>
          )}

          {visibleCommands.length > 0 ? (
            <div className="popup-list" role="listbox" aria-label="Slash commands">
              {visibleCommands.map((command, index) => (
                <button
                  key={command.name}
                  className={`popup-row ${index === selectedCommandIndex ? "selected" : ""}`}
                  onClick={() => {
                    setComposer(`/${command.name}`);
                    composerRef.current?.focus();
                  }}
                >
                  <span className="popup-marker">{index === selectedCommandIndex ? "›" : " "}</span>
                  <span className="popup-main">/{command.name}</span>
                  <span className="popup-copy">{command.description}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="composer-frame">
            <textarea
              ref={composerRef}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && snapshot?.activeTurnId) {
                  event.preventDefault();
                  void handleInterrupt();
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
                }

                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Message Codex"
              className="composer-input"
            />
          </div>

          <div className="footer-row">
            <span>{footerInstruction}</span>
            <span>{statusLine}</span>
          </div>

          <div className="footer-row muted">
            <span>{snapshot?.activeTurnId ? "esc to interrupt" : "shift+enter for newline"}</span>
            <span className="footer-actions">
              <button className="inline-command" onClick={() => setOverlay({ kind: "shortcuts" })}>
                shortcuts
              </button>
              <button
                className="inline-command"
                onClick={() => setOverlay({ kind: "transcript" })}
              >
                transcript
              </button>
            </span>
          </div>
        </section>
      </section>

      {overlay.kind === "resume" && snapshot ? (
        <div className="screen-overlay" onClick={() => setOverlay({ kind: null })}>
          <section className="screen-panel" onClick={(event) => event.stopPropagation()}>
            <div className="screen-header">
              <span>Resume a previous session</span>
              <span>Sort: {resumeSort === "created" ? "Created at" : "Updated at"}</span>
            </div>

            <div className="screen-label">Type to search</div>
            <input
              value={resumeSearch}
              onChange={(event) => setResumeSearch(event.target.value)}
              placeholder="Type to search"
              className="screen-search"
              autoFocus
            />

            <div className="resume-table">
              <div className="resume-table-head">
                <span />
                <span>Created at</span>
                <span>Updated at</span>
                <span>Branch</span>
                <span>CWD</span>
                <span>Conversation</span>
              </div>

              {filteredThreads.length === 0 ? (
                <div className="resume-empty">No sessions yet</div>
              ) : (
                filteredThreads.map((thread, index) => (
                  <button
                    key={thread.id}
                    className={`resume-table-row ${
                      selectedResumeThread?.id === thread.id ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedResumeIndex(index);
                      void handleResumeThread(thread.id);
                    }}
                  >
                    <span className="resume-marker">
                      {selectedResumeThread?.id === thread.id ? "›" : " "}
                    </span>
                    <span>{formatRelativeTime(thread.createdAt)}</span>
                    <span>{formatRelativeTime(thread.updatedAt)}</span>
                    <span>{thread.gitInfo?.branch ?? "-"}</span>
                    <span>{thread.cwd || "-"}</span>
                    <span className="resume-conversation">{formatThreadLabel(thread)}</span>
                  </button>
                ))
              )}
            </div>

            <div className="screen-footer">
              enter to resume&nbsp;&nbsp;&nbsp;&nbsp;esc to start new&nbsp;&nbsp;&nbsp;&nbsp;
              ctrl + c to quit&nbsp;&nbsp;&nbsp;&nbsp;tab to toggle sort
            </div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "models" && snapshot ? (
        <div className="screen-overlay" onClick={() => setOverlay({ kind: null })}>
          <section className="picker-panel" onClick={(event) => event.stopPropagation()}>
            <div className="picker-header">{overlayBanner("Model")}</div>
            <div className="picker-list">
              {snapshot.models.map((model) => {
                const isCurrent = snapshot.sessionSettings.model === model.model;
                return (
                  <div key={model.id} className={`picker-item ${isCurrent ? "selected" : ""}`}>
                    <button
                      className="picker-main"
                      onClick={() => {
                        void handleModelChange(model.model, model.defaultReasoningEffort);
                      }}
                    >
                      <span>{isCurrent ? "›" : " "}</span>
                      <span>{model.displayName}</span>
                      {model.isDefault ? <span className="picker-tag">default</span> : null}
                    </button>
                    <p>{model.description}</p>
                    <div className="picker-inline-options">
                      {model.supportedReasoningEfforts.map((effort) => (
                        <button
                          key={`${model.id}:${effort.reasoningEffort}`}
                          className={`picker-chip ${
                            snapshot.sessionSettings.model === model.model &&
                            snapshot.sessionSettings.effort === effort.reasoningEffort
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => {
                            void handleModelChange(model.model, effort.reasoningEffort);
                          }}
                        >
                          {effort.reasoningEffort}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="screen-footer">click a reasoning level to apply or esc to cancel</div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "transcript" && snapshot ? (
        <div className="screen-overlay" onClick={() => setOverlay({ kind: null })}>
          <section className="screen-panel transcript-panel" onClick={(event) => event.stopPropagation()}>
            <div className="picker-header">{overlayBanner("Transcript")}</div>
            <div className="transcript-overlay-subtitle">
              {activeThread ? formatThreadLabel(activeThread) : "No active thread"}
            </div>
            <div className="overlay-scroll">
              {activeTimeline.map((entry) => (
                <article key={entry.id} className="overlay-history-cell">
                  <div className="history-meta">
                    <span>{entry.kind}</span>
                    <span>{formatClock(entry.updatedAt)}</span>
                  </div>
                  <pre className="history-body">{historyCellText(entry)}</pre>
                </article>
              ))}
            </div>
            <div className="screen-footer">
              ↑/↓ to scroll&nbsp;&nbsp;&nbsp;pgup/pgdn to page&nbsp;&nbsp;&nbsp;q to quit
              &nbsp;&nbsp;&nbsp;esc to edit prev
            </div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "status" && snapshot ? (
        <div className="screen-overlay" onClick={() => setOverlay({ kind: null })}>
          <section className="picker-panel" onClick={(event) => event.stopPropagation()}>
            <div className="picker-header">{overlayBanner("Status")}</div>
            <pre className="status-pre">
{`bridge: ${snapshot.phase}
active thread: ${activeThread ? formatThreadLabel(activeThread) : "none"}
model: ${currentModel?.displayName ?? currentModel?.model ?? "default"}
reasoning: ${currentEffort ?? "default"}
pending requests: ${snapshot.pendingRequests.length}
runtime: ${runtime}

logs:
${snapshot.bridgeLogs.join("\n") || "No bridge logs yet."}`}
            </pre>
            <div className="screen-footer">esc to close</div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "shortcuts" ? (
        <div className="screen-overlay" onClick={() => setOverlay({ kind: null })}>
          <section className="picker-panel" onClick={(event) => event.stopPropagation()}>
            <div className="picker-header">{overlayBanner("Shortcuts")}</div>
            <pre className="status-pre">
{`Enter            send current turn
Shift + Enter    insert newline
Esc              close overlays / interrupt active turn
?                open shortcut panel
Ctrl/Cmd + T     open transcript overlay (browser may reserve this)
/                trigger slash command popup`}
            </pre>
            <div className="screen-footer">
              Browser-reserved keys keep visible fallback controls in the shell
            </div>
          </section>
        </div>
      ) : null}

      {pendingRequest ? (
        <div className="screen-overlay modal-overlay">
          <section className="approval-modal">
            {pendingRequest.method === "item/commandExecution/requestApproval" ? (
              <>
                <div className="approval-copy">
                  <p>Would you like to run the following command?</p>
                  {typeof (pendingRequest.params as { reason?: string | null })?.reason ===
                  "string" ? (
                    <p>
                      Reason:{" "}
                      {(pendingRequest.params as { reason?: string | null }).reason}
                    </p>
                  ) : null}
                  <pre className="approval-command">{currentCommandText ? `$ ${currentCommandText}` : pendingRequest.detail}</pre>
                </div>
                <div className="approval-options">
                  {(
                    ((pendingRequest.params as {
                      availableDecisions?: CommandExecutionApprovalDecision[];
                    })?.availableDecisions as CommandExecutionApprovalDecision[] | undefined) ?? [
                      "accept",
                      "decline",
                      "cancel",
                    ]
                  ).map((decision, index) => (
                    <button
                      key={summarizeDecision(decision)}
                      className={`approval-option ${index === 0 ? "selected" : ""}`}
                      onClick={() => {
                        void handleServerRequestResponse(pendingRequest.id, {
                          decision,
                        });
                      }}
                    >
                      <span>{index === 0 ? "›" : " "}</span>
                      <span>{index + 1}.</span>
                      <span>{approvalDecisionLabel(decision, currentCommandText)}</span>
                    </button>
                  ))}
                </div>
                <div className="screen-footer">Press enter to confirm or esc to cancel</div>
              </>
            ) : null}

            {pendingRequest.method === "item/fileChange/requestApproval" ? (
              <>
                <div className="approval-copy">
                  <p>Would you like to make the following edits?</p>
                  <pre className="approval-command">{pendingRequest.detail}</pre>
                </div>
                <div className="approval-options">
                  {["accept", "acceptForSession", "decline", "cancel"].map((decision, index) => (
                    <button
                      key={decision}
                      className={`approval-option ${index === 0 ? "selected" : ""}`}
                      onClick={() => {
                        void handleServerRequestResponse(pendingRequest.id, {
                          decision,
                        });
                      }}
                    >
                      <span>{index === 0 ? "›" : " "}</span>
                      <span>{index + 1}.</span>
                      <span>{fileApprovalDecisionLabel(decision)}</span>
                    </button>
                  ))}
                </div>
                <div className="screen-footer">Press enter to confirm or esc to cancel</div>
              </>
            ) : null}

            {pendingRequest.method === "item/permissions/requestApproval" ? (
              <>
                <div className="approval-copy">
                  <p>Update Model Permissions</p>
                  <pre className="approval-command">{pendingRequest.detail}</pre>
                </div>
                <div className="approval-options">
                  {[
                    { label: "Default", scope: "turn" },
                    { label: "Full Access", scope: "session" },
                  ].map((option, index) => (
                    <button
                      key={option.label}
                      className={`approval-option ${index === 0 ? "selected" : ""}`}
                      onClick={() => {
                        const params =
                          (pendingRequest.params as { permissions?: unknown }) ?? {};
                        void handleServerRequestResponse(pendingRequest.id, {
                          permissions: params.permissions ?? {},
                          scope: option.scope,
                        });
                      }}
                    >
                      <span>{index === 0 ? "›" : " "}</span>
                      <span>{index + 1}.</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
                <div className="screen-footer">Press enter to confirm or esc to go back</div>
              </>
            ) : null}

            {pendingRequest.method === "item/tool/requestUserInput" ? (
              <>
                <div className="approval-copy">
                  <p>{pendingRequest.summary}</p>
                </div>
                <div className="question-stack">
                  {(
                    ((pendingRequest.params as { questions?: ToolRequestUserInputQuestion[] })
                      ?.questions as ToolRequestUserInputQuestion[] | undefined) ?? []
                  ).map((question) => (
                    <div key={question.id} className="plain-question">
                      <strong>{question.header}</strong>
                      <div>{question.question}</div>
                      {question.options?.length ? (
                        <div className="picker-inline-options">
                          {question.options.map((option) => (
                            <button
                              key={option.label}
                              className={`picker-chip ${
                                requestAnswers[pendingRequest.id]?.[question.id] === option.label
                                  ? "selected"
                                  : ""
                              }`}
                              onClick={() => {
                                setRequestAnswers((current) => ({
                                  ...current,
                                  [pendingRequest.id]: {
                                    ...current[pendingRequest.id],
                                    [question.id]: option.label,
                                  },
                                }));
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {question.isOther ? (
                        <input
                          className="screen-search"
                          value={requestAnswers[pendingRequest.id]?.[question.id] ?? ""}
                          onChange={(event) => {
                            setRequestAnswers((current) => ({
                              ...current,
                              [pendingRequest.id]: {
                                ...current[pendingRequest.id],
                                [question.id]: event.target.value,
                              },
                            }));
                          }}
                          placeholder="Type an answer"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="approval-actions">
                  <button
                    className="plain-action"
                    onClick={() => {
                      const questions =
                        ((pendingRequest.params as { questions?: ToolRequestUserInputQuestion[] })
                          ?.questions as ToolRequestUserInputQuestion[] | undefined) ?? [];
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
                    }}
                  >
                    submit answers
                  </button>
                </div>
              </>
            ) : null}

            {![
              "item/commandExecution/requestApproval",
              "item/fileChange/requestApproval",
              "item/permissions/requestApproval",
              "item/tool/requestUserInput",
            ].includes(pendingRequest.method) ? (
              <>
                <div className="approval-copy">
                  <p>{pendingRequest.summary}</p>
                  <pre className="approval-command">{pendingRequest.detail}</pre>
                </div>
              </>
            ) : null}

            <details className="advanced-json">
              <summary>Advanced response JSON</summary>
              <textarea
                className="raw-json-editor"
                value={requestDrafts[pendingRequest.id] ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setRequestDrafts((current) => ({
                    ...current,
                    [pendingRequest.id]: nextValue,
                  }));
                }}
              />
              <button
                className="plain-action"
                onClick={() => {
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
              >
                send JSON response
              </button>
            </details>
          </section>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
