import { describe, expect, it } from "vitest";

import { evaluateCompatibility } from "@/lib/version";

describe("evaluateCompatibility", () => {
  it("returns full support for 0.114.x", () => {
    expect(evaluateCompatibility("codex-cli 0.114.0").mode).toBe("full");
    expect(evaluateCompatibility("codex-cli 0.114.9").mode).toBe("full");
  });

  it("returns degraded support for newer minor versions", () => {
    const result = evaluateCompatibility("codex-cli 0.115.0");
    expect(result.mode).toBe("degraded");
    expect(result.message).toContain("0.115.0");
  });

  it("blocks older versions", () => {
    const result = evaluateCompatibility("codex-cli 0.113.9");
    expect(result.mode).toBe("unsupported");
    expect(result.message).toContain("minimum supported version");
  });
});
