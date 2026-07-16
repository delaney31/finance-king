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

export type CFOCompactVerdict =
  | "GO_AHEAD"
  | "GO_AHEAD_WITH_LIMIT"
  | "REDUCE_BUDGET"
  | "WAIT"
  | "NOT_YET"
  | "NEED_MORE_INFORMATION";

export type CFOReasonPrimary =
  | "UPCOMING_BILLS_UNDERFUNDED"
  | "ACCOUNT_FLOOR_BREACHED"
  | "EMERGENCY_RESERVE_TOUCHED"
  | "TAX_RESERVE_TOUCHED"
  | "INSUFFICIENT_CLEARED_CASH"
  | "PENDING_INCOME_REQUIRED"
  | "BUSINESS_FUNDS_NOT_AVAILABLE_PERSONALLY"
  | "OVERDRAFT_RISK"
  | "BUDGET_EXCEEDED"
  | "OTHER";

export type CFOAffordabilityTriggerType =
  | "INCOME_CLEARS"
  | "BILL_IS_PAID"
  | "DATE_REACHED"
  | "BUDGET_REDUCED"
  | "ACCOUNT_TRANSFER"
  | "DATA_CONFIRMED";

export type CFOReasonBreakdownStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "SHORTFALL"
  | "PROTECTED";

export interface CFOReasonDetail {
  primaryReason: CFOReasonPrimary;
  explanation: string;
  affectedAccount?: string;
  affectedObligation?: string;
  affectedDate?: string;
  shortfallAmount?: number;
  maximumSafeAmount?: number;
  affordabilityTrigger?: {
    type: CFOAffordabilityTriggerType;
    description: string;
    amount?: number;
    date?: string;
  };
  breakdown: Array<{
    label: string;
    amount: number;
    status?: CFOReasonBreakdownStatus;
  }>;
}

export interface CFOCompactAnswer {
  question: string;
  verdict: CFOCompactVerdict;
  headline: string;
  advice: string;
  reason: string;
  reasonDetail: CFOReasonDetail;
  affordableNow?: string;
  affordableAfter?: string;
  status: "SAFE" | "CAUTION" | "RISK" | "UNKNOWN";
  primaryMetrics: Array<{
    label: string;
    value: string;
    change?: string;
  }>;
  protectionChecks: Array<{
    label: string;
    status: "PASS" | "WARN" | "FAIL";
  }>;
  details: {
    recommendedAccount?: string;
    cost?: number;
    monthEndImpact?: number;
    yearEndImpact?: number;
    upcomingBills?: Array<{
      label: string;
      amount: number;
      dueDate?: string;
    }>;
    assumptions?: string[];
    supportingCalculations?: Array<{
      label: string;
      amount?: number;
      description?: string;
    }>;
    snapshotDate?: string;
    warnings?: string[];
  };
  suggestedQuestions: string[];
}

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
  compact?: CFOCompactAnswer;
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
