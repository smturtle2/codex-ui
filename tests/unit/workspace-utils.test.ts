import { describe, expect, it } from "vitest";

import {
  createWorkspaceKey,
  normalizeWorkspacePath,
  workspaceLabel,
  workspaceParentPath,
  workspaceSegments,
} from "@/lib/workspace-utils";

describe("workspace utils", () => {
  it("normalizes path separators and trailing slashes", () => {
    expect(normalizeWorkspacePath("/mnt/s/ProjectForFast/codex-ui/")).toBe("/mnt/s/ProjectForFast/codex-ui");
    expect(normalizeWorkspacePath("C:\\Users\\dev\\repo\\")).toBe("C:/Users/dev/repo");
  });

  it("creates case-insensitive keys for mounted windows paths", () => {
    expect(createWorkspaceKey("/mnt/S/ProjectForFast/codex-ui")).toBe("/mnt/s/projectforfast/codex-ui");
  });

  it("returns parent path and breadcrumbs", () => {
    expect(workspaceParentPath("/mnt/s/ProjectForFast/codex-ui")).toBe("/mnt/s/ProjectForFast");
    expect(workspaceSegments("/mnt/s/ProjectForFast/codex-ui")).toEqual(["/", "mnt", "s", "ProjectForFast", "codex-ui"]);
    expect(workspaceLabel("/mnt/s/ProjectForFast/codex-ui")).toBe("codex-ui");
  });
});
