import type {
  CFOAssistantResponse,
  CFOCompactAnswer,
  CFOCompactVerdict,
  CFORecommendation,
  FinancialAssistantIntent,
  ToolExecutionRecord,
} from "./types";
import type { EngineSnapshot } from "@/lib/engine/types";
import {
  buildAffordabilitySummary,
  buildReasonDetail,
  extractPurchaseContext,
} from "./reason-detail";

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const VERDICT_HEADLINES: Record<CFOCompactVerdict, string> = {
  GO_AHEAD: "GO AHEAD",
  GO_AHEAD_WITH_LIMIT: "GO AHEAD, KEEP IT UNDER",
  REDUCE_BUDGET: "REDUCE THE BUDGET",
  WAIT: "WAIT",
  NOT_YET: "NOT YET",
  NEED_MORE_INFORMATION: "NEED MORE INFORMATION",
};

const NEGATIVE_VERDICTS: CFOCompactVerdict[] = ["WAIT", "NOT_YET", "REDUCE_BUDGET"];

export function recommendationToVerdict(rec: CFORecommendation): CFOCompactVerdict {
  switch (rec) {
    case "PROCEED":
      return "GO_AHEAD";
    case "PROCEED_WITH_LIMIT":
      return "GO_AHEAD_WITH_LIMIT";
    case "DELAY":
      return "WAIT";
    case "DECLINE":
      return "NOT_YET";
    case "INFORMATION_ONLY":
      return "GO_AHEAD";
  }
}

export function verdictToStatus(verdict: CFOCompactVerdict): CFOCompactAnswer["status"] {
  switch (verdict) {
    case "GO_AHEAD":
    case "GO_AHEAD_WITH_LIMIT":
      return "SAFE";
    case "REDUCE_BUDGET":
    case "WAIT":
      return "CAUTION";
    case "NOT_YET":
      return "RISK";
    case "NEED_MORE_INFORMATION":
      return "UNKNOWN";
  }
}

export interface VerdictValidationInput {
  verdict: CFOCompactVerdict;
  safeToSpendToday: number;
  recommendedAmount?: number;
  canAffordCash?: boolean;
  emergencyReserveAffected: boolean;
  nextBillsCovered: boolean;
  safeToSpendAfter?: number;
  requiredCushion?: number;
  shortfall?: number;
  emergencyAmountUsed?: number;
}

/** Ensures verdict cannot contradict deterministic engine results. */
export function validateVerdict(input: VerdictValidationInput): CFOCompactVerdict {
  let { verdict } = input;

  const comfortablyAffordable =
    input.recommendedAmount != null &&
    input.recommendedAmount > 0 &&
    input.recommendedAmount <= input.safeToSpendToday &&
    !input.emergencyReserveAffected &&
    input.nextBillsCovered;

  if (
    (comfortablyAffordable || input.canAffordCash === true) &&
    (verdict === "NOT_YET" || verdict === "WAIT")
  ) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[CFO] Verdict conflict corrected: affordable purchase cannot be NOT_YET/WAIT");
    }
    verdict =
      input.recommendedAmount != null && input.recommendedAmount > input.safeToSpendToday * 0.8
        ? "GO_AHEAD_WITH_LIMIT"
        : "GO_AHEAD";
  }

  if (input.canAffordCash === false && verdict === "GO_AHEAD") {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[CFO] Verdict conflict corrected: unaffordable purchase cannot be GO_AHEAD");
    }
    verdict = input.nextBillsCovered ? "WAIT" : "NOT_YET";
  }

  if (
    input.safeToSpendAfter != null &&
    input.requiredCushion != null &&
    input.safeToSpendAfter >= input.requiredCushion &&
    input.recommendedAmount != null &&
    input.recommendedAmount <= input.safeToSpendToday &&
    NEGATIVE_VERDICTS.includes(verdict)
  ) {
    verdict = "GO_AHEAD";
  }

  if (
    input.nextBillsCovered &&
    verdict === "NOT_YET" &&
    input.shortfall != null &&
    input.shortfall > 0 &&
    input.canAffordCash === true
  ) {
    verdict = "GO_AHEAD_WITH_LIMIT";
  }

  return verdict;
}

function buildProtectionChecks(
  response: CFOAssistantResponse,
  purchaseCtx: ReturnType<typeof extractPurchaseContext>
): CFOCompactAnswer["protectionChecks"] {
  const impact = purchaseCtx.impact;
  const shortfall = impact?.shortfall ?? 0;

  const checks: CFOCompactAnswer["protectionChecks"] = [
    {
      label: "Emergency fund protected",
      status: response.emergencyReserveAffected ? "FAIL" : "PASS",
    },
    {
      label: "Tax reserve protected",
      status: response.taxReserveAffected ? "WARN" : "PASS",
    },
    {
      label:
        response.nextBillsCovered
          ? "Next major bills covered"
          : shortfall > 0
            ? `Next major bills — underfunded by ${formatMoney(shortfall)}`
            : "Next major bills covered",
      status: response.nextBillsCovered ? "PASS" : "FAIL",
    },
  ];

  const hasOverdraftWarning = response.warnings.some((w) =>
    /overdraft|low balance|below.*floor/i.test(w)
  );
  checks.push({
    label: hasOverdraftWarning ? "Overdraft risk detected" : "No overdraft risk",
    status: hasOverdraftWarning ? "WARN" : "PASS",
  });

  if (impact?.emergencyAmountUsed && impact.emergencyAmountUsed > 0) {
    checks[0] = {
      label: `Emergency fund — ${formatMoney(impact.emergencyAmountUsed)} at risk`,
      status: "FAIL",
    };
  }

  return checks.slice(0, 4);
}

function buildAdvice(
  verdict: CFOCompactVerdict,
  purchaseCtx: ReturnType<typeof extractPurchaseContext>,
  reasonDetail: CFOCompactAnswer["reasonDetail"]
): string {
  const impact = purchaseCtx.impact;
  const name = purchaseCtx.name ?? "this purchase";
  const amount = purchaseCtx.amount;
  const limit = impact?.maxSafeBudget ?? 0;

  switch (verdict) {
    case "GO_AHEAD":
      if (amount && amount > 0) {
        return `Keep ${name} under ${formatMoney(amount)}.`;
      }
      return `You're clear to spend up to ${formatMoney(limit)} today.`;
    case "GO_AHEAD_WITH_LIMIT":
      return `Keep ${name} under ${formatMoney(amount ?? limit)}.`;
    case "REDUCE_BUDGET":
      return `Cap ${name} at ${formatMoney(impact?.maxSafeBudget ?? limit)}.`;
    case "WAIT":
      if (reasonDetail.affordabilityTrigger?.type === "INCOME_CLEARS") {
        const trigger = reasonDetail.affordabilityTrigger;
        const incomeLabel = trigger.description.replace(/^Your next /, "").replace(/ deposit clears$/, "");
        return `Wait until your next ${trigger.amount ? formatMoney(trigger.amount) + " " : ""}${incomeLabel} clears.`;
      }
      return "Wait until your next reliable income clears.";
    case "NOT_YET":
      if (reasonDetail.affordabilityTrigger?.type === "INCOME_CLEARS") {
        const trigger = reasonDetail.affordabilityTrigger;
        return `Wait until your next ${trigger.amount ? formatMoney(trigger.amount) + " " : ""}deposit clears.`;
      }
      if (reasonDetail.affectedObligation) {
        return `Wait — this would underfund your ${reasonDetail.affectedObligation}.`;
      }
      return reasonDetail.explanation.split(".")[0] + ".";
    case "NEED_MORE_INFORMATION":
      return "I need one detail — what amount are you planning to spend?";
  }
}

function buildMetrics(
  response: CFOAssistantResponse,
  intent: FinancialAssistantIntent,
  purchaseCtx: ReturnType<typeof extractPurchaseContext>
): CFOCompactAnswer["primaryMetrics"] {
  const safeToday = response.safeToSpendToday ?? 0;
  const impact = purchaseCtx.impact;

  if (intent === "DEBT_PAYMENT" && response.recommendedAmount) {
    return [
      { label: "Safe today", value: formatMoney(safeToday) },
      { label: "Payment amount", value: formatMoney(response.recommendedAmount) },
      { label: "Required cushion", value: formatMoney(impact?.requiredCushion ?? safeToday) },
    ];
  }

  if (intent === "SAFE_TO_SPEND") {
    return [
      { label: "Safe today", value: formatMoney(safeToday) },
      { label: "This week", value: formatMoney(response.safeToSpendThisWeek ?? 0) },
      { label: "Required cushion", value: formatMoney(impact?.requiredCushion ?? 0) },
    ];
  }

  const purchaseName = purchaseCtx.name?.toLowerCase() ?? "";
  const afterLabel =
    purchaseCtx.name && purchaseCtx.amount
      ? `After ${purchaseName.includes("dinner") ? "dinner" : purchaseName.includes("disney") ? purchaseCtx.name.split(" ")[0] : "purchase"}`
      : "After purchase";

  let afterValue = safeToday;
  if (impact && purchaseCtx.amount != null) {
    afterValue = impact.safeToSpendAfter;
  } else if (purchaseCtx.amount != null) {
    afterValue = Math.max(0, safeToday - purchaseCtx.amount);
  }

  const requiredCushion = impact?.requiredCushion ?? 0;

  return [
    { label: "Safe today", value: formatMoney(safeToday) },
    { label: afterLabel, value: formatMoney(afterValue) },
    { label: "Required cushion", value: formatMoney(requiredCushion) },
  ];
}

function buildUpcomingBills(toolResults: ToolExecutionRecord[]): CFOCompactAnswer["details"]["upcomingBills"] {
  const tool = toolResults.find((t) => t.toolName === "getUpcomingObligations");
  const data = tool?.result.data as {
    obligations?: { name: string; amount: number; date?: string }[];
  };
  return data?.obligations?.map((o) => ({
    label: o.name,
    amount: o.amount,
    dueDate: o.date ?? undefined,
  }));
}

function buildSuggestedQuestions(
  response: CFOAssistantResponse,
  intent: FinancialAssistantIntent
): string[] {
  const defaults = response.suggestedFollowUpQuestions.slice(0, 4);
  if (intent === "CAN_I_AFFORD") {
    return [
      "Can I afford Disneyland?",
      "How much should I pay Amex?",
      "What should I do next?",
      ...defaults,
    ].slice(0, 4);
  }
  return defaults.length >= 3
    ? defaults
    : [
        "Can I afford dinner tonight?",
        "How much should I pay Amex?",
        "Why is safe-to-spend low?",
        "What should I do next?",
      ];
}

export function buildCompactAnswer(
  question: string,
  response: CFOAssistantResponse,
  intent: FinancialAssistantIntent,
  toolResults: ToolExecutionRecord[],
  snapshotDate?: string,
  snapshot?: EngineSnapshot
): CFOCompactAnswer {
  const purchaseCtx = extractPurchaseContext(question, toolResults);
  const safeToday = response.safeToSpendToday ?? 0;
  const impact = purchaseCtx.impact;

  let verdict = recommendationToVerdict(response.recommendation);

  if (
    intent === "CAN_I_AFFORD" &&
    !purchaseCtx.amount &&
    !response.recommendedAmount
  ) {
    verdict = "NEED_MORE_INFORMATION";
  }

  if (verdict === "GO_AHEAD_WITH_LIMIT" && response.recommendedAmount) {
    const ratio = response.recommendedAmount / Math.max(safeToday, 1);
    if (ratio > 0.9) verdict = "REDUCE_BUDGET";
  }

  verdict = validateVerdict({
    verdict,
    safeToSpendToday: safeToday,
    recommendedAmount: purchaseCtx.amount ?? response.recommendedAmount,
    canAffordCash: purchaseCtx.canAffordCash,
    emergencyReserveAffected: response.emergencyReserveAffected,
    nextBillsCovered: response.nextBillsCovered,
    safeToSpendAfter: impact?.safeToSpendAfter,
    requiredCushion: impact?.requiredCushion,
    shortfall: impact?.shortfall,
    emergencyAmountUsed: impact?.emergencyAmountUsed,
  });

  const purchaseName = purchaseCtx.name ?? question.replace(/can i afford\s*/i, "").replace(/\?.*$/, "").trim();
  const amount = purchaseCtx.amount ?? response.recommendedAmount;

  let headline = VERDICT_HEADLINES[verdict];
  if (
    (verdict === "GO_AHEAD_WITH_LIMIT" || verdict === "REDUCE_BUDGET") &&
    amount
  ) {
    headline = `${VERDICT_HEADLINES[verdict]} ${formatMoney(amount)}`;
  }

  const reasonDetail = buildReasonDetail(verdict, { ...purchaseCtx, name: purchaseName, amount }, snapshot);
  const affordability = buildAffordabilitySummary({ ...purchaseCtx, name: purchaseName, amount }, verdict);

  const routingTool = toolResults.find((t) => t.toolName === "getRecommendedAccountForExpense");
  const routingData = routingTool?.result.data as { recommended?: { nickname: string } } | undefined;

  const isLargePurchase = (amount ?? 0) > safeToday * 0.5;

  return {
    question,
    verdict,
    headline,
    advice: buildAdvice(verdict, { ...purchaseCtx, name: purchaseName, amount }, reasonDetail),
    reason: reasonDetail.explanation,
    reasonDetail,
    affordableNow: affordability.affordableNow,
    affordableAfter: affordability.affordableAfter,
    status: verdictToStatus(verdict),
    primaryMetrics: buildMetrics(response, intent, purchaseCtx),
    protectionChecks: buildProtectionChecks(response, purchaseCtx),
    details: {
      recommendedAccount: routingData?.recommended?.nickname ?? purchaseCtx.accountNickname,
      cost: amount,
      monthEndImpact: response.monthEndImpact,
      yearEndImpact: isLargePurchase ? response.yearEndImpact : undefined,
      upcomingBills: buildUpcomingBills(toolResults),
      assumptions: response.assumptions.filter((a) => !a.includes("educational financial guidance")),
      supportingCalculations: response.supportingCalculations,
      snapshotDate,
      warnings: response.warnings,
    },
    suggestedQuestions: buildSuggestedQuestions(response, intent),
  };
}
