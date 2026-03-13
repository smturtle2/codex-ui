import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const runIntegration = process.env.RUN_CODEX_INTEGRATION === "1";

class IntegrationRpcClient {
  private requestId = 0;
  private readonly pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private readonly notifications: Array<{ method: string; params: unknown }> = [];
  private readonly notificationWaiters = new Map<string, Array<() => void>>();
  private readonly stdoutReader;

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    this.stdoutReader = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });
    this.stdoutReader.on("line", (line) => {
      const payload = JSON.parse(line) as Record<string, unknown>;
      if ("id" in payload && !("method" in payload)) {
        const pending = this.pending.get(String(payload.id));
        if (pending) {
          this.pending.delete(String(payload.id));
          if ("error" in payload && payload.error) {
            const message =
              payload.error && typeof payload.error === "object" && "message" in payload.error
                ? String(payload.error.message)
                : JSON.stringify(payload.error);
            pending.reject(new Error(message));
          } else {
            pending.resolve(payload.result);
          }
        }
        return;
      }
      if ("method" in payload) {
        const notification = {
          method: String(payload.method),
          params: payload.params,
        };
        this.notifications.push(notification);
        const waiters = this.notificationWaiters.get(notification.method) ?? [];
        for (const resolve of waiters) {
          resolve();
        }
        this.notificationWaiters.delete(notification.method);
      }
    });
  }

  request(method: string, params: unknown) {
    const id = String(++this.requestId);
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params?: unknown) {
    const payload = params === undefined ? { jsonrpc: "2.0", method } : { jsonrpc: "2.0", method, params };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  getNotifications() {
    return [...this.notifications];
  }

  waitForNotification(method: string, timeoutMs = 1_000) {
    if (this.notifications.some((notification) => notification.method === method)) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const current = this.notificationWaiters.get(method) ?? [];
        this.notificationWaiters.set(
          method,
          current.filter((waiter) => waiter !== handleResolve),
        );
        reject(new Error(`Timed out waiting for notification ${method}`));
      }, timeoutMs);

      const handleResolve = () => {
        clearTimeout(timeout);
        resolve();
      };

      const current = this.notificationWaiters.get(method) ?? [];
      this.notificationWaiters.set(method, [...current, handleResolve]);
    });
  }
}

describe.skipIf(!runIntegration)("real app-server integration", () => {
  let child: ChildProcessWithoutNullStreams;
  let rpc: IntegrationRpcClient;

  beforeAll(async () => {
    child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOG_FORMAT: "json",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    rpc = new IntegrationRpcClient(child);
    await rpc.request("initialize", {
      clientInfo: {
        name: "codex_webui_test",
        title: "Codex WebUI Test",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
        optOutNotificationMethods: [],
      },
    });
    rpc.notify("initialized");
  });

  afterAll(() => {
    child.kill("SIGTERM");
  });

  it("bootstraps account and config", async () => {
    const account = (await rpc.request("account/read", { refreshToken: false })) as {
      requiresOpenaiAuth: boolean;
    };
    const config = (await rpc.request("config/read", {})) as {
      config: Record<string, unknown>;
    };

    expect(account).toHaveProperty("requiresOpenaiAuth");
    expect(config.config).toBeTypeOf("object");
  });

  it("supports empty-thread lifecycle methods on the real child process", async () => {
    const started = (await rpc.request("thread/start", {
      cwd: process.cwd(),
      serviceName: "codex_webui",
      experimentalRawEvents: false,
      persistExtendedHistory: true,
    })) as {
      thread: { id: string };
    };

    expect(started.thread.id).toBeTruthy();

    await expect(
      rpc.request("thread/read", {
        threadId: started.thread.id,
        includeTurns: true,
      }),
    ).rejects.toThrow(/includeTurns is unavailable before first user message/);

    const read = (await rpc.request("thread/read", {
      threadId: started.thread.id,
      includeTurns: false,
    })) as {
      thread: { id: string };
    };
    expect(read.thread.id).toBe(started.thread.id);

    await rpc.request("thread/name/set", {
      threadId: started.thread.id,
      name: "Integration Thread",
    });
    await rpc.waitForNotification("thread/name/updated");

    const notifications = rpc.getNotifications().map((entry) => entry.method);
    expect(notifications).toContain("thread/name/updated");
  });
});
