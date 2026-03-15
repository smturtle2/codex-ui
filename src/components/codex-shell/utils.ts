"use client";

import type { CommandExecutionApprovalDecision } from "@/generated/codex-app-server/v2/CommandExecutionApprovalDecision";
import type {
  BridgeSnapshot,
  PendingServerRequest,
  SlashCommandDefinition,
  TimelineEntry,
} from "@/lib/shared";
import { BUILTIN_COMMANDS } from "@/lib/shared";

export const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function formatRelativeTime(unixSeconds: number): string {
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

export function formatClock(updatedAt: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAt));
}

export function formatRuntime(startedAt: number | null, now: number = Date.now()): string {
  if (!startedAt) {
    return "0s";
  }

  return `${Math.max(0, Math.floor((now - startedAt) / 1000))}s`;
}

export function filterCommands(input: string): SlashCommandDefinition[] {
  const query = input.replace(/^\//, "").trim().toLowerCase();
  if (!query) {
    return BUILTIN_COMMANDS;
  }

  return BUILTIN_COMMANDS.filter((command) =>
    `${command.name} ${command.description}`.toLowerCase().includes(query),
  );
}

export function getCurrentModel(snapshot: BridgeSnapshot | null) {
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

export function getCurrentEffort(snapshot: BridgeSnapshot | null): string | null {
  const currentModel = getCurrentModel(snapshot);
  return (
    snapshot?.sessionSettings.effort ??
    currentModel?.defaultReasoningEffort ??
    null
  );
}

export function buildStatusLine(snapshot: BridgeSnapshot | null): string {
  if (!snapshot) {
    return "starting";
  }

  const currentModel = getCurrentModel(snapshot);
  const effort = getCurrentEffort(snapshot);

  return [
    currentModel?.displayName ?? currentModel?.model ?? "default",
    effort,
    snapshot.sessionSettings.planMode ? "plan" : null,
    snapshot.phase,
    `${snapshot.threadList.length} sessions`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildDefaultServerResponse(request: PendingServerRequest): string {
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

export function summarizeDecision(decision: CommandExecutionApprovalDecision): string {
  if (typeof decision === "string") {
    return decision;
  }

  if ("acceptWithExecpolicyAmendment" in decision) {
    return "acceptWithExecpolicyAmendment";
  }

  return "applyNetworkPolicyAmendment";
}

export function approvalDecisionLabel(
  decision: CommandExecutionApprovalDecision,
  commandText: string | null,
): string {
  if (typeof decision === "string") {
    switch (decision) {
      case "accept":
        return "Yes, proceed";
      case "acceptForSession":
        return "Yes, proceed for this session";
      case "decline":
        return "No, and tell Codex what to do differently";
      case "cancel":
        return "Cancel";
    }
  }

  if ("acceptWithExecpolicyAmendment" in decision) {
    return `Yes, and don't ask again for commands that start with \`${commandText ?? ""}\``;
  }

  return "Allow the proposed network rule";
}

export function fileApprovalDecisionLabel(decision: string): string {
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

export function formatTimelineKind(kind: TimelineEntry["kind"]): string {
  switch (kind) {
    case "thread":
      return "Thread";
    case "turn":
      return "Turn";
    case "message":
      return "Message";
    case "reasoning":
      return "Reasoning";
    case "plan":
      return "Plan";
    case "command":
      return "Command";
    case "diff":
      return "Diff";
    case "review":
      return "Review";
    case "tool":
      return "Tool";
    case "approval":
      return "Approval";
    case "input":
      return "Input";
    case "system":
      return "System";
  }
}

export function formatTimelineStatus(status: TimelineEntry["status"]): string {
  switch (status) {
    case "running":
      return "running";
    case "pending":
      return "pending";
    case "error":
      return "error";
    case "completed":
      return "completed";
    case "idle":
    default:
      return "idle";
  }
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.tabIndex !== -1,
  );
}
