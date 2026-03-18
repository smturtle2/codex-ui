"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_process_1 = __importDefault(require("node:process"));
const ws_1 = require("ws");
const windows_terminal_1 = require("../src/lib/windows-terminal");
const codex_bridge_1 = require("./codex-bridge");
const settings_store_1 = require("./settings-store");
function json(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
}
function sendSnapshot(response, snapshot, statusCode = 200) {
    json(response, statusCode, {
        type: "snapshot",
        snapshot,
    });
}
async function readJson(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
        return null;
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
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
async function resolveDirectoryPath(rawPath) {
    const candidate = rawPath?.trim() ? (0, node_path_1.resolve)(rawPath.trim()) : node_process_1.default.cwd();
    const resolvedPath = await (0, promises_1.realpath)(candidate);
    const resolvedStats = await (0, promises_1.stat)(resolvedPath);
    if (!resolvedStats.isDirectory()) {
        throw new Error(`${resolvedPath} is not a directory.`);
    }
    return resolvedPath;
}
async function listWorkspaceDirectories(rawPath) {
    const currentPath = await resolveDirectoryPath(rawPath);
    const entries = await (0, promises_1.readdir)(currentPath, { withFileTypes: true });
    const getDirectoryPriority = (name) => {
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
        path: (0, node_path_1.resolve)(currentPath, entry.name),
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
    const parentCandidate = (0, node_path_1.dirname)(currentPath);
    const parentPath = parentCandidate === currentPath ? null : parentCandidate;
    return {
        currentPath,
        parentPath,
        directories,
    };
}
async function main() {
    const port = Number(node_process_1.default.env.PORT ?? "33121");
    const host = node_process_1.default.env.HOST ?? "127.0.0.1";
    const bridge = new codex_bridge_1.CodexBridge();
    await bridge.start();
    const server = node_http_1.default.createServer(async (request, response) => {
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
                const body = (await readJson(request));
                let cwd = null;
                if (body?.cwd) {
                    try {
                        cwd = await resolveDirectoryPath(body.cwd);
                    }
                    catch (error) {
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
                const body = (await readJson(request));
                if (!body?.threadId) {
                    json(response, 400, { error: "threadId is required." });
                    return;
                }
                const snapshot = await bridge.resumeThread(body.threadId);
                sendSnapshot(response, snapshot);
                return;
            }
            if (url.pathname === "/api/thread/fork" && request.method === "POST") {
                const body = (await readJson(request));
                if (!body?.threadId) {
                    json(response, 400, { error: "threadId is required." });
                    return;
                }
                const snapshot = await bridge.forkThread(body.threadId);
                sendSnapshot(response, snapshot);
                return;
            }
            if (url.pathname === "/api/thread/read" && request.method === "POST") {
                const body = (await readJson(request));
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
                const payload = await (0, settings_store_1.readTerminalSettings)(node_process_1.default.cwd());
                json(response, 200, payload);
                return;
            }
            if (url.pathname === "/api/terminal/settings" && request.method === "POST") {
                const body = (await readJson(request));
                const payload = body?.reset
                    ? await (0, settings_store_1.writeTerminalSettings)((0, settings_store_1.resetTerminalSettings)(node_process_1.default.cwd()), node_process_1.default.cwd())
                    : await (0, settings_store_1.writeTerminalSettings)(body?.settings ?? {}, node_process_1.default.cwd());
                json(response, 200, payload);
                return;
            }
            if (url.pathname === "/api/config/read" && request.method === "GET") {
                const payload = await (0, settings_store_1.readTerminalSettings)(node_process_1.default.cwd());
                json(response, 200, {
                    path: payload.path,
                    settings: (0, windows_terminal_1.stringifyWindowsTerminalSettings)(payload.settings),
                });
                return;
            }
            if (url.pathname === "/api/config/write" && request.method === "POST") {
                const body = (await readJson(request));
                if (!body?.settings || typeof body.settings !== "string") {
                    json(response, 400, { error: "settings is required." });
                    return;
                }
                let parsed;
                try {
                    parsed = JSON.parse(body.settings);
                }
                catch (error) {
                    json(response, 400, {
                        error: error instanceof Error ? error.message : "Invalid settings JSON.",
                    });
                    return;
                }
                const payload = await (0, settings_store_1.writeTerminalSettings)(parsed, node_process_1.default.cwd());
                json(response, 200, {
                    path: payload.path,
                    settings: (0, windows_terminal_1.stringifyWindowsTerminalSettings)(payload.settings),
                });
                return;
            }
            if (url.pathname === "/api/turn/start" && request.method === "POST") {
                const body = (await readJson(request));
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
                const body = (await readJson(request));
                const snapshot = await bridge.setSessionSettings({
                    model: body && Object.prototype.hasOwnProperty.call(body, "model")
                        ? (body.model ?? null)
                        : undefined,
                    effort: body && Object.prototype.hasOwnProperty.call(body, "effort")
                        ? (body.effort ?? null)
                        : undefined,
                    fastMode: body && Object.prototype.hasOwnProperty.call(body, "fastMode")
                        ? Boolean(body.fastMode)
                        : undefined,
                    planMode: body && Object.prototype.hasOwnProperty.call(body, "planMode")
                        ? Boolean(body.planMode)
                        : undefined,
                });
                sendSnapshot(response, snapshot);
                return;
            }
            if (url.pathname === "/api/server-request/respond" && request.method === "POST") {
                const body = (await readJson(request));
                if (!body?.requestId) {
                    json(response, 400, { error: "requestId is required." });
                    return;
                }
                const snapshot = await bridge.respondToServerRequest(body.requestId, body.result ?? {});
                sendSnapshot(response, snapshot);
                return;
            }
            json(response, 404, { error: "Not found." });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unexpected server error.";
            json(response, 500, { error: message });
        }
    });
    const sockets = new Set();
    const wss = new ws_1.WebSocketServer({ noServer: true });
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
    await new Promise((resolve, reject) => {
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
            node_process_1.default.exit(0);
        });
    };
    node_process_1.default.on("SIGINT", () => {
        void shutdown();
    });
    node_process_1.default.on("SIGTERM", () => {
        void shutdown();
    });
    console.log(`legacy bridge listening on http://${host}:${port}`);
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    node_process_1.default.exit(1);
});
