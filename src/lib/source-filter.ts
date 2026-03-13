const DEFAULT_SOURCE_KINDS = ["appServer", "cli", "vscode", "exec"] as const;

export function getDefaultSourceKinds() {
  return [...DEFAULT_SOURCE_KINDS];
}

export function isHumanSourceKind(sourceKind: string | null | undefined) {
  return sourceKind !== null && sourceKind !== undefined && DEFAULT_SOURCE_KINDS.includes(sourceKind as (typeof DEFAULT_SOURCE_KINDS)[number]);
}
