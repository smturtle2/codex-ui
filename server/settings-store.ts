import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  createDefaultTerminalSettings,
  normalizeTerminalSettings,
  serializeTerminalSettings,
  type TerminalSettings,
  type TerminalSettingsEnvelope,
} from "../src/lib/windows-terminal";

function getSettingsDirectory(): string {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA || process.env.APPDATA || join(homedir(), "AppData", "Roaming");
  }

  return process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
}

export function getTerminalSettingsPath(): string {
  return join(getSettingsDirectory(), "webpty", "settings.json");
}

async function ensureSettingsDirectory(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function readTerminalSettings(
  startingDirectory?: string | null,
): Promise<TerminalSettingsEnvelope> {
  const path = getTerminalSettingsPath();
  await ensureSettingsDirectory(path);

  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return {
      path,
      settings: normalizeTerminalSettings(parsed, startingDirectory),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const settings = createDefaultTerminalSettings(startingDirectory);
    await writeFile(path, serializeTerminalSettings(settings), "utf8");
    return {
      path,
      settings,
    };
  }
}

export async function writeTerminalSettings(
  settings: unknown,
  startingDirectory?: string | null,
): Promise<TerminalSettingsEnvelope> {
  const path = getTerminalSettingsPath();
  const normalized = normalizeTerminalSettings(settings, startingDirectory);
  await ensureSettingsDirectory(path);
  await writeFile(path, serializeTerminalSettings(normalized), "utf8");

  return {
    path,
    settings: normalized,
  };
}

export function resetTerminalSettings(
  startingDirectory?: string | null,
): TerminalSettings {
  return createDefaultTerminalSettings(startingDirectory);
}
