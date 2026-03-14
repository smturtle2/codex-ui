"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from "react";

import type { CommandExecutionApprovalDecision } from "@/generated/codex-app-server/v2/CommandExecutionApprovalDecision";
import type { ToolRequestUserInputQuestion } from "@/generated/codex-app-server/v2/ToolRequestUserInputQuestion";
import type { BridgeSnapshot, PendingServerRequest, SlashCommandDefinition } from "@/lib/shared";
import { BUILTIN_COMMANDS } from "@/lib/shared";

type OverlayState =
  | { kind: null }
  | { kind: "resume" }
  | { kind: "models" }
  | { kind: "transcript" }
  | { kind: "status" }
  | { kind: "shortcuts" };

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

function filterCommands(input: string): SlashCommandDefinition[] {
  const query = input.replace(/^\//, "").trim().toLowerCase();
  if (!query) {
    return BUILTIN_COMMANDS;
  }

  return BUILTIN_COMMANDS.filter((command) =>
    `${command.name} ${command.description}`.toLowerCase().includes(query),
  );
}

export function CodexShell() {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ kind: null });
  const [composer, setComposer] = useState("");
  const [resumeSearch, setResumeSearch] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [requestDrafts, setRequestDrafts] = useState<Record<string, string>>({});
  const [requestAnswers, setRequestAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const deferredResumeSearch = useDeferredValue(resumeSearch);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClock(Date.now());
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
    wsRef.current = websocket;

    websocket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { type: "snapshot"; snapshot: BridgeSnapshot };
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;

      if (isMeta && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setOverlay({ kind: "transcript" });
        return;
      }

      if (event.key === "?" && document.activeElement !== composerRef.current) {
        event.preventDefault();
        setOverlay({ kind: "shortcuts" });
        return;
      }

      if (event.key === "Escape") {
        if (overlay.kind !== null) {
          setOverlay({ kind: null });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [overlay.kind]);

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
    if (!query) {
      return snapshot.threads;
    }

    return snapshot.threads.filter((thread) =>
      `${thread.name ?? ""} ${thread.preview} ${thread.cwd}`.toLowerCase().includes(query),
    );
  }, [deferredResumeSearch, snapshot]);

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
        await syncSnapshotFromResult(
          () => callApi("/api/thread/start", {}),
          "Starting thread",
        );
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

  async function handleServerRequestResponse(
    requestId: string,
    result: unknown,
  ) {
    await syncSnapshotFromResult(
      () =>
        callApi("/api/server-request/respond", {
          requestId,
          result,
        }),
      "Responding to server request",
    );
  }

  const runtime =
    snapshot && snapshot.activeTurnId
      ? formatRuntime(snapshot.activeTurnStartedAt ?? null)
      : "idle";

  return (
    <main className="shell-page">
      <div className="shell-backdrop" />
      <div className="shell-noise" />

      <section className="shell-frame">
        <header className="shell-topbar">
          <div className="topbar-brand">
            <div className="brand-kicker">terminal-faithful bridge</div>
            <div className="brand-row">
              <h1>Codex WebUI</h1>
              <span className={`bridge-pill phase-${snapshot?.phase ?? "starting"}`}>
                {snapshot?.phase ?? "starting"}
              </span>
            </div>
            <p>
              {activeThread
                ? `${formatThreadLabel(activeThread)} · ${activeThread.cwd}`
                : "No active thread. Start fresh or resume a session."}
            </p>
          </div>

          <div className="topbar-actions">
            <button
              className="ghost-button"
              onClick={() => {
                void syncSnapshotFromResult(
                  () => callApi("/api/thread/start", {}),
                  "Starting thread",
                );
              }}
            >
              New
            </button>
            <button className="ghost-button" onClick={() => setOverlay({ kind: "resume" })}>
              Resume
            </button>
            <button
              className="ghost-button"
              onClick={() => setOverlay({ kind: "models" })}
            >
              Model
            </button>
            <button
              className="ghost-button"
              onClick={() => setOverlay({ kind: "transcript" })}
            >
              Transcript
            </button>
            <button
              className="ghost-button"
              disabled={!snapshot?.activeThreadId}
              onClick={() => {
                void syncSnapshotFromResult(
                  () =>
                    callApi("/api/thread/fork", {
                      threadId: snapshot?.activeThreadId,
                    }),
                  "Forking thread",
                );
              }}
            >
              Fork
            </button>
          </div>
        </header>

        <section className="shell-statusband">
          <div className="statusband-left">
            <span className="status-label">active thread</span>
            <strong>{activeThread ? formatThreadLabel(activeThread) : "none"}</strong>
          </div>
          <div className="statusband-center">
            <span className="status-label">session model</span>
            <strong>{snapshot?.sessionSettings.model ?? "default"}</strong>
          </div>
          <div className="statusband-right">
            <span className="status-label">runtime</span>
            <strong>{runtime}</strong>
          </div>
        </section>

        <section className="shell-main">
          {activeThread ? (
            <div className="timeline-panel">
              <div className="timeline-header">
                <div>
                  <span className="section-eyebrow">thread</span>
                  <h2>{formatThreadLabel(activeThread)}</h2>
                </div>
                <div className="timeline-meta">
                  <span>{formatRelativeTime(activeThread.updatedAt)}</span>
                  <span>{activeThread.status.type}</span>
                </div>
              </div>

              <div className="timeline-scroll">
                {activeTimeline.length === 0 ? (
                  <div className="empty-state">
                    <p>No transcript yet.</p>
                    <span>The bridge is attached. Send the first turn to begin streaming.</span>
                  </div>
                ) : (
                  activeTimeline.map((entry) => (
                    <article
                      key={entry.id}
                      className={`timeline-entry tone-${entry.tone} status-${entry.status}`}
                    >
                      <div className="timeline-entry-head">
                        <span className="entry-kind">{entry.kind}</span>
                        <strong>{entry.title}</strong>
                        <span>{new Date(entry.updatedAt).toLocaleTimeString()}</span>
                      </div>
                      {entry.body ? (
                        <pre className="timeline-entry-body">{entry.body}</pre>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="landing-panel">
              <div className="landing-copy">
                <span className="section-eyebrow">local shell</span>
                <h2>Mirror the Codex TUI in a browser without losing workflow state.</h2>
                <p>
                  This build keeps the app-server live over stdio, surfaces thread and turn
                  primitives directly, and preserves approvals and transcript overlays as
                  first-class UI surfaces instead of hiding them behind a generic chat skin.
                </p>
              </div>
              <div className="landing-actions">
                <button
                  className="primary-button"
                  onClick={() => {
                    void syncSnapshotFromResult(
                      () => callApi("/api/thread/start", {}),
                      "Starting thread",
                    );
                  }}
                >
                  Start a new thread
                </button>
                <button
                  className="ghost-button"
                  onClick={() => setOverlay({ kind: "resume" })}
                >
                  Resume a saved session
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="bottom-pane">
          <div className="bottom-pane-utility">
            <div className="utility-left">
              {snapshot?.activeTurnId ? (
                <span className="runtime-indicator">
                  <span className="runtime-dot" />
                  Working ({formatRuntime(snapshot.activeTurnStartedAt)} · esc to interrupt)
                </span>
              ) : (
                <span className="runtime-indicator muted">Bridge ready for new input.</span>
              )}
            </div>
            <div className="utility-right">
              {snapshot?.pendingRequests.length ? (
                <span className="pending-badge">
                  {snapshot.pendingRequests.length} pending request
                  {snapshot.pendingRequests.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="composer-shell">
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
              placeholder="Ask Codex to do anything"
              className="composer-textarea"
            />

            {visibleCommands.length > 0 ? (
              <div className="command-popup">
                <div className="popup-title">Slash commands</div>
                {visibleCommands.map((command, index) => (
                  <button
                    key={command.name}
                    className={`command-option ${index === selectedCommandIndex ? "selected" : ""}`}
                    onClick={() => {
                      setComposer(`/${command.name}`);
                    }}
                  >
                    <strong>/{command.name}</strong>
                    <span>{command.description}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="bottom-footer">
            <span>? for shortcuts</span>
            <span>{busyAction ?? "local app-server stream live"}</span>
          </div>
        </section>
      </section>

      {overlay.kind === "resume" && snapshot ? (
        <div className="overlay-backdrop" onClick={() => setOverlay({ kind: null })}>
          <section className="overlay-panel overlay-wide" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-head">
              <div>
                <span className="section-eyebrow">resume picker</span>
                <h3>Resume a previous session</h3>
              </div>
              <button className="ghost-button" onClick={() => setOverlay({ kind: null })}>
                Close
              </button>
            </div>

            <input
              value={resumeSearch}
              onChange={(event) => setResumeSearch(event.target.value)}
              placeholder="Filter by name, preview, or cwd"
              className="overlay-search"
            />

            <div className="resume-table">
              <div className="resume-head">
                <span>Updated</span>
                <span>Status</span>
                <span>CWD</span>
                <span>Conversation</span>
              </div>
              {filteredThreads.length === 0 ? (
                <div className="empty-table">No sessions match this search.</div>
              ) : (
                filteredThreads.map((thread) => (
                  <button
                    key={thread.id}
                    className={`resume-row ${thread.id === snapshot.activeThreadId ? "active" : ""}`}
                    onClick={() => {
                      void handleResumeThread(thread.id);
                    }}
                  >
                    <span>{formatRelativeTime(thread.updatedAt)}</span>
                    <span>{thread.status.type}</span>
                    <span>{thread.cwd || "-"}</span>
                    <span>{formatThreadLabel(thread)}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "models" && snapshot ? (
        <div className="overlay-backdrop" onClick={() => setOverlay({ kind: null })}>
          <section className="overlay-panel overlay-wide" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-head">
              <div>
                <span className="section-eyebrow">model selection</span>
                <h3>Select model and effort</h3>
              </div>
              <button className="ghost-button" onClick={() => setOverlay({ kind: null })}>
                Close
              </button>
            </div>

            <div className="model-grid">
              {snapshot.models.map((model) => {
                const isCurrent = snapshot.sessionSettings.model === model.model;
                return (
                  <article
                    key={model.id}
                    className={`model-card ${isCurrent ? "current" : ""}`}
                  >
                    <div className="model-card-head">
                      <strong>{model.displayName}</strong>
                      {model.isDefault ? <span className="pill">default</span> : null}
                    </div>
                    <p>{model.description}</p>
                    <div className="effort-row">
                      {model.supportedReasoningEfforts.map((effort) => (
                        <button
                          key={`${model.id}:${effort.reasoningEffort}`}
                          className={`effort-chip ${
                            snapshot.sessionSettings.model === model.model &&
                            snapshot.sessionSettings.effort === effort.reasoningEffort
                              ? "active"
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
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "transcript" && snapshot ? (
        <div className="overlay-backdrop transcript-backdrop" onClick={() => setOverlay({ kind: null })}>
          <section className="transcript-overlay" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-head">
              <div>
                <span className="section-eyebrow">transcript</span>
                <h3>{activeThread ? formatThreadLabel(activeThread) : "No active thread"}</h3>
              </div>
              <button className="ghost-button" onClick={() => setOverlay({ kind: null })}>
                Close
              </button>
            </div>
            <div className="transcript-scroll">
              {activeTimeline.map((entry) => (
                <article key={entry.id} className="transcript-entry">
                  <div className="transcript-entry-head">
                    <span>{entry.kind}</span>
                    <strong>{entry.title}</strong>
                    <span>{new Date(entry.updatedAt).toLocaleTimeString()}</span>
                  </div>
                  <pre>{entry.body || "—"}</pre>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "status" && snapshot ? (
        <div className="overlay-backdrop" onClick={() => setOverlay({ kind: null })}>
          <section className="overlay-panel" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-head">
              <div>
                <span className="section-eyebrow">runtime status</span>
                <h3>Local bridge and app-server</h3>
              </div>
              <button className="ghost-button" onClick={() => setOverlay({ kind: null })}>
                Close
              </button>
            </div>

            <div className="status-grid">
              <div className="status-card">
                <span>Bridge phase</span>
                <strong>{snapshot.phase}</strong>
              </div>
              <div className="status-card">
                <span>Active thread</span>
                <strong>{activeThread ? formatThreadLabel(activeThread) : "none"}</strong>
              </div>
              <div className="status-card">
                <span>Session model</span>
                <strong>{snapshot.sessionSettings.model ?? "default"}</strong>
              </div>
              <div className="status-card">
                <span>Pending requests</span>
                <strong>{snapshot.pendingRequests.length}</strong>
              </div>
            </div>

            <div className="log-panel">
              <div className="log-panel-head">Bridge logs</div>
              <pre>{snapshot.bridgeLogs.join("\n") || "No bridge logs yet."}</pre>
            </div>
          </section>
        </div>
      ) : null}

      {overlay.kind === "shortcuts" ? (
        <div className="overlay-backdrop" onClick={() => setOverlay({ kind: null })}>
          <section className="overlay-panel" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-head">
              <div>
                <span className="section-eyebrow">shortcuts</span>
                <h3>Browser-friendly TUI bindings</h3>
              </div>
              <button className="ghost-button" onClick={() => setOverlay({ kind: null })}>
                Close
              </button>
            </div>
            <div className="shortcut-grid">
              <div>
                <strong>Enter</strong>
                <span>Send a turn</span>
              </div>
              <div>
                <strong>Shift + Enter</strong>
                <span>Insert a newline</span>
              </div>
              <div>
                <strong>Ctrl/Cmd + T</strong>
                <span>Open transcript overlay</span>
              </div>
              <div>
                <strong>?</strong>
                <span>Open this shortcut card</span>
              </div>
              <div>
                <strong>Esc</strong>
                <span>Close overlays or interrupt active turn</span>
              </div>
              <div>
                <strong>/</strong>
                <span>Trigger slash command suggestions in the composer</span>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {pendingRequest ? (
        <div className="overlay-backdrop approval-backdrop">
          <section className="approval-panel">
            <div className="overlay-head">
              <div>
                <span className="section-eyebrow">server request</span>
                <h3>{pendingRequest.summary}</h3>
              </div>
            </div>

            <pre className="approval-detail">{pendingRequest.detail}</pre>

            {pendingRequest.method === "item/commandExecution/requestApproval" ? (
              <div className="decision-row">
                {(
                  ((pendingRequest.params as { availableDecisions?: CommandExecutionApprovalDecision[] })
                    ?.availableDecisions as CommandExecutionApprovalDecision[] | undefined) ?? [
                    "accept",
                    "decline",
                    "cancel",
                  ]
                ).map((decision) => (
                  <button
                    key={summarizeDecision(decision)}
                    className="ghost-button"
                    onClick={() => {
                      void handleServerRequestResponse(pendingRequest.id, {
                        decision,
                      });
                    }}
                  >
                    {summarizeDecision(decision)}
                  </button>
                ))}
              </div>
            ) : null}

            {pendingRequest.method === "item/fileChange/requestApproval" ? (
              <div className="decision-row">
                {["accept", "acceptForSession", "decline", "cancel"].map((decision) => (
                  <button
                    key={decision}
                    className="ghost-button"
                    onClick={() => {
                      void handleServerRequestResponse(pendingRequest.id, {
                        decision,
                      });
                    }}
                  >
                    {decision}
                  </button>
                ))}
              </div>
            ) : null}

            {pendingRequest.method === "item/permissions/requestApproval" ? (
              <div className="decision-row">
                {["turn", "session"].map((scope) => (
                  <button
                    key={scope}
                    className="ghost-button"
                    onClick={() => {
                      const params =
                        (pendingRequest.params as { permissions?: unknown }) ?? {};
                      void handleServerRequestResponse(pendingRequest.id, {
                        permissions: params.permissions ?? {},
                        scope,
                      });
                    }}
                  >
                    allow for {scope}
                  </button>
                ))}
              </div>
            ) : null}

            {pendingRequest.method === "item/tool/requestUserInput" ? (
              <div className="question-stack">
                {(
                  ((pendingRequest.params as { questions?: ToolRequestUserInputQuestion[] })
                    ?.questions as ToolRequestUserInputQuestion[] | undefined) ?? []
                ).map((question) => (
                  <div key={question.id} className="question-card">
                    <strong>{question.header}</strong>
                    <span>{question.question}</span>
                    {question.options?.length ? (
                      <div className="decision-row">
                        {question.options.map((option) => (
                          <button
                            key={option.label}
                            className={`ghost-button ${
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
                        className="overlay-search"
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

                <button
                  className="primary-button"
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
                  Submit answers
                </button>
              </div>
            ) : null}

            <label className="raw-json-label">
              Raw response payload
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
            </label>

            <div className="approval-actions">
              <button
                className="primary-button"
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
                Send JSON response
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}

