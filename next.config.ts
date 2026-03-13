import os from "node:os";

import type { NextConfig } from "next";

function getAllowedDevOrigins() {
  const hosts = new Set<string>();

  const configuredHost = process.env.HOST;
  if (configuredHost && configuredHost !== "0.0.0.0") {
    hosts.add(configuredHost);
  }

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        hosts.add(entry.address);
      }
    }
  }

  return [...hosts];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: getAllowedDevOrigins(),
};

export default nextConfig;
