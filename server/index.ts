import http, {
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
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

async function main(): Promise<void> {
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
        const snapshot = await bridge.createThread();
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
        } | null;

        const snapshot = await bridge.setSessionSettings({
          model: body?.model ?? null,
          effort: (body?.effort ?? null) as never,
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
      socket.destroy();
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
}

void main();

