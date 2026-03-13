import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT_DIR = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(ROOT_DIR, "src/app/globals.css"), "utf8");

describe("Codex shell style contract", () => {
  it("defines the core classes used by the current shell layout", () => {
    const requiredClasses = [
      "codex-shell",
      "codex-grid",
      "sidebar",
      "sidebar-scroll",
      "main-panel",
      "panel-header",
      "messages-scroll",
      "composer",
      "composer-grid",
      "right-panel",
      "right-header",
      "right-scroll",
      "thread-group",
      "thread-card",
      "thread-card.active",
      "thread-name",
      "thread-preview",
      "pill",
      "pill.warn",
      "status-banner",
      "status-banner.error",
      "button",
      "ghost-button",
      "danger-button",
      "text-input",
      "text-area",
      "workspace-input",
      "select-input",
      "tool-panel",
      "catalog-list",
      "catalog-item",
      "chip",
      "connection-card",
      "connection-primary",
      "message-card",
      "message-card.user",
      "message-card.commentary",
      "message-card.final",
      "pending-card",
      "settings-card",
      "tab-row",
      "tab-button",
      "tab-button.active",
      "empty-state",
    ];

    for (const className of requiredClasses) {
      expect(css).toContain(`.${className}`);
    }
  });
});
