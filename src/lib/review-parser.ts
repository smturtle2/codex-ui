import { ParsedReview, ParsedReviewFinding } from "@/lib/types";

const FILE_LINE_PATTERN = /([A-Za-z0-9_./-]+\.[A-Za-z0-9_+-]+):(\d+)/;

function normalizeFindingBlock(block: string): ParsedReviewFinding | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const title = lines[0].replace(/^[-*]\s*/, "");
  const body = lines.slice(1).join(" ").trim();
  const locationMatch = block.match(FILE_LINE_PATTERN);

  return {
    title,
    body,
    file: locationMatch?.[1] ?? null,
    line: locationMatch ? Number(locationMatch[2]) : null,
  };
}

export function parseReviewText(review: string): ParsedReview {
  const trimmed = review.trim();
  if (!trimmed) {
    return {
      title: "Review",
      findings: [],
      raw: review,
    };
  }

  const [titleLine, ...rest] = trimmed.split("\n");
  const findingBlocks = rest.join("\n").split(/\n(?=[-*]\s+)/g);
  const findings = findingBlocks
    .map((block) => normalizeFindingBlock(block))
    .filter((finding): finding is ParsedReviewFinding => finding !== null);

  return {
    title: titleLine.trim(),
    findings,
    raw: review,
  };
}
