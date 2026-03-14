import { IncomingMessage, ServerResponse, createServer } from "node:http";
import { Socket } from "node:net";

import { CodexBridge } from "@/server/bridge/codex-bridge";
import { HttpError, SecurityPolicy } from "@/server/security";

interface ApplicationServerOptions {
  bridge: CodexBridge;
  nextHandle: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
  security: SecurityPolicy;
  host: string;
  port: number;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? (JSON.parse(body) as Record<string, unknown>) : {};
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function sendError(response: ServerResponse, error: unknown) {
  if (error instanceof HttpError) {
    sendJson(response, error.statusCode, {
      error: error.message,
    });
    return;
  }

  sendJson(response, 500, {
    error: error instanceof Error ? error.message : "Internal Server Error",
  });
}

export function createApplicationServer(options: ApplicationServerOptions) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${options.host}:${options.port}`);
      const pathname = url.pathname;

      if (pathname.startsWith("/api/")) {
        options.security.assertApiAccess(request, true);
        await routeApiRequest(options.bridge, request, response, url);
        return;
      }

      await options.nextHandle(request, response);
    } catch (error) {
      sendError(response, error);
    }
  });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url ?? "/", `http://${options.host}:${options.port}`);
      if (url.pathname !== "/api/realtime") {
        socket.destroy();
        return;
      }

      options.security.assertWebSocketAccess(request);
      options.bridge.browserSessionHub.handleUpgrade(request, socket as Socket, head);
    } catch {
      socket.destroy();
    }
  });

  return server;
}

async function routeApiRequest(bridge: CodexBridge, request: IncomingMessage, response: ServerResponse, url: URL) {
  const method = request.method ?? "GET";
  const segments = url.pathname.split("/").filter(Boolean);

  if (method === "GET" && url.pathname === "/api/bootstrap") {
    sendJson(response, 200, await bridge.getBootstrap(url.searchParams.get("cwd"), url.searchParams.get("threadId")));
    return;
  }

  if (method === "GET" && url.pathname === "/api/threads") {
    sendJson(response, 200, await bridge.listThreads(url.searchParams));
    return;
  }

  if (method === "GET" && url.pathname === "/api/workspaces/browse") {
    sendJson(response, 200, await bridge.browseWorkspaces(url.searchParams.get("path")));
    return;
  }

  if (method === "POST" && url.pathname === "/api/threads") {
    sendJson(response, 200, await bridge.startThread(await readJsonBody(request)));
    return;
  }

  if (method === "GET" && segments.length === 3 && segments[1] === "threads") {
    sendJson(response, 200, await bridge.readThread(segments[2]));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "threads" && segments[3] === "resume") {
    sendJson(response, 200, await bridge.resumeThread(segments[2], await readJsonBody(request)));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "threads" && segments[3] === "fork") {
    sendJson(response, 200, await bridge.forkThread(segments[2], await readJsonBody(request)));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "threads" && segments[3] === "archive") {
    sendJson(response, 200, await bridge.archiveThread(segments[2]));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "threads" && segments[3] === "unarchive") {
    sendJson(response, 200, await bridge.unarchiveThread(segments[2]));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "threads" && segments[3] === "name") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await bridge.renameThread(segments[2], typeof body.name === "string" ? body.name : ""));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "threads" && segments[3] === "review") {
    sendJson(response, 200, await bridge.reviewThread(segments[2], await readJsonBody(request)));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "threads" && segments[3] === "turns") {
    sendJson(response, 200, await bridge.startTurn(segments[2], await readJsonBody(request)));
    return;
  }

  if (
    method === "POST" &&
    segments.length === 6 &&
    segments[1] === "threads" &&
    segments[3] === "turns" &&
    segments[5] === "interrupt"
  ) {
    sendJson(response, 200, await bridge.interruptTurn(segments[2], segments[4]));
    return;
  }

  if (
    method === "POST" &&
    segments.length === 6 &&
    segments[1] === "threads" &&
    segments[3] === "turns" &&
    segments[5] === "steer"
  ) {
    sendJson(response, 200, await bridge.steerTurn(segments[2], segments[4], await readJsonBody(request)));
    return;
  }

  if (method === "POST" && segments.length === 4 && segments[1] === "server-requests" && segments[3] === "respond") {
    sendJson(response, 200, await bridge.respondToServerRequest(segments[2], await readJsonBody(request)));
    return;
  }

  if (method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, await bridge.getConfig());
    return;
  }

  if (method === "POST" && url.pathname === "/api/config/batch") {
    sendJson(response, 200, await bridge.writeConfigBatch(await readJsonBody(request)));
    return;
  }

  if (method === "GET" && url.pathname === "/api/account") {
    sendJson(response, 200, await bridge.getAccount());
    return;
  }

  if (method === "POST" && url.pathname === "/api/account/login") {
    sendJson(response, 200, await bridge.loginAccount(await readJsonBody(request)));
    return;
  }

  if (method === "POST" && url.pathname === "/api/account/logout") {
    sendJson(response, 200, await bridge.logoutAccount());
    return;
  }

  throw new HttpError(404, `Unknown API route: ${url.pathname}`);
}
