const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:\/$/;

export function normalizeWorkspacePath(input: string | null | undefined) {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return "";
  }

  let normalized = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (WINDOWS_DRIVE_PATTERN.test(normalized)) {
    return normalized;
  }

  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
  }

  return normalized || "/";
}

export function createWorkspaceKey(input: string | null | undefined) {
  const normalized = normalizeWorkspacePath(input);
  if (!normalized) {
    return "";
  }

  if (/^\/mnt\/[a-z]\//i.test(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    return normalized.toLowerCase();
  }

  return normalized;
}

export function workspaceLabel(input: string | null | undefined) {
  const normalized = normalizeWorkspacePath(input);
  if (!normalized) {
    return "Unknown workspace";
  }

  if (normalized === "/") {
    return "/";
  }

  if (WINDOWS_DRIVE_PATTERN.test(normalized)) {
    return normalized.slice(0, 2);
  }

  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

export function workspaceParentPath(input: string | null | undefined) {
  const normalized = normalizeWorkspacePath(input);
  if (!normalized || normalized === "/" || WINDOWS_DRIVE_PATTERN.test(normalized)) {
    return null;
  }

  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return "/";
  }

  const parent = normalized.slice(0, lastSlash);
  return parent || "/";
}

export function workspaceSegments(input: string | null | undefined) {
  const normalized = normalizeWorkspacePath(input);
  if (!normalized) {
    return [];
  }

  if (normalized === "/") {
    return ["/"];
  }

  if (WINDOWS_DRIVE_PATTERN.test(normalized)) {
    return [normalized.slice(0, 2)];
  }

  const parts = normalized.split("/").filter(Boolean);
  if (normalized.startsWith("/")) {
    return ["/", ...parts];
  }

  return parts;
}
