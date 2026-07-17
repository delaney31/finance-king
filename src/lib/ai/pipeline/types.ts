import type { CFOAssistantResponse, ToolExecutionRecord } from "../types";
import type { CFOFallbackResponse } from "./fallback";

export type CFORequestPayload = {
  message: string;
  conversationId?: string;
  financialSnapshotId?: string;
  idempotencyKey: string;
  skipAI?: boolean;
};

export type CFOAskSuccessResponse = {
  success: true;
  requestId: string;
  source: "AI" | "DETERMINISTIC_FALLBACK";
  conversationId: string;
  messageId: string;
  snapshotId: string;
  snapshotStale?: boolean;
  answer: CFOAssistantResponse;
  stages?: Array<{ stage: string; durationMs?: number }>;
};

export type CFOAskErrorResponse = {
  success: false;
  requestId: string;
  error: {
    category: string;
    message: string;
    retryable: boolean;
  };
  fallback?: CFOFallbackResponse;
};

export type CFOAskResponse = CFOAskSuccessResponse | CFOAskErrorResponse;

export type ProcessCFORequestOptions = {
  userId: string;
  question: string;
  conversationId?: string;
  requestId?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
  skipAI?: boolean;
};

export type ProcessCFORequestResult = {
  conversationId: string;
  messageId: string;
  response: CFOAssistantResponse;
  intent: string;
  snapshotId: string;
  snapshotStale?: boolean;
  toolCalls: ToolExecutionRecord[];
  requestId: string;
  source: "AI" | "DETERMINISTIC_FALLBACK";
  fallback?: CFOFallbackResponse;
};
