import { EventEmitter } from "node:events";

import { LogEntry } from "@/lib/types";

const LOG_BUFFER_LIMIT = 500;

export declare interface DiagnosticsLogger {
  on(event: "entry", listener: (entry: LogEntry) => void): this;
}

export class DiagnosticsLogger extends EventEmitter {
  private readonly entries: LogEntry[] = [];

  private log(source: LogEntry["source"], level: LogEntry["level"], message: string, payload: unknown = null, threadId: string | null = null) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      at: Date.now(),
      source,
      level,
      message,
      threadId,
      payload,
    };

    this.entries.push(entry);
    if (this.entries.length > LOG_BUFFER_LIMIT) {
      this.entries.splice(0, this.entries.length - LOG_BUFFER_LIMIT);
    }
    this.emit("entry", entry);
    return entry;
  }

  info(source: LogEntry["source"], message: string, payload: unknown = null, threadId: string | null = null) {
    return this.log(source, "info", message, payload, threadId);
  }

  warn(source: LogEntry["source"], message: string, payload: unknown = null, threadId: string | null = null) {
    return this.log(source, "warn", message, payload, threadId);
  }

  error(source: LogEntry["source"], message: string, payload: unknown = null, threadId: string | null = null) {
    return this.log(source, "error", message, payload, threadId);
  }

  debug(source: LogEntry["source"], message: string, payload: unknown = null, threadId: string | null = null) {
    return this.log(source, "debug", message, payload, threadId);
  }

  list() {
    return [...this.entries];
  }
}
