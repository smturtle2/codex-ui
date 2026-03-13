import { describe, expect, it } from "vitest";

import { getDefaultSourceKinds, isHumanSourceKind } from "@/lib/source-filter";

describe("source filters", () => {
  it("returns the pinned interactive source kinds", () => {
    expect(getDefaultSourceKinds()).toEqual(["appServer", "cli", "vscode", "exec"]);
  });

  it("hides sub-agent sources by default", () => {
    expect(isHumanSourceKind("subAgent")).toBe(false);
    expect(isHumanSourceKind("cli")).toBe(true);
  });
});
