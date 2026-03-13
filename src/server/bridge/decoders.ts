import { z } from "zod";

import {
  CodexThread,
  CodexThreadItem,
  CodexThreadStatus,
  CodexTurn,
  PendingRequestRecord,
  ThreadHeader,
} from "@/lib/types";

const requestIdSchema = z.union([z.string(), z.number()]);

const threadStatusSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const userInputSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const threadItemSchema: z.ZodType<CodexThreadItem> = z
  .object({
    type: z.string(),
    id: z.string(),
  })
  .passthrough() as z.ZodType<CodexThreadItem>;

const turnSchema: z.ZodType<CodexTurn> = z
  .object({
    id: z.string(),
    items: z.array(threadItemSchema).default([]),
    status: z.union([z.string(), z.object({ type: z.string() }).passthrough()]),
    error: z
      .object({
        message: z.string(),
        additionalDetails: z.string().nullable().optional(),
        codexErrorInfo: z.unknown().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough() as z.ZodType<CodexTurn>;

const threadSchema: z.ZodType<CodexThread> = z
  .object({
    id: z.string(),
    preview: z.string().default(""),
    ephemeral: z.boolean().default(false),
    modelProvider: z.string().default(""),
    createdAt: z.number().default(0),
    updatedAt: z.number().default(0),
    status: threadStatusSchema as z.ZodType<CodexThreadStatus>,
    path: z.string().nullable().optional(),
    cwd: z.string().default(""),
    cliVersion: z.string().default(""),
    source: z.unknown(),
    agentNickname: z.string().nullable().optional(),
    agentRole: z.string().nullable().optional(),
    gitInfo: z.record(z.string(), z.unknown()).nullable().optional(),
    name: z.string().nullable().optional(),
    turns: z.array(turnSchema).default([]),
  })
  .passthrough() as z.ZodType<CodexThread>;

const listResponseSchema = z.object({
  data: z.array(z.unknown()).default([]),
  nextCursor: z.string().nullable().optional(),
});

const rpcResponseSchema = z
  .object({
    id: requestIdSchema.optional(),
    result: z.unknown().optional(),
    error: z.unknown().optional(),
  })
  .passthrough();

const rpcMethodEnvelopeSchema = z
  .object({
    method: z.string(),
    params: z.unknown().optional(),
    id: requestIdSchema.optional(),
  })
  .passthrough();

export type RpcEnvelope =
  | { kind: "response"; id: string; result: unknown; error?: unknown }
  | { kind: "notification"; method: string; params: unknown }
  | { kind: "serverRequest"; id: string; method: string; params: unknown };

export function parseRpcEnvelope(line: string): RpcEnvelope {
  const parsedLine = JSON.parse(line) as unknown;
  const responseResult = rpcResponseSchema.safeParse(parsedLine);
  if (responseResult.success && responseResult.data.id !== undefined) {
    if ("method" in responseResult.data) {
      const methodResult = rpcMethodEnvelopeSchema.parse(parsedLine);
      return {
        kind: "serverRequest",
        id: String(methodResult.id),
        method: methodResult.method,
        params: methodResult.params,
      };
    }

    return {
      kind: "response",
      id: String(responseResult.data.id),
      result: responseResult.data.result,
      error: responseResult.data.error,
    };
  }

  const methodResult = rpcMethodEnvelopeSchema.parse(parsedLine);
  if (methodResult.id !== undefined) {
    return {
      kind: "serverRequest",
      id: String(methodResult.id),
      method: methodResult.method,
      params: methodResult.params,
    };
  }

  return {
    kind: "notification",
    method: methodResult.method,
    params: methodResult.params,
  };
}

export function decodeThread(raw: unknown) {
  return threadSchema.parse(raw);
}

export function decodeThreadListResponse(raw: unknown) {
  const parsed = listResponseSchema.parse(raw);
  return {
    data: parsed.data.map((thread) => decodeThread(thread)),
    nextCursor: parsed.nextCursor ?? null,
  };
}

export function decodeThreadResponse(raw: unknown) {
  return z
    .object({
      thread: threadSchema,
    })
    .parse(raw).thread;
}

export function decodeThreadOperationResponse(raw: unknown) {
  return z
    .object({
      thread: threadSchema,
      model: z.string().nullable().optional(),
      modelProvider: z.string().nullable().optional(),
      serviceTier: z.string().nullable().optional(),
      cwd: z.string().nullable().optional(),
      approvalPolicy: z.unknown().optional(),
      sandbox: z.unknown().optional(),
      reasoningEffort: z.string().nullable().optional(),
    })
    .passthrough()
    .parse(raw);
}

export function decodeTurnStartResponse(raw: unknown) {
  return z
    .object({
      turn: turnSchema,
    })
    .parse(raw).turn;
}

export function decodeReviewStartResponse(raw: unknown) {
  return z
    .object({
      turn: turnSchema,
      reviewThreadId: z.string(),
    })
    .parse(raw);
}

export function buildThreadHeader(operationResult: ReturnType<typeof decodeThreadOperationResponse>, cliVersion: string, thread: CodexThread): ThreadHeader {
  return {
    model: operationResult.model ?? null,
    modelProvider: operationResult.modelProvider ?? thread.modelProvider ?? null,
    serviceTier: operationResult.serviceTier ?? null,
    cwd: operationResult.cwd ?? thread.cwd,
    approvalPolicy: operationResult.approvalPolicy ?? null,
    sandbox: operationResult.sandbox ?? null,
    reasoningEffort: operationResult.reasoningEffort ?? null,
    gitInfo: thread.gitInfo ?? null,
    cliVersion: thread.cliVersion ?? cliVersion,
    threadStatus: thread.status,
    codexVersion: cliVersion,
  };
}

export function normalizePendingRequest(id: string, method: string, params: unknown): PendingRequestRecord {
  const parsed = z.record(z.string(), z.unknown()).default({}).parse(params ?? {});

  return {
    id,
    method,
    threadId: typeof parsed.threadId === "string" ? parsed.threadId : null,
    turnId: typeof parsed.turnId === "string" ? parsed.turnId : null,
    itemId: typeof parsed.itemId === "string" ? parsed.itemId : null,
    params: parsed,
    createdAt: Date.now(),
    resolvedAt: null,
  };
}

export function normalizeTurnItem(raw: unknown) {
  return threadItemSchema.parse(raw);
}

export function normalizeThreadStatus(raw: unknown) {
  return threadStatusSchema.parse(raw);
}

export function normalizeUserInput(raw: unknown) {
  return userInputSchema.parse(raw);
}
