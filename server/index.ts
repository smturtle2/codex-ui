import os from "node:os";

import next from "next";

import { CodexBridge } from "@/server/bridge/codex-bridge";
import { createApplicationServer } from "@/server/http";
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

function getAccessibleUrls(host: string, port: number) {
  const urls = new Set<string>();

  if (host === "0.0.0.0") {
    urls.add(`http://localhost:${port}`);
    urls.add(`http://127.0.0.1:${port}`);
    for (const address of getInterfaceAddresses()) {
      urls.add(`http://${address}:${port}`);
    }
    return [...urls];
  }

  urls.add(`http://${host}:${port}`);
  if (host === "127.0.0.1") {
    urls.add(`http://localhost:${port}`);
  }
  return [...urls];
}

async function main() {
  const host = process.env.HOST ?? getDefaultHost();
  const port = Number(process.env.PORT ?? "3000");
  const dev = process.env.NODE_ENV !== "production";
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

  server.listen(port, host, () => {
    const urls = getAccessibleUrls(host, port);
    console.log(`codex-ui listening on ${urls[0]}`);
    if (urls.length > 1) {
      console.log(`codex-ui accessible urls: ${urls.slice(1).join(", ")}`);
    }
  });
}

void main();
