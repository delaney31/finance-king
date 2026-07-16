export type FinancialAssistantIntent =
  | "SAFE_TO_SPEND"
  | "CAN_I_AFFORD"
  | "EXPLAIN_METRIC"
  | "DEBT_PAYMENT"
  | "CREDIT_UTILIZATION"
  | "OVERDRAFT_RISK"
  | "INCOME_DELAY"
  | "UPCOMING_BILLS"
  | "MONTHLY_REVIEW"
  | "ACCOUNT_ROUTING"
  | "GENERAL_FINANCIAL_QUESTION"
  | "UNKNOWN";

export type CFORecommendation =
  | "PROCEED"
  | "PROCEED_WITH_LIMIT"
  | "DELAY"
  | "DECLINE"
  | "INFORMATION_ONLY";

export interface FinancialToolResult<T> {
  data: T;
  warnings: string[];
  assumptions: string[];
  calculatedAt: string;
  sourceSnapshotId: string;
}

export interface CFOAssistantResponse {
  answer: string;
  recommendation: CFORecommendation;
  safeToSpendToday?: number;
  safeToSpendThisWeek?: number;
  safeToSpendThisMonth?: number;
  recommendedAmount?: number;
  recommendedAccountId?: string;
  monthEndImpact?: number;
  yearEndImpact?: number;
  emergencyReserveAffected: boolean;
  taxReserveAffected: boolean;
  nextBillsCovered: boolean;
  warnings: string[];
  assumptions: string[];
  supportingCalculations: Array<{
    label: string;
    amount?: number;
    description?: string;
  }>;
  suggestedFollowUpQuestions: string[];
}

export interface IntentRequest {
  question: string;
  conversationHistory?: { role: string; content: string }[];
}

export interface IntentResult {
  intent: FinancialAssistantIntent;
  confidence: number;
  extractedParams: Record<string, unknown>;
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}

export interface StructuredAIRequest<_T = unknown> {
  systemPrompt: string;
  userPrompt: string;
  schema: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  classifyIntent(input: IntentRequest): Promise<IntentResult>;
  generateStructuredResponse<T>(request: StructuredAIRequest<T>): Promise<{ data: T; usage: TokenUsage }>;
}

export interface ToolExecutionRecord {
  toolName: string;
  arguments: Record<string, unknown>;
  result: FinancialToolResult<unknown>;
  durationMs: number;
}

export const EDUCATIONAL_DISCLAIMER =
  "This assistant provides educational financial guidance, not fiduciary, legal, tax, or credit-repair advice.";
