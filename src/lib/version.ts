import { CompatibilityState } from "@/lib/types";

const MINIMUM_VERSION = [0, 114, 0] as const;
const FULL_MINOR = 114;

function parseVersion(version: string): [number, number, number] | null {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: readonly [number, number, number], right: readonly [number, number, number]) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) {
      return 1;
    }
    if (left[index] < right[index]) {
      return -1;
    }
  }
  return 0;
}

export function evaluateCompatibility(cliVersion: string): CompatibilityState {
  const parsed = parseVersion(cliVersion);
  const fallback: CompatibilityState = {
    cliVersion,
    mode: "unsupported",
    minimumVersion: "0.114.0",
    fullSupportRange: "0.114.x",
    message: "Unable to parse codex version.",
  };

  if (!parsed) {
    return fallback;
  }

  if (compareSemver(parsed, MINIMUM_VERSION) < 0) {
    return {
      ...fallback,
      message: `codex-cli ${cliVersion} is below the minimum supported version 0.114.0.`,
    };
  }

  if (parsed[0] === 0 && parsed[1] === FULL_MINOR) {
    return {
      cliVersion,
      mode: "full",
      minimumVersion: "0.114.0",
      fullSupportRange: "0.114.x",
      message: null,
    };
  }

  return {
    cliVersion,
    mode: "degraded",
    minimumVersion: "0.114.0",
    fullSupportRange: "0.114.x",
    message: `codex-cli ${cliVersion} is newer than the pinned 0.114.x contract. Experimental APIs are disabled.`,
  };
}
