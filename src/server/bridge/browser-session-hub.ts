import { EventEmitter } from "node:events";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import { WebSocket, WebSocketServer } from "ws";

import { BrowserRealtimeClientMessage, BrowserRealtimeServerMessage, GlobalRealtimeEvent, ThreadRealtimeEvent } from "@/lib/types";
import { ThreadRegistry } from "@/server/bridge/thread-registry";

type GlobalSnapshotPayload = Extract<BrowserRealtimeServerMessage, { type: "global.snapshot" }>["snapshot"];

interface BrowserSessionHubOptions {
  threadRegistry: ThreadRegistry;
  getGlobalSnapshot: () => GlobalSnapshotPayload;
  onThreadSubscriptionChanged?: (threadId: string) => void;
  sessionId: string;
}

type ClientSession = {
  socket: WebSocket;
  subscriptions: Set<string>;
};

const GLOBAL_RING_LIMIT = 500;

export class BrowserSessionHub extends EventEmitter {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly sessions = new Set<ClientSession>();
  private globalSeq = 0;
  private readonly globalRing: Array<{ seq: number; event: GlobalRealtimeEvent }> = [];

  constructor(private readonly options: BrowserSessionHubOptions) {
    super();
    this.wss.on("connection", (socket) => {
      const session: ClientSession = {
        socket,
        subscriptions: new Set(),
      };
      this.sessions.add(session);

      this.send(session.socket, {
        type: "hello",
        sessionId: this.options.sessionId,
      });

      this.sendGlobalSnapshot(session.socket);

      socket.on("message", (buffer) => {
        this.handleMessage(session, buffer.toString());
      });

      socket.on("close", () => {
        for (const threadId of session.subscriptions) {
          this.options.threadRegistry.decrementSubscribers(threadId);
          this.options.onThreadSubscriptionChanged?.(threadId);
        }
        this.sessions.delete(session);
      });
    });
  }

  handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer) {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit("connection", ws, request);
    });
  }

  broadcastThreadEvent(threadId: string, seq: number, event: ThreadRealtimeEvent) {
    for (const session of this.sessions) {
      if (!session.subscriptions.has(threadId)) {
        continue;
      }

      this.send(session.socket, {
        type: "thread.event",
        threadId,
        seq,
        event,
      });
    }
  }

  broadcastGlobalEvent(event: GlobalRealtimeEvent) {
    this.globalSeq += 1;
    this.globalRing.push({
      seq: this.globalSeq,
      event,
    });
    if (this.globalRing.length > GLOBAL_RING_LIMIT) {
      this.globalRing.splice(0, this.globalRing.length - GLOBAL_RING_LIMIT);
    }

    for (const session of this.sessions) {
      this.send(session.socket, {
        type: "global.event",
        seq: this.globalSeq,
        event,
      });
    }
  }

  private handleMessage(session: ClientSession, rawMessage: string) {
    let message: BrowserRealtimeClientMessage;
    try {
      message = JSON.parse(rawMessage) as BrowserRealtimeClientMessage;
    } catch {
      return;
    }

    if (message.type === "ping") {
      this.send(session.socket, {
        type: "pong",
        at: Date.now(),
      });
      return;
    }

    if (message.type === "unsubscribe") {
      if (session.subscriptions.delete(message.threadId)) {
        this.options.threadRegistry.decrementSubscribers(message.threadId);
        this.options.onThreadSubscriptionChanged?.(message.threadId);
      }
      return;
    }

    if (message.type !== "subscribe") {
      return;
    }

    const runtime = this.options.threadRegistry.get(message.threadId);
    if (!runtime) {
      return;
    }

    if (!session.subscriptions.has(message.threadId)) {
      session.subscriptions.add(message.threadId);
      this.options.threadRegistry.incrementSubscribers(message.threadId);
      this.options.onThreadSubscriptionChanged?.(message.threadId);
    }

    const requestedSeq = message.lastSeenSeq ?? null;
    if (requestedSeq !== null) {
      const replay = this.options.threadRegistry.getReplay(message.threadId, requestedSeq);
      if (replay === null) {
        this.send(session.socket, {
          type: "thread.resync_required",
          threadId: message.threadId,
        });
        this.send(session.socket, {
          type: "thread.snapshot",
          threadId: message.threadId,
          seq: runtime.seq,
          snapshot: runtime.state,
        });
        return;
      }

      if (replay.length > 0) {
        for (const entry of replay) {
          this.send(session.socket, {
            type: "thread.event",
            threadId: message.threadId,
            seq: entry.seq,
            event: entry.event,
          });
        }
        return;
      }
    }

    this.send(session.socket, {
      type: "thread.snapshot",
      threadId: message.threadId,
      seq: runtime.seq,
      snapshot: runtime.state,
    });
  }

  private sendGlobalSnapshot(socket: WebSocket) {
    this.send(socket, {
      type: "global.snapshot",
      snapshot: this.options.getGlobalSnapshot(),
      seq: this.globalSeq,
    });
  }

  private send(socket: WebSocket, payload: BrowserRealtimeServerMessage) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  }
}
