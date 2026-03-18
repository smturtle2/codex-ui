import http, {
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readdir, realpath, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { WebSocketServer } from "ws";

import type { BridgeSnapshot } from "../src/lib/shared";
import type { TerminalSettings } from "../src/lib/windows-terminal";
import { stringifyWindowsTerminalSettings } from "../src/lib/windows-terminal";

import { CodexBridge } from "./codex-bridge";
import { readTerminalSettings, resetTerminalSettings, writeTerminalSettings } from "./settings-store";

function json(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendSnapshot(
  response: ServerResponse,
  snapshot: BridgeSnapshot,
  statusCode = 200,
): void {
  json(response, statusCode, {
    type: "snapshot",
    snapshot,
  });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

type WorkspaceDirectoryEntry = {
  name: string;
  path: string;
};

const DEEMPHASIZED_WORKSPACE_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".playwright-cli",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "output",
]);

async function resolveDirectoryPath(rawPath: string | null | undefined): Promise<string> {
  const candidate = rawPath?.trim() ? resolve(rawPath.trim()) : process.cwd();
  const resolvedPath = await realpath(candidate);
  const resolvedStats = await stat(resolvedPath);
  if (!resolvedStats.isDirectory()) {
    throw new Error(`${resolvedPath} is not a directory.`);
  }

  return resolvedPath;
}

async function listWorkspaceDirectories(
  rawPath: string | null | undefined,
): Promise<{
  currentPath: string;
  parentPath: string | null;
  directories: WorkspaceDirectoryEntry[];
}> {
  const currentPath = await resolveDirectoryPath(rawPath);
  const entries = await readdir(currentPath, { withFileTypes: true });
  const getDirectoryPriority = (name: string): number => {
    if (DEEMPHASIZED_WORKSPACE_DIRECTORIES.has(name)) {
      return 3;
    }

    if (name.startsWith(".")) {
      return 2;
    }

    return 1;
  };

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: resolve(currentPath, entry.name),
    }))
    .sort((left, right) => {
      const leftPriority = getDirectoryPriority(left.name);
      const rightPriority = getDirectoryPriority(right.name);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    });
  const parentCandidate = dirname(currentPath);
  const parentPath = parentCandidate === currentPath ? null : parentCandidate;

  return {
    currentPath,
    parentPath,
    directories,
  };
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? "33121");
  const host = process.env.HOST ?? "127.0.0.1";

  const bridge = new CodexBridge();
  await bridge.start();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    try {
      if (url.pathname === "/healthz" && request.method === "GET") {
        json(response, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/bootstrap" && request.method === "GET") {
        const snapshot = await bridge.refreshBootstrapData();
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/thread/start" && request.method === "POST") {
        const body = (await readJson(request)) as { cwd?: string | null } | null;
        let cwd: string | null = null;
        if (body?.cwd) {
          try {
            cwd = await resolveDirectoryPath(body.cwd);
          } catch (error) {
            json(response, 400, {
              error: error instanceof Error ? error.message : "Invalid workspace path.",
            });
            return;
          }
        }

        const snapshot = await bridge.createThread(cwd);
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/thread/resume" && request.method === "POST") {
        const body = (await readJson(request)) as { threadId?: string } | null;
        if (!body?.threadId) {
          json(response, 400, { error: "threadId is required." });
          return;
        }

        const snapshot = await bridge.resumeThread(body.threadId);
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/thread/fork" && request.method === "POST") {
        const body = (await readJson(request)) as { threadId?: string } | null;
        if (!body?.threadId) {
          json(response, 400, { error: "threadId is required." });
          return;
        }

        const snapshot = await bridge.forkThread(body.threadId);
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/thread/read" && request.method === "POST") {
        const body = (await readJson(request)) as { threadId?: string } | null;
        if (!body?.threadId) {
          json(response, 400, { error: "threadId is required." });
          return;
        }

        const snapshot = await bridge.readThread(body.threadId);
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/workspace/list" && request.method === "GET") {
        const listing = await listWorkspaceDirectories(url.searchParams.get("path"));
        json(response, 200, listing);
        return;
      }

      if (url.pathname === "/api/terminal/settings" && request.method === "GET") {
        const payload = await readTerminalSettings(process.cwd());
        json(response, 200, payload);
        return;
      }

      if (url.pathname === "/api/terminal/settings" && request.method === "POST") {
        const body = (await readJson(request)) as { settings?: TerminalSettings; reset?: boolean } | null;
        const payload = body?.reset
          ? await writeTerminalSettings(resetTerminalSettings(process.cwd()), process.cwd())
          : await writeTerminalSettings(body?.settings ?? {}, process.cwd());
        json(response, 200, payload);
        return;
      }

      if (url.pathname === "/api/config/read" && request.method === "GET") {
        const payload = await readTerminalSettings(process.cwd());
        json(response, 200, {
          path: payload.path,
          settings: stringifyWindowsTerminalSettings(payload.settings),
        });
        return;
      }

      if (url.pathname === "/api/config/write" && request.method === "POST") {
        const body = (await readJson(request)) as { settings?: string } | null;
        if (!body?.settings || typeof body.settings !== "string") {
          json(response, 400, { error: "settings is required." });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(body.settings);
        } catch (error) {
          json(response, 400, {
            error: error instanceof Error ? error.message : "Invalid settings JSON.",
          });
          return;
        }

        const payload = await writeTerminalSettings(parsed, process.cwd());
        json(response, 200, {
          path: payload.path,
          settings: stringifyWindowsTerminalSettings(payload.settings),
        });
        return;
      }

      if (url.pathname === "/api/turn/start" && request.method === "POST") {
        const body = (await readJson(request)) as { text?: string } | null;
        if (!body?.text) {
          json(response, 400, { error: "text is required." });
          return;
        }

        const snapshot = await bridge.sendUserTurn(body.text);
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/turn/interrupt" && request.method === "POST") {
        const snapshot = await bridge.interruptActiveTurn();
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/review/start" && request.method === "POST") {
        const snapshot = await bridge.startReview();
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/session/settings" && request.method === "POST") {
        const body = (await readJson(request)) as {
          model?: string | null;
          effort?: string | null;
          fastMode?: boolean;
          planMode?: boolean;
        } | null;

        const snapshot = await bridge.setSessionSettings({
          model:
            body && Object.prototype.hasOwnProperty.call(body, "model")
              ? (body.model ?? null)
              : undefined,
          effort:
            body && Object.prototype.hasOwnProperty.call(body, "effort")
              ? ((body.effort ?? null) as never)
              : undefined,
          fastMode:
            body && Object.prototype.hasOwnProperty.call(body, "fastMode")
              ? Boolean(body.fastMode)
              : undefined,
          planMode:
            body && Object.prototype.hasOwnProperty.call(body, "planMode")
              ? Boolean(body.planMode)
              : undefined,
        });
        sendSnapshot(response, snapshot);
        return;
      }

      if (url.pathname === "/api/server-request/respond" && request.method === "POST") {
        const body = (await readJson(request)) as {
          requestId?: string;
          result?: unknown;
        } | null;

        if (!body?.requestId) {
          json(response, 400, { error: "requestId is required." });
          return;
        }

        const snapshot = await bridge.respondToServerRequest(
          body.requestId,
          body.result ?? {},
        );
        sendSnapshot(response, snapshot);
        return;
      }

      json(response, 404, { error: "Not found." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      json(response, 500, { error: message });
    }
  });

  const sockets = new Set<import("ws").WebSocket>();
  const wss = new WebSocketServer({ noServer: true });

  bridge.on("snapshot", (snapshot) => {
    const message = JSON.stringify({ type: "snapshot", snapshot });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    }
  });

  wss.on("connection", (socket) => {
    sockets.add(socket);
    socket.send(JSON.stringify({ type: "snapshot", snapshot: bridge.getSnapshot() }));
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (url.pathname !== "/ws") {
      return;
    }

    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit("connection", websocket, request);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const shutdown = async () => {
    await bridge.stop();
    wss.close();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.log(`legacy bridge listening on http://${host}:${port}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
