import os from "node:os";

import { ConnectionInfo } from "@/lib/types";

interface ConnectionManagerOptions {
  host: string;
  port: number;
}

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

function buildStandardUrls(host: string, port: number) {
  const urls = new Set<string>();

  if (host === "0.0.0.0") {
    urls.add(`http://127.0.0.1:${port}`);
    urls.add(`http://localhost:${port}`);
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

export class ConnectionManager {
  private info: ConnectionInfo;

  constructor(private readonly options: ConnectionManagerOptions) {
    this.info = this.buildInfo();
  }

  async initialize() {
    this.info = this.buildInfo();
    return this.info;
  }

  async stop() {}

  getConnectionInfo() {
    return this.info;
  }

  private buildInfo(): ConnectionInfo {
    if (detectWsl() && this.options.host === "0.0.0.0") {
      const reachableUrls = getInterfaceAddresses().map((address) => `http://${address}:${this.options.port}`);
      return {
        bindHost: this.options.host,
        port: this.options.port,
        preferredUrl: reachableUrls[0] ?? `http://127.0.0.1:${this.options.port}`,
        reachableUrls: reachableUrls.length > 0 ? reachableUrls : [`http://127.0.0.1:${this.options.port}`],
        loopbackMode: "unavailable",
      };
    }

    const reachableUrls = buildStandardUrls(this.options.host, this.options.port);
    return {
      bindHost: this.options.host,
      port: this.options.port,
      preferredUrl: reachableUrls[0] ?? `http://${this.options.host}:${this.options.port}`,
      reachableUrls,
      loopbackMode: this.options.host === "127.0.0.1" ? "native" : "not_applicable",
    };
  }
}
