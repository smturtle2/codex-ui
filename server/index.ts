import next from "next";

import { CodexBridge } from "@/server/bridge/codex-bridge";
import { createApplicationServer } from "@/server/http";
import { SecurityPolicy } from "@/server/security";

async function main() {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? "3000");
  const dev = process.env.NODE_ENV !== "production";

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
    console.log(`codex-ui listening on http://${host}:${port}`);
  });
}

void main();
