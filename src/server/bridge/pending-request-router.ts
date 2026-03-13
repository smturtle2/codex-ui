import { normalizePendingRequest } from "@/server/bridge/decoders";

export class PendingRequestRouter {
  private readonly byId = new Map<string, ReturnType<typeof normalizePendingRequest>>();

  register(id: string, method: string, params: unknown) {
    const record = normalizePendingRequest(id, method, params);
    this.byId.set(id, record);
    return record;
  }

  resolve(id: string) {
    const existing = this.byId.get(id);
    if (!existing) {
      return null;
    }

    const resolved = {
      ...existing,
      resolvedAt: Date.now(),
    };
    this.byId.delete(id);
    return resolved;
  }

  get(id: string) {
    return this.byId.get(id) ?? null;
  }

  list() {
    return [...this.byId.values()].sort((left, right) => left.createdAt - right.createdAt);
  }

  clear() {
    this.byId.clear();
  }
}
