import { describe, expect, it } from "vitest";

import { parseReviewText } from "@/lib/review-parser";

describe("parseReviewText", () => {
  it("extracts title and findings", () => {
    const parsed = parseReviewText(`
Review Summary

- Missing null check
  src/app/page.tsx:42 can throw when no thread exists.

- Another issue
  src/server/http.ts:10 should validate input.
`);

    expect(parsed.title).toBe("Review Summary");
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0]?.file).toBe("src/app/page.tsx");
    expect(parsed.findings[0]?.line).toBe(42);
  });
});
