import type {
  CFOAssistantResponse,
  FinancialAssistantIntent,
  ToolExecutionRecord,
} from "./types";
import type { CFOFallbackResponse } from "./pipeline/fallback";

export interface OrchestratorResult {
  conversationId: string;
  messageId: string;
  response: CFOAssistantResponse;
  intent: FinancialAssistantIntent;
  snapshotId: string;
  snapshotStale?: boolean;
  toolCalls: ToolExecutionRecord[];
  requestId?: string;
  source?: "AI" | "DETERMINISTIC_FALLBACK";
  fallback?: CFOFallbackResponse;
}
