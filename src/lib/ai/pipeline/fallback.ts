import type {
  CFOAssistantResponse,
  CFOCompactVerdict,
  FinancialAssistantIntent,
  ToolExecutionRecord,
} from "../types";
import type { EngineSnapshot } from "@/lib/engine/types";
import { buildFallbackResponse } from "../response-builder";
import { buildCompactAnswer } from "../compact-presenter";

export type CFOFallbackResponse = {
  source: "DETERMINISTIC_FALLBACK";
  answer: string;
  verdict:
    | "GO_AHEAD"
    | "GO_AHEAD_WITH_LIMIT"
    | "WAIT"
    | "REDUCE_BUDGET"
    | "NOT_YET"
    | "NEED_MORE_INFORMATION";
  headline: string;
  reason: string;
  metrics: Array<{ label: string; value: string }>;
  checks: Array<{ label: string; status: "PASS" | "WARN" | "FAIL" }>;
  details: {
    warnings: string[];
    assumptions: string[];
    calculationLines: Array<{ label: string; amount: number }>;
  };
};

function mapRecommendationToVerdict(
  rec: CFOAssistantResponse["recommendation"]
): CFOFallbackResponse["verdict"] {
  switch (rec) {
    case "PROCEED":
      return "GO_AHEAD";
    case "PROCEED_WITH_LIMIT":
      return "GO_AHEAD_WITH_LIMIT";
    case "DELAY":
      return "WAIT";
    case "DECLINE":
      return "NOT_YET";
    default:
      return "NEED_MORE_INFORMATION";
  }
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function buildDeterministicFallback(
  question: string,
  intent: FinancialAssistantIntent,
  snapshot: EngineSnapshot,
  toolCalls: ToolExecutionRecord[],
  asOfDate: string,
  reason?: string
): { response: CFOAssistantResponse; fallback: CFOFallbackResponse } {
  const response = buildFallbackResponse(intent, snapshot, toolCalls);
  response.compact = buildCompactAnswer(question, response, intent, toolCalls, asOfDate, snapshot);

  const purchaseTool = toolCalls.find(
    (t) => t.toolName === "simulatePurchase" || t.toolName === "simulateBusinessPurchase"
  );
  const purchaseData = purchaseTool?.result.data as {
    impact?: {
      canAffordCash: boolean;
      recommendation: string;
      safeToSpendAfter: number;
      requiredCushion: number;
      shortfall: number;
      affectedAccounts?: { before: number; after: number }[];
    };
    purchase?: { name: string; amount: number };
  } | undefined;

  const purchase = purchaseData?.purchase;
  const impact = purchaseData?.impact;

  let headline = response.compact?.headline ?? response.answer.slice(0, 120);
  let answer = response.compact?.advice ?? response.answer;

  if (purchase && impact) {
    const entity = question.match(/can\s+(.+?)\s+spend/i)?.[1] ?? "You";
    headline = impact.canAffordCash
      ? `${entity} can spend ${formatMoney(purchase.amount)} on ${purchase.name}.`
      : `${entity} should wait before spending ${formatMoney(purchase.amount)} on ${purchase.name}.`;

    const before = impact.affectedAccounts?.[0]?.before;
    const after = impact.affectedAccounts?.[0]?.after;

    answer = [
      "I could not generate the full AI explanation, but Finance King completed the calculation.",
      "",
      headline,
      "",
      before != null ? `Available operating cash: ${formatMoney(before)}` : null,
      `Cost: ${formatMoney(purchase.amount)}`,
      after != null ? `Cash after purchase: ${formatMoney(after)}` : null,
      `Safe to spend after: ${formatMoney(impact.safeToSpendAfter)}`,
      impact.requiredCushion > 0
        ? `Required operating floor: ${formatMoney(impact.requiredCushion)}`
        : null,
      "",
      `Recommendation: ${impact.canAffordCash ? "Proceed" : "Delay"}`,
    ]
      .filter(Boolean)
      .join("\n");
  } else if (reason) {
    answer = `${reason}\n\n${answer}`;
  }

  const fallback: CFOFallbackResponse = {
    source: "DETERMINISTIC_FALLBACK",
    answer,
    verdict: mapRecommendationToVerdict(response.recommendation),
    headline,
    reason: response.compact?.reason ?? response.answer,
    metrics:
      response.compact?.primaryMetrics?.map((m) => ({
        label: m.label,
        value: m.value,
      })) ?? [],
    checks:
      response.compact?.protectionChecks?.map((c) => ({
        label: c.label,
        status: c.status,
      })) ?? [],
    details: {
      warnings: response.warnings,
      assumptions: response.assumptions,
      calculationLines:
        response.supportingCalculations
          ?.filter((c) => c.amount != null)
          .map((c) => ({ label: c.label, amount: c.amount! })) ?? [],
    },
  };

  return { response, fallback };
}

export function compactVerdictLabel(verdict: CFOCompactVerdict): string {
  switch (verdict) {
    case "GO_AHEAD":
      return "GO AHEAD";
    case "GO_AHEAD_WITH_LIMIT":
      return "GO AHEAD WITH LIMIT";
    case "REDUCE_BUDGET":
      return "REDUCE BUDGET";
    case "WAIT":
      return "WAIT";
    case "NOT_YET":
      return "NOT YET";
    case "NEED_MORE_INFORMATION":
      return "I NEED ONE DETAIL";
    default:
      return verdict;
  }
}
