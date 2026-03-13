import { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";

import { parseRpcEnvelope } from "@/server/bridge/decoders";
import { DiagnosticsLogger } from "@/server/bridge/diagnostics-logger";

type PendingRequest = {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export declare interface JsonRpcClient {
  on(event: "notification", listener: (payload: { method: string; params: unknown }) => void | Promise<void>): this;
  on(event: "serverRequest", listener: (payload: { id: string; method: string; params: unknown }) => void | Promise<void>): this;
}

export class JsonRpcClient extends EventEmitter {
  private requestId = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutReader: readline.Interface | null = null;
  private stderrReader: readline.Interface | null = null;

  constructor(private readonly logger: DiagnosticsLogger) {
    super();
  }

  attach(child: ChildProcessWithoutNullStreams) {
    this.disposeReaders();
    this.child = child;

    this.stdoutReader = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    this.stderrReader = readline.createInterface({
      input: child.stderr,
      crlfDelay: Infinity,
    });

    this.stdoutReader.on("line", (line) => {
      if (!line.trim()) {
        return;
      }

      try {
        const envelope = parseRpcEnvelope(line);
        if (envelope.kind === "response") {
          const pending = this.pending.get(envelope.id);
          if (!pending) {
            return;
          }

          this.pending.delete(envelope.id);
          if (envelope.error) {
            pending.reject(new Error(JSON.stringify(envelope.error)));
          } else {
            pending.resolve(envelope.result);
          }
          return;
        }

        if (envelope.kind === "notification") {
          void this.emit("notification", {
            method: envelope.method,
            params: envelope.params,
          });
          return;
        }

        void this.emit("serverRequest", {
          id: envelope.id,
          method: envelope.method,
          params: envelope.params,
        });
      } catch (error) {
        this.logger.error("bridge", "Failed to decode app-server stdout line", {
          line,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.stderrReader.on("line", (line) => {
      if (!line.trim()) {
        return;
      }

      let payload: unknown = line;
      try {
        payload = JSON.parse(line);
      } catch {
        payload = line;
      }
      this.logger.info("app-server", "stderr", payload);
    });

    child.on("exit", () => {
      for (const [id, pending] of this.pending) {
        pending.reject(new Error(`Request ${id} interrupted by process exit.`));
      }
      this.pending.clear();
      this.disposeReaders();
    });
  }

  async request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = String(++this.requestId);
    const child = this.assertChild();

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        method,
        resolve: (value) => resolve(value as T),
        reject,
      });

      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  notify(method: string, params?: unknown) {
    const child = this.assertChild();
    const envelope = params === undefined ? { jsonrpc: "2.0", method } : { jsonrpc: "2.0", method, params };
    child.stdin.write(`${JSON.stringify(envelope)}\n`);
  }

  respond(id: string, result: unknown) {
    const child = this.assertChild();
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
  }

  private assertChild() {
    if (!this.child) {
      throw new Error("JSON-RPC client is not attached to a process.");
    }
    return this.child;
  }

  private disposeReaders() {
    this.stdoutReader?.removeAllListeners();
    this.stderrReader?.removeAllListeners();
    this.stdoutReader?.close();
    this.stderrReader?.close();
    this.stdoutReader = null;
    this.stderrReader = null;
  }
}
