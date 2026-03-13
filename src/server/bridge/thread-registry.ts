import { applyThreadEvent, createThreadState } from "@/lib/thread-state";
import { CodexThread, ThreadHeader, ThreadRealtimeEvent, ThreadViewState } from "@/lib/types";

const THREAD_RING_BUFFER_LIMIT = 500;

export interface ThreadRuntimeRecord {
  state: ThreadViewState;
  seq: number;
  ring: Array<{ seq: number; event: ThreadRealtimeEvent }>;
  loaded: boolean;
  subscriberCount: number;
  lastTouched: number;
}

export class ThreadRegistry {
  private readonly threads = new Map<string, ThreadRuntimeRecord>();

  hydrate(thread: CodexThread, header: ThreadHeader | null, loaded: boolean) {
    const existing = this.threads.get(thread.id);
    const nextState = createThreadState(thread, header ?? existing?.state.header ?? null);
    const mergedState: ThreadViewState = existing
      ? {
          ...existing.state,
          thread,
          header: header ?? existing.state.header,
          reviews: { ...existing.state.reviews, ...nextState.reviews },
        }
      : nextState;

    const record: ThreadRuntimeRecord = {
      state: mergedState,
      seq: existing?.seq ?? 0,
      ring: existing?.ring ?? [],
      loaded,
      subscriberCount: existing?.subscriberCount ?? 0,
      lastTouched: Date.now(),
    };

    this.threads.set(thread.id, record);
    return record;
  }

  get(threadId: string) {
    return this.threads.get(threadId) ?? null;
  }

  getSnapshot(threadId: string) {
    return this.threads.get(threadId)?.state ?? null;
  }

  setLoaded(threadId: string, loaded: boolean) {
    const record = this.threads.get(threadId);
    if (!record) {
      return;
    }
    record.loaded = loaded;
    record.lastTouched = Date.now();
  }

  touch(threadId: string) {
    const record = this.threads.get(threadId);
    if (record) {
      record.lastTouched = Date.now();
    }
  }

  applyEvent(threadId: string, event: ThreadRealtimeEvent) {
    const record = this.threads.get(threadId);
    if (!record) {
      return null;
    }

    record.seq += 1;
    record.state = applyThreadEvent(record.state, event);
    record.state.lastSeq = record.seq;
    record.ring.push({ seq: record.seq, event });
    if (record.ring.length > THREAD_RING_BUFFER_LIMIT) {
      record.ring.splice(0, record.ring.length - THREAD_RING_BUFFER_LIMIT);
    }
    record.lastTouched = Date.now();
    return {
      seq: record.seq,
      snapshot: record.state,
    };
  }

  getReplay(threadId: string, lastSeenSeq: number) {
    const record = this.threads.get(threadId);
    if (!record) {
      return null;
    }

    if (lastSeenSeq >= record.seq) {
      return [];
    }

    const earliestSeq = record.ring[0]?.seq ?? record.seq;
    if (lastSeenSeq < earliestSeq - 1) {
      return null;
    }

    return record.ring.filter((entry) => entry.seq > lastSeenSeq);
  }

  incrementSubscribers(threadId: string) {
    const record = this.threads.get(threadId);
    if (!record) {
      return;
    }
    record.subscriberCount += 1;
    record.lastTouched = Date.now();
  }

  decrementSubscribers(threadId: string) {
    const record = this.threads.get(threadId);
    if (!record) {
      return;
    }
    record.subscriberCount = Math.max(0, record.subscriberCount - 1);
    record.lastTouched = Date.now();
  }

  listLoaded() {
    return [...this.threads.entries()].filter(([, record]) => record.loaded);
  }

  markDisconnectedAll(reason: string) {
    const updates: Array<{ threadId: string; seq: number; snapshot: ThreadViewState; event: ThreadRealtimeEvent }> = [];
    for (const [threadId] of this.threads) {
      const applied = this.applyEvent(threadId, {
        kind: "thread.disconnected",
        threadId,
        reason,
      });
      if (!applied) {
        continue;
      }
      const record = this.threads.get(threadId);
      if (!record) {
        continue;
      }
      record.loaded = false;
      updates.push({
        threadId,
        seq: applied.seq,
        snapshot: applied.snapshot,
        event: {
          kind: "thread.disconnected",
          threadId,
          reason,
        },
      });
    }
    return updates;
  }
}
