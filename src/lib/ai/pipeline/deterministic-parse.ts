import type { FinancialAssistantIntent, IntentResult } from "../types";
import { classifyIntentRules } from "../providers/rules-based";

const DETERMINISTIC_CONFIDENCE_THRESHOLD = 0.85;

const patterns: Array<{
  intent: FinancialAssistantIntent;
  regex: RegExp;
  extract?: (match: RegExpMatchArray, question: string) => Record<string, unknown>;
}> = [
  {
    intent: "CAN_I_AFFORD",
    regex:
      /can\s+(.+?)\s+(?:spend|afford|buy)\s+\$?([\d,]+(?:\.\d{1,2})?)/i,
    extract: (match, question) => {
      const amount = Number((match[2] ?? "").replace(/,/g, ""));
      const entity = match[1]?.trim() ?? "";
      const isBusiness = /pacific\s+luxe|business|jadessystems|jade\s+systems/i.test(
        entity + " " + question
      );
      const categoryMatch = question.match(/\bon\s+(.+?)(?:\?|$)/i);
      const purchaseName = categoryMatch?.[1]?.trim() || entity || undefined;
      return {
        amount: Number.isFinite(amount) ? amount : undefined,
        purchaseName,
        businessEntityName: isBusiness ? entity : undefined,
        category: categoryMatch?.[1]?.trim(),
        isBusiness,
      };
    },
  },
  {
    intent: "SAFE_TO_SPEND",
    regex: /how much can i (?:safely )?spend/i,
    extract: () => ({ horizon: "today" }),
  },
  {
    intent: "CAN_I_AFFORD",
    regex: /can\s+i\s+afford/i,
    extract: (_, question) => {
      const amountMatch = question.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
      const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined;
      const affordMatch = question.match(/afford\s+(?:the\s+)?(.+?)(?:\?|$|\s+for|\s+next)/i);
      return {
        amount: Number.isFinite(amount) ? amount : undefined,
        purchaseName: affordMatch?.[1]?.trim(),
        isBusiness: false,
      };
    },
  },
  {
    intent: "EXPLAIN_METRIC",
    regex: /why is my (.+)/i,
    extract: (match) => {
      const metric = (match[1] ?? "safe to spend").toLowerCase();
      if (metric.includes("safe")) return { metricName: "safe_to_spend" };
      if (metric.includes("month")) return { metricName: "month_end_buffer" };
      if (metric.includes("year")) return { metricName: "year_end_buffer" };
      return { metricName: "safe_to_spend" };
    },
  },
  {
    intent: "DEBT_PAYMENT",
    regex: /how\s+much\s+should\s+i\s+pay\s+(?:toward|to)\s+(.+?)(?:\?|$)/i,
    extract: (match) => ({ debtName: match[1]?.trim() }),
  },
  {
    intent: "INCOME_DELAY",
    regex: /what\s+happens\s+if\s+(?:my\s+)?(.+?)\s+(?:payment|income|deposit)/i,
    extract: (match) => ({ incomeName: match[1]?.trim() }),
  },
  {
    intent: "OVERDRAFT_RISK",
    regex: /(?:at\s+risk|overdraft)/i,
  },
];

export function parseDeterministicIntent(question: string): IntentResult | null {
  const q = question.trim();
  for (const { intent, regex, extract } of patterns) {
    const match = q.match(regex);
    if (match) {
      const extractedParams = extract ? extract(match, q) : {};
      return {
        intent,
        confidence: 0.92,
        extractedParams,
      };
    }
  }
  return null;
}

export function classifyIntentDeterministicFirst(question: string): IntentResult {
  const deterministic = parseDeterministicIntent(question);
  if (deterministic && deterministic.confidence >= DETERMINISTIC_CONFIDENCE_THRESHOLD) {
    return deterministic;
  }
  return classifyIntentRules(question);
}

export function shouldSkipAIClassification(intentResult: IntentResult): boolean {
  return intentResult.confidence >= DETERMINISTIC_CONFIDENCE_THRESHOLD;
}
