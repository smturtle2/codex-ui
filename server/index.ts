import os from "node:os";

import next from "next";

import { CodexBridge } from "@/server/bridge/codex-bridge";
import { createApplicationServer } from "@/server/http";
import { ConnectionManager } from "@/server/runtime/connection-manager";
import { SecurityPolicy } from "@/server/security";

function detectWsl() {
  return Boolean(process.env.WSL_DISTRO_NAME) || os.release().toLowerCase().includes("microsoft");
}

function getInterfaceAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

function getDefaultHost() {
  return detectWsl() ? "0.0.0.0" : "127.0.0.1";
}

function getAllowedHosts(host: string, port: number) {
  const hosts = new Set<string>([
    `${host}:${port}`,
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ]);

  for (const address of getInterfaceAddresses()) {
    hosts.add(`${address}:${port}`);
  }

  return [...hosts];
}

async function main() {
  const host = process.env.HOST ?? getDefaultHost();
  const port = Number(process.env.PORT ?? "3000");
  const dev = process.env.NODE_ENV !== "production";
  const connectionManager = new ConnectionManager({
    host,
    port,
  });
  const allowedHosts = getAllowedHosts(host, port);
  const allowedOrigins = allowedHosts.map((value) => `http://${value}`);

  const app = next({
    dev,
    hostname: host,
    port,
  });

  await app.prepare();
  const handle = app.getRequestHandler();
  const bridge = await CodexBridge.create({
    launcherCwd: process.cwd(),
    host,
    port,
    getConnectionInfo: () => connectionManager.getConnectionInfo(),
  });
  const security = new SecurityPolicy({
    sessionSecret: bridge.getSessionSecret(),
    host,
    port,
    allowedHosts,
    allowedOrigins,
  });
  const server = createApplicationServer({
    bridge,
    nextHandle: handle,
    security,
    host,
    port,
  });

  const shutdown = async () => {
    await connectionManager.stop();
    await bridge.stop();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  await connectionManager.initialize();
  const connection = connectionManager.getConnectionInfo();
  bridge.logger.info("bridge", "Connection info ready.", connection);

  console.log(`codex-ui listening on ${connection.preferredUrl}`);
  if (connection.reachableUrls.length > 1) {
    console.log(`codex-ui accessible urls: ${connection.reachableUrls.filter((url) => url !== connection.preferredUrl).join(", ")}`);
  }
}

void main();
