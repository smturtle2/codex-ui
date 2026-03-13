import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const fixtureDir = join(process.cwd(), "fixtures", "codex-app-server", "0.114.0");
const tempDir = mkdtempSync(join(tmpdir(), "codex-schema-"));

function normalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeJson(nested)]),
    );
  }

  return value;
}

try {
  execFileSync("codex", ["app-server", "generate-json-schema", "--out", tempDir], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  const files = ["codex_app_server_protocol.schemas.json", "codex_app_server_protocol.v2.schemas.json"];
  for (const file of files) {
    const actual = normalizeJson(JSON.parse(readFileSync(join(tempDir, file), "utf8")));
    const expected = normalizeJson(JSON.parse(readFileSync(join(fixtureDir, file), "utf8")));

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      console.error(`Schema fixture mismatch: ${file}`);
      process.exitCode = 1;
    }
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
