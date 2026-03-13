import { IncomingMessage } from "node:http";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function normalizeHost(value: string) {
  return value.toLowerCase();
}

export class SecurityPolicy {
  constructor(
    private readonly options: {
      sessionSecret: string;
      host: string;
      port: number;
      allowedHosts?: string[];
      allowedOrigins?: string[];
    },
  ) {}

  assertApiAccess(request: IncomingMessage, allowBootstrap = false) {
    this.assertHost(request);

    const pathname = new URL(request.url ?? "/", `http://${this.options.host}:${this.options.port}`).pathname;
    if (allowBootstrap && pathname === "/api/bootstrap") {
      return;
    }

    this.assertSessionSecret(request);
    if ((request.method ?? "GET") !== "GET") {
      this.assertOrigin(request);
    }
  }

  assertWebSocketAccess(request: IncomingMessage) {
    this.assertHost(request);
    this.assertOrigin(request);

    const secret = new URL(request.url ?? "/", `http://${this.options.host}:${this.options.port}`).searchParams.get("sessionSecret");
    if (secret !== this.options.sessionSecret) {
      throw new HttpError(401, "Invalid realtime session secret.");
    }
  }

  private assertHost(request: IncomingMessage) {
    const hostHeader = request.headers.host;
    if (!hostHeader) {
      throw new HttpError(403, "Missing Host header.");
    }

    const allowedHosts = new Set(
      (this.options.allowedHosts ?? [
        `${this.options.host}:${this.options.port}`,
        `127.0.0.1:${this.options.port}`,
        `localhost:${this.options.port}`,
        `[::1]:${this.options.port}`,
      ]).map(normalizeHost),
    );

    if (!allowedHosts.has(normalizeHost(hostHeader))) {
      throw new HttpError(403, `Rejected Host header: ${hostHeader}`);
    }
  }

  private assertOrigin(request: IncomingMessage) {
    const origin = request.headers.origin;
    if (!origin) {
      throw new HttpError(403, "Missing Origin header.");
    }

    const parsed = new URL(origin);
    const allowedOrigins = new Set(
      (this.options.allowedOrigins ?? [
        `http://${this.options.host}:${this.options.port}`,
        `http://127.0.0.1:${this.options.port}`,
        `http://localhost:${this.options.port}`,
        `http://[::1]:${this.options.port}`,
      ]).map((value) => value.toLowerCase()),
    );

    if (!allowedOrigins.has(`${parsed.protocol}//${parsed.host}`)) {
      throw new HttpError(403, `Rejected Origin header: ${origin}`);
    }
  }

  private assertSessionSecret(request: IncomingMessage) {
    const provided = request.headers["x-codex-webui-session"];
    if (typeof provided !== "string" || provided !== this.options.sessionSecret) {
      throw new HttpError(401, "Missing or invalid session secret.");
    }
  }
}
