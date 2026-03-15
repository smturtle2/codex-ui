"use client";

import type { CommandExecutionApprovalDecision } from "@/generated/codex-app-server/v2/CommandExecutionApprovalDecision";
import type {
  BridgeSnapshot,
  PendingServerRequest,
  SlashCommandDefinition,
  TimelineEntry,
} from "@/lib/shared";
import { getIntlLocale, getLocalizedCommands, getUiCopy, type UiLocale } from "./copy";

export const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function formatRelativeTime(locale: UiLocale, unixSeconds: number): string {
  const copy = getUiCopy(locale);
  const delta = Date.now() - unixSeconds * 1000;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < minute) {
    return copy.timeline.time.justNow;
  }
  if (delta < hour) {
    return copy.timeline.time.minutesAgo(Math.floor(delta / minute));
  }
  if (delta < day) {
    return copy.timeline.time.hoursAgo(Math.floor(delta / hour));
  }
  return copy.timeline.time.daysAgo(Math.floor(delta / day));
}

export function formatClock(locale: UiLocale, updatedAt: number): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
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

export function filterCommands(
  input: string,
  locale: UiLocale,
): SlashCommandDefinition[] {
  const query = input.replace(/^\//, "").trim().toLowerCase();
  const commands = getLocalizedCommands(locale);
  if (!query) {
    return commands;
  }

  return commands.filter((command) =>
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

export function buildStatusLine(
  snapshot: BridgeSnapshot | null,
  locale: UiLocale,
): string {
  if (!snapshot) {
    return getUiCopy(locale).statusPanel.phase.starting;
  }

  const copy = getUiCopy(locale);
  const currentModel = getCurrentModel(snapshot);
  const effort = getCurrentEffort(snapshot);

  return [
    currentModel?.displayName ?? currentModel?.model ?? "default",
    effort,
    snapshot.sessionSettings.planMode ? copy.statusPanel.plan : null,
    copy.statusPanel.phase[snapshot.phase],
    copy.statusPanel.sessions(snapshot.threadList.length),
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
  locale: UiLocale,
): string {
  const copy = getUiCopy(locale);

  if (typeof decision === "string") {
    switch (decision) {
      case "accept":
        return copy.approval.accept;
      case "acceptForSession":
        return copy.approval.acceptForSession;
      case "decline":
        return copy.approval.decline;
      case "cancel":
        return copy.common.cancel;
    }
  }

  if ("acceptWithExecpolicyAmendment" in decision) {
    return `${copy.approval.acceptWithoutAskingPrefix} \`${commandText ?? ""}\``;
  }

  return copy.approval.allowNetworkRule;
}

export function fileApprovalDecisionLabel(
  decision: string,
  locale: UiLocale,
): string {
  const copy = getUiCopy(locale);

  switch (decision) {
    case "accept":
      return copy.approval.acceptEdits;
    case "acceptForSession":
      return copy.approval.acceptEditsForSession;
    case "decline":
      return copy.approval.decline;
    case "cancel":
      return copy.common.cancel;
    default:
      return decision;
  }
}

export function formatTimelineKind(
  kind: TimelineEntry["kind"],
  locale: UiLocale,
): string {
  return getUiCopy(locale).timeline.kinds[kind];
}

export function formatTimelineStatus(
  status: TimelineEntry["status"],
  locale: UiLocale,
): string {
  return getUiCopy(locale).timeline.status[status];
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
