import { processCFORequest } from "./pipeline/process-request";
import type { OrchestratorResult } from "./orchestrator-types";

export type { OrchestratorResult } from "./orchestrator-types";

export async function processCFOQuestion(params: {
  userId: string;
  question: string;
  conversationId?: string;
  requestId?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
  skipAI?: boolean;
}): Promise<OrchestratorResult> {
  const result = await processCFORequest(params);
  return {
    conversationId: result.conversationId,
    messageId: result.messageId,
    response: result.response,
    intent: result.intent as OrchestratorResult["intent"],
    snapshotId: result.snapshotId,
    snapshotStale: result.snapshotStale,
    toolCalls: result.toolCalls,
    requestId: result.requestId,
    source: result.source,
    fallback: result.fallback,
  };
}

export { getConversation, submitFeedback, listConversations } from "./orchestrator-legacy";
