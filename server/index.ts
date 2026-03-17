import http, {
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { spawn } from "node:child_process";
import { readdir, realpath, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import next from "next";
import { WebSocketServer } from "ws";

import { CodexBridge } from "./codex-bridge";

function json(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
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

type CliOptions = {
  funnel: boolean;
};

function hasFlag(name: string, argv: string[]): boolean {
  const normalized = name.replace(/^-+/, "");
  const envValue = process.env[`npm_config_${normalized}`];
  return argv.includes(`--${normalized}`) || (envValue !== undefined && envValue !== "false");
}

function parseCliOptions(argv: string[]): CliOptions {
  return {
    funnel: hasFlag("funnel", argv),
  };
}

function maybeStartFunnel(port: number): void {
  const child = spawn("bash", ["./scripts/tailscale-funnel.sh", "up", String(port)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`Failed to start Tailscale Funnel helper: ${error.message}`);
    console.error(`Local app is still available at http://127.0.0.1:${port}`);
  });

  child.on("close", (code) => {
    if (!code || code === 0) {
      return;
    }

    console.error(`Tailscale Funnel helper exited with code ${code}.`);
    console.error(`Local app is still available at http://127.0.0.1:${port}`);
  });
}

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
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const port = Number(process.env.PORT ?? "3000");
  const host = process.env.HOST ?? "127.0.0.1";
  const dev = process.env.NODE_ENV !== "production";

  const bridge = new CodexBridge();
  await bridge.start();

  const app = next({
    dev,
    hostname: host,
    port,
  });

  await app.prepare();
  const handle = app.getRequestHandler();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    try {
      if (url.pathname === "/api/bootstrap" && request.method === "GET") {
        const snapshot = await bridge.refreshBootstrapData();
        json(response, 200, { snapshot });
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
        json(response, 200, { snapshot });
        return;
      }

      if (url.pathname === "/api/thread/resume" && request.method === "POST") {
        const body = (await readJson(request)) as { threadId?: string } | null;
        if (!body?.threadId) {
          json(response, 400, { error: "threadId is required." });
          return;
        }

        const snapshot = await bridge.resumeThread(body.threadId);
        json(response, 200, { snapshot });
        return;
      }

      if (url.pathname === "/api/thread/fork" && request.method === "POST") {
        const body = (await readJson(request)) as { threadId?: string } | null;
        if (!body?.threadId) {
          json(response, 400, { error: "threadId is required." });
          return;
        }

        const snapshot = await bridge.forkThread(body.threadId);
        json(response, 200, { snapshot });
        return;
      }

      if (url.pathname === "/api/thread/read" && request.method === "POST") {
        const body = (await readJson(request)) as { threadId?: string } | null;
        if (!body?.threadId) {
          json(response, 400, { error: "threadId is required." });
          return;
        }

        const snapshot = await bridge.readThread(body.threadId);
        json(response, 200, { snapshot });
        return;
      }

      if (url.pathname === "/api/workspace/list" && request.method === "GET") {
        const listing = await listWorkspaceDirectories(url.searchParams.get("path"));
        json(response, 200, listing);
        return;
      }

      if (url.pathname === "/api/turn/start" && request.method === "POST") {
        const body = (await readJson(request)) as { text?: string } | null;
        if (!body?.text) {
          json(response, 400, { error: "text is required." });
          return;
        }

        const snapshot = await bridge.sendUserTurn(body.text);
        json(response, 200, { snapshot });
        return;
      }

      if (url.pathname === "/api/turn/interrupt" && request.method === "POST") {
        const snapshot = await bridge.interruptActiveTurn();
        json(response, 200, { snapshot });
        return;
      }

      if (url.pathname === "/api/review/start" && request.method === "POST") {
        const snapshot = await bridge.startReview();
        json(response, 200, { snapshot });
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
        json(response, 200, { snapshot });
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
        json(response, 200, { snapshot });
        return;
      }

      await handle(request, response);
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

  process.on("SIGINT", () => {
    void bridge.stop().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void bridge.stop().finally(() => process.exit(0));
  });

  console.log(`codex-ui listening on http://${host}:${port}`);

  if (cliOptions.funnel) {
    maybeStartFunnel(port);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
