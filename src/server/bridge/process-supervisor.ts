import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir } from "node:fs/promises";

import { DiagnosticsLogger } from "@/server/bridge/diagnostics-logger";

interface ProcessSupervisorOptions {
  cwd: string;
  codexHome: string;
  codexSqliteHome: string;
  logger: DiagnosticsLogger;
}

interface SpawnEvent {
  child: ChildProcessWithoutNullStreams;
  restarted: boolean;
}

export declare interface ProcessSupervisor {
  on(event: "spawn", listener: (payload: SpawnEvent) => void | Promise<void>): this;
  on(event: "fatal", listener: (payload: { code: number | null; signal: NodeJS.Signals | null }) => void): this;
  on(event: "restarting", listener: () => void): this;
}

export class ProcessSupervisor extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private restartCount = 0;
  private stopping = false;

  constructor(private readonly options: ProcessSupervisorOptions) {
    super();
  }

  async start() {
    await mkdir(this.options.codexHome, { recursive: true });
    await mkdir(this.options.codexSqliteHome, { recursive: true });
    await this.spawnChild(false);
  }

  async stop() {
    this.stopping = true;
    this.child?.kill("SIGTERM");
  }

  private async spawnChild(restarted: boolean) {
    this.options.logger.info("bridge", restarted ? "Restarting codex app-server" : "Starting codex app-server");
    const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        CODEX_HOME: this.options.codexHome,
        CODEX_SQLITE_HOME: this.options.codexSqliteHome,
        LOG_FORMAT: "json",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child = child;

    child.on("exit", (code, signal) => {
      this.options.logger.warn("bridge", "codex app-server exited", { code, signal });
      if (this.stopping) {
        return;
      }

      if (this.restartCount < 1) {
        this.restartCount += 1;
        this.emit("restarting");
        void this.spawnChild(true);
        return;
      }

      this.emit("fatal", { code, signal });
    });

    this.emit("spawn", { child, restarted });
  }
}
