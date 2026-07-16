import type {
  AIProvider,
  FinancialAssistantIntent,
  IntentRequest,
  IntentResult,
  StructuredAIRequest,
  TokenUsage,
} from "../types";
import { intentResultSchema } from "../schemas";

const INTENT_PATTERNS: { intent: FinancialAssistantIntent; patterns: RegExp[] }[] = [
  {
    intent: "SAFE_TO_SPEND",
    patterns: [
      /safe(ly)?\s*(to\s*)?spend/i,
      /how\s+much\s+can\s+i\s+(safely\s+)?spend/i,
      /spending\s+limit/i,
    ],
  },
  {
    intent: "CAN_I_AFFORD",
    patterns: [
      /can\s+i\s+afford/i,
      /can\s+i\s+take/i,
      /can\s+.+\s+spend\s+\$/i,
      /afford\s+(dinner|disneyland|advertising|wrap|car\s+week|road\s+trip)/i,
      /should\s+i\s+buy/i,
    ],
  },
  {
    intent: "EXPLAIN_METRIC",
    patterns: [
      /why\s+(is|did|was)/i,
      /explain\s+(my|the)/i,
      /how\s+was\s+.+\s+calculated/i,
      /why\s+.*\s+(low|decrease|lower)/i,
    ],
  },
  {
    intent: "DEBT_PAYMENT",
    patterns: [
      /how\s+much\s+should\s+i\s+pay\s+(toward|to)/i,
      /debt\s+payment/i,
      /pay\s+(off|down)\s+.+(amex|card|loan)/i,
      /reduce\s+debt/i,
      /avalanche|snowball/i,
    ],
  },
  {
    intent: "CREDIT_UTILIZATION",
    patterns: [/credit\s+utilization/i, /utilization/i, /credit\s+score/i],
  },
  {
    intent: "OVERDRAFT_RISK",
    patterns: [
      /overdraft/i,
      /at\s+risk/i,
      /which\s+account\s+needs\s+money/i,
      /low\s+balance/i,
    ],
  },
  {
    intent: "INCOME_DELAY",
    patterns: [
      /income\s+delay/i,
      /payment\s+(is\s+)?delayed/i,
      /contract\s+payment.*late/i,
      /what\s+happens\s+if.*(deposit|payment|income)/i,
    ],
  },
  {
    intent: "UPCOMING_BILLS",
    patterns: [/upcoming\s+bill/i, /next\s+(major\s+)?obligation/i, /what\s+bills/i],
  },
  {
    intent: "MONTHLY_REVIEW",
    patterns: [/monthly\s+review/i, /month\s+summary/i, /how\s+did\s+i\s+do\s+this\s+month/i],
  },
  {
    intent: "ACCOUNT_ROUTING",
    patterns: [
      /which\s+account\s+should\s+pay/i,
      /what\s+account\s+for/i,
      /pay\s+.+\s+from\s+which/i,
    ],
  },
];

function extractAmount(question: string): number | undefined {
  const match = question.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
  if (!match) return undefined;
  return Number(match[1].replace(/,/g, ""));
}

function extractPurchaseName(question: string): string | undefined {
  const affordMatch = question.match(/afford\s+(?:the\s+)?(.+?)(?:\?|$|\s+for|\s+next)/i);
  if (affordMatch) return affordMatch[1].trim();
  const takeMatch = question.match(/take\s+(?:my\s+)?(?:\w+\s+)?to\s+(.+?)(?:\?|$)/i);
  if (takeMatch) return takeMatch[1].trim();
  const spendMatch = question.match(/spend\s+\$[\d,]+(?:\.\d{2})?\s+on\s+(.+?)(?:\?|$)/i);
  if (spendMatch) return spendMatch[1].trim();
  return undefined;
}

function extractMetricName(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("safe-to-spend") || q.includes("safe to spend")) return "safe_to_spend";
  if (q.includes("month-end") || q.includes("month end")) return "month_end_buffer";
  if (q.includes("year-end") || q.includes("year end")) return "year_end_buffer";
  if (q.includes("overdraft") || q.includes("at risk")) return "overdraft_risk";
  if (q.includes("utilization")) return "credit_utilization";
  return "safe_to_spend";
}

function extractDebtName(question: string): string | undefined {
  const match = question.match(/(?:toward|to|pay)\s+(amex|visa|mastercard|\w+\s+card)/i);
  return match?.[1];
}

function extractIncomeName(question: string): string | undefined {
  if (/contract/i.test(question)) return "Contract";
  const match = question.match(/(?:if|when)\s+(?:my\s+)?(.+?)\s+(?:payment|income|deposit)/i);
  return match?.[1]?.trim();
}

function extractBusinessFlag(question: string): boolean {
  return /pacific\s+luxe|business|jadessystems|jade\s+systems/i.test(question);
}

export function classifyIntentRules(question: string): IntentResult {
  const q = question.trim();
  let bestIntent: FinancialAssistantIntent = "GENERAL_FINANCIAL_QUESTION";
  let confidence = 0.5;

  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(q))) {
      bestIntent = intent;
      confidence = 0.85;
      break;
    }
  }

  const extractedParams: Record<string, unknown> = {};

  if (bestIntent === "CAN_I_AFFORD" || bestIntent === "GENERAL_FINANCIAL_QUESTION") {
    const amount = extractAmount(q);
    const purchaseName = extractPurchaseName(q);
    if (amount || purchaseName || /afford/i.test(q)) {
      if (bestIntent === "GENERAL_FINANCIAL_QUESTION") {
        bestIntent = "CAN_I_AFFORD";
        confidence = 0.75;
      }
      if (amount) extractedParams.amount = amount;
      if (purchaseName) extractedParams.purchaseName = purchaseName;
      extractedParams.isBusiness = extractBusinessFlag(q);
    }
  }

  if (bestIntent === "EXPLAIN_METRIC") {
    extractedParams.metricName = extractMetricName(q);
  }

  if (bestIntent === "DEBT_PAYMENT") {
    const debtName = extractDebtName(q);
    if (debtName) extractedParams.debtName = debtName;
  }

  if (bestIntent === "INCOME_DELAY") {
    const incomeName = extractIncomeName(q);
    if (incomeName) extractedParams.incomeName = incomeName;
  }

  if (bestIntent === "SAFE_TO_SPEND") {
    if (/this\s+week/i.test(q)) extractedParams.horizon = "week";
    else if (/this\s+month/i.test(q)) extractedParams.horizon = "month";
    else if (/paycheck/i.test(q)) extractedParams.horizon = "payday";
    else extractedParams.horizon = "today";
  }

  if (/smartest|best\s+financial\s+action|what\s+should\s+i\s+do/i.test(q)) {
    bestIntent = "GENERAL_FINANCIAL_QUESTION";
    confidence = 0.8;
  }

  return { intent: bestIntent, confidence, extractedParams };
}

export class RulesBasedProvider implements AIProvider {
  readonly name = "rules";
  readonly model = "deterministic";

  async classifyIntent(input: IntentRequest): Promise<IntentResult> {
    return classifyIntentRules(input.question);
  }

  async generateStructuredResponse<_T>(
    _request: StructuredAIRequest<_T>
  ): Promise<{ data: _T; usage: TokenUsage }> {
    throw new Error("RulesBasedProvider does not generate LLM responses");
  }
}

export function parseIntentJson(raw: string): IntentResult | null {
  try {
    const json = JSON.parse(raw);
    const parsed = intentResultSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
