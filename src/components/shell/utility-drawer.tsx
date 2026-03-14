import { ThemePreference } from "@/lib/shell-ui";
import { ParsedReview, PendingRequestRecord } from "@/lib/types";

import { UtilityView } from "@/components/shell/shared";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

const VIEW_LABELS: Record<UtilityView, string> = {
  pending: "Pending",
  diff: "Diff",
  review: "Review",
  logs: "Logs",
  settings: "Settings",
};

export function UtilityDrawer({
  open,
  view,
  pendingRequests,
  latestDiff,
  latestReview,
  logs,
  config,
  models,
  connectionUrl,
  reachableUrls,
  selectedThreadId,
  hasActiveTurn,
  themePreference,
  onClose,
  onViewChange,
  onRequestDecision,
  onConfigWrite,
  onThemePreferenceChange,
  onResume,
  onInterrupt,
  onReview,
  onOpenWorkspace,
  onReload,
}: {
  open: boolean;
  view: UtilityView;
  pendingRequests: PendingRequestRecord[];
  latestDiff: string | null;
  latestReview: ParsedReview | null;
  logs: Array<{ id: string; source: string; level: string; message: string; payload: unknown }>;
  config: unknown;
  models: unknown[];
  connectionUrl: string;
  reachableUrls: string[];
  selectedThreadId: string | null;
  hasActiveTurn: boolean;
  themePreference: ThemePreference;
  onClose: () => void;
  onViewChange: (view: UtilityView) => void;
  onRequestDecision: (request: PendingRequestRecord, body: unknown) => Promise<void>;
  onConfigWrite: (keyPath: string, value: unknown) => Promise<void>;
  onThemePreferenceChange: (themePreference: ThemePreference) => void;
  onResume: () => Promise<void>;
  onInterrupt: () => Promise<void>;
  onReview: (detached: boolean) => Promise<void>;
  onOpenWorkspace: () => void;
  onReload: () => Promise<void>;
}) {
  return (
    <>
      <button className={`drawer-overlay ${open ? "open" : ""}`} aria-hidden={!open} tabIndex={open ? 0 : -1} onClick={onClose} />
      <aside className={`utility-drawer ${open ? "open" : ""}`}>
        <div className="utility-header">
          <div>
            <p className="section-title">Controls</p>
            <h3 className="utility-title">Conversation settings</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close tools drawer">
            x
          </button>
        </div>

        <div className="utility-tabs">
          {(["pending", "diff", "review", "logs", "settings"] as UtilityView[]).map((entry) => (
            <button key={entry} className={`tab-button ${view === entry ? "active" : ""}`} onClick={() => onViewChange(entry)}>
              {VIEW_LABELS[entry]}
              {entry === "pending" && pendingRequests.length > 0 ? <span className="tab-badge">{pendingRequests.length}</span> : null}
            </button>
          ))}
        </div>

        <div className="utility-content">
          {view === "pending" ? (
            pendingRequests.length > 0 ? (
              pendingRequests.map((request) => {
                const params = isObject(request.params) ? request.params : {};
                const availableDecisions =
                  request.method === "item/commandExecution/requestApproval" && Array.isArray(params.availableDecisions)
                    ? params.availableDecisions
                    : request.method === "item/fileChange/requestApproval"
                      ? ["accept", "acceptForSession", "decline", "cancel"]
                      : null;

                return (
                  <div className="drawer-card" key={request.id}>
                    <p className="item-title">{requestLabel(request)}</p>
                    <pre>{JSON.stringify(request.params, null, 2)}</pre>
                    <div className="drawer-actions">
                      {availableDecisions
                        ? availableDecisions.map((decision) => (
                            <button
                              className="ghost-button"
                              key={decisionLabel(decision)}
                              onClick={() => void onRequestDecision(request, { decision })}
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
                              void onRequestDecision(request, {
                                permissions: params.permissions ?? {},
                                scope: "turn",
                              })
                            }
                          >
                            Approve turn
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() =>
                              void onRequestDecision(request, {
                                permissions: params.permissions ?? {},
                                scope: "session",
                              })
                            }
                          >
                            Approve session
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
                            void onRequestDecision(request, { answers });
                          }}
                        >
                          Submit placeholder
                        </button>
                      ) : null}
                      {request.method === "mcpServer/elicitation/request" ? (
                        <>
                          <button className="button" onClick={() => void onRequestDecision(request, { action: "accept", content: {}, _meta: null })}>
                            Accept
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() => void onRequestDecision(request, { action: "decline", content: null, _meta: null })}
                          >
                            Decline
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state drawer-empty">No pending approvals or input requests.</div>
            )
          ) : null}

          {view === "diff" ? (
            latestDiff ? (
              <div className="drawer-card">
                <p className="item-title">Latest diff</p>
                <pre>{latestDiff}</pre>
              </div>
            ) : (
              <div className="empty-state drawer-empty">No diff has been produced yet.</div>
            )
          ) : null}

          {view === "review" ? (
            latestReview ? (
              <div className="drawer-card">
                <p className="item-title">{latestReview.title}</p>
                {latestReview.findings.map((finding, index) => (
                  <p key={`${finding.title}-${index}`} className="review-finding">
                    {finding.title}
                    {finding.file ? ` - ${finding.file}${finding.line ? `:${finding.line}` : ""}` : ""}
                    <br />
                    {finding.body}
                  </p>
                ))}
              </div>
            ) : (
              <div className="empty-state drawer-empty">No review findings are available yet.</div>
            )
          ) : null}

          {view === "logs" ? (
            logs.length > 0 ? (
              logs
                .slice()
                .reverse()
                .map((entry) => (
                  <div className="drawer-card" key={entry.id}>
                    <p className="item-title">
                      {entry.source} - {entry.level}
                    </p>
                    <p>{entry.message}</p>
                    {entry.payload ? <pre>{JSON.stringify(entry.payload, null, 2)}</pre> : null}
                  </div>
                ))
            ) : (
              <div className="empty-state drawer-empty">No logs captured yet.</div>
            )
          ) : null}

          {view === "settings" ? (
            <div className="utility-stack">
              <div className="drawer-card settings-card">
                <p className="item-title">Appearance</p>
                <select
                  className="select-input"
                  value={themePreference}
                  onChange={(event) => onThemePreferenceChange(event.target.value as ThemePreference)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="drawer-card settings-card">
                <p className="item-title">Conversation actions</p>
                <div className="drawer-actions">
                  <button className="ghost-button" onClick={onOpenWorkspace}>
                    Change project
                  </button>
                  <button className="ghost-button" onClick={() => void onReload()}>
                    Reload data
                  </button>
                  {selectedThreadId ? (
                    <>
                      <button className="ghost-button" onClick={() => void onResume()}>
                        Resume thread
                      </button>
                      <button className="ghost-button" onClick={() => void onReview(false)}>
                        Inline review
                      </button>
                      <button className="ghost-button" onClick={() => void onReview(true)}>
                        Detached review
                      </button>
                      {hasActiveTurn ? (
                        <button className="danger-button" onClick={() => void onInterrupt()}>
                          Interrupt
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="drawer-card settings-card">
                <p className="item-title">Quick controls</p>
                <div className="settings-grid">
                  <select
                    className="select-input"
                    value={(config as { model?: string | null })?.model ?? ""}
                    onChange={(event) => void onConfigWrite("model", event.target.value || null)}
                  >
                    <option value="">Default model</option>
                    {(models as Array<{ model?: string; displayName?: string }>).map((model, index) => (
                      <option key={`${model.model ?? "model"}-${index}`} value={model.model}>
                        {model.displayName ?? model.model}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select-input"
                    value={(config as { approval_policy?: string | null })?.approval_policy ?? ""}
                    onChange={(event) => void onConfigWrite("approval_policy", event.target.value || null)}
                  >
                    <option value="">Default approval</option>
                    <option value="untrusted">untrusted</option>
                    <option value="on-request">on-request</option>
                    <option value="never">never</option>
                  </select>
                  <select
                    className="select-input"
                    value={(config as { sandbox_mode?: string | null })?.sandbox_mode ?? ""}
                    onChange={(event) => void onConfigWrite("sandbox_mode", event.target.value || null)}
                  >
                    <option value="">Default sandbox</option>
                    <option value="read-only">read-only</option>
                    <option value="workspace-write">workspace-write</option>
                    <option value="danger-full-access">danger-full-access</option>
                  </select>
                  <select
                    className="select-input"
                    value={(config as { web_search?: string | null })?.web_search ?? ""}
                    onChange={(event) => void onConfigWrite("web_search", event.target.value || null)}
                  >
                    <option value="">Default web search</option>
                    <option value="disabled">disabled</option>
                    <option value="cached">cached</option>
                    <option value="live">live</option>
                  </select>
                </div>
              </div>

              <div className="drawer-card connection-card">
                <p className="item-title">Connection</p>
                <p>{connectionUrl}</p>
                <small>{reachableUrls.join(" - ")}</small>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
