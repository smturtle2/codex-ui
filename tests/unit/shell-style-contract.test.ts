import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT_DIR = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(ROOT_DIR, "src/app/globals.css"), "utf8");

describe("Codex shell style contract", () => {
  it("defines the conversation-first layout classes used by the shell", () => {
    const requiredClasses = [
      "codex-shell",
      "shell-layout",
      "sidebar",
      "sidebar-overlay",
      "sidebar-top",
      "thread-list-pane",
      "thread-bucket",
      "thread-row",
      "conversation-stage",
      "thread-header",
      "thread-title",
      "workspace-pill",
      "header-menu",
      "notice-stack",
      "timeline-shell",
      "timeline-stream",
      "chat-row",
      "user-bubble",
      "assistant-bubble",
      "event-row",
      "composer-shell",
      "composer-panel",
      "composer-plus-menu",
      "composer-input",
      "attachment-chip",
      "utility-drawer",
      "drawer-overlay",
      "utility-tabs",
      "drawer-card",
      "workspace-modal",
      "workspace-option",
      "workspace-directory",
      "button",
      "ghost-button",
      "danger-button",
      "icon-button",
      "status-banner",
      "empty-state",
      "starter-card",
      "pending-pill",
    ];

    for (const className of requiredClasses) {
      expect(css).toContain(`.${className}`);
    }
  });
});
