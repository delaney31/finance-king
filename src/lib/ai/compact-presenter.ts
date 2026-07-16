import type {
  CFOAssistantResponse,
  CFOCompactAnswer,
  CFOCompactVerdict,
  CFORecommendation,
  FinancialAssistantIntent,
  ToolExecutionRecord,
} from "./types";

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatMoneyPrecise(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const VERDICT_HEADLINES: Record<CFOCompactVerdict, string> = {
  GO_AHEAD: "GO AHEAD",
  GO_AHEAD_WITH_LIMIT: "GO AHEAD, KEEP IT UNDER",
  REDUCE_BUDGET: "REDUCE THE BUDGET",
  WAIT: "WAIT",
  NOT_YET: "NOT YET",
  NEED_MORE_INFORMATION: "NEED MORE INFORMATION",
};

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

  return verdict;
}

function riskLabel(
  verdict: CFOCompactVerdict,
  warnings: string[]
): string {
  if (verdict === "GO_AHEAD" || verdict === "GO_AHEAD_WITH_LIMIT") {
    return warnings.length > 0 ? "Low–medium" : "Low";
  }
  if (verdict === "REDUCE_BUDGET" || verdict === "WAIT") return "Medium";
  if (verdict === "NOT_YET") return "High";
  return "Unknown";
}

function buildProtectionChecks(response: CFOAssistantResponse): CFOCompactAnswer["protectionChecks"] {
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
      label: "Next major bills covered",
      status: response.nextBillsCovered ? "PASS" : "FAIL",
    },
  ];

  const hasOverdraftWarning = response.warnings.some((w) =>
    /overdraft|low balance|below.*floor/i.test(w)
  );
  checks.push({
    label: "No overdraft risk",
    status: hasOverdraftWarning ? "WARN" : "PASS",
  });

  return checks.slice(0, 4);
}

function buildAdvice(
  verdict: CFOCompactVerdict,
  response: CFOAssistantResponse,
  purchaseName?: string,
  amount?: number
): string {
  const limit = response.safeToSpendToday ?? 0;
  const cap = amount ?? response.recommendedAmount;

  switch (verdict) {
    case "GO_AHEAD":
      if (cap && cap > 0) {
        return `Yes. I'd keep it under ${formatMoney(Math.min(cap * 1.3, limit))}.`;
      }
      if (purchaseName) return `Yes, ${purchaseName} looks fine from cleared funds.`;
      return `You're clear to spend up to ${formatMoney(limit)} today.`;
    case "GO_AHEAD_WITH_LIMIT":
      return `I'd keep it under ${formatMoney(cap ?? limit * 0.8)}.`;
    case "REDUCE_BUDGET":
      return `You can do this, but cap the budget at ${formatMoney(cap ?? limit * 0.5)}.`;
    case "WAIT":
      return "I'd wait until your next reliable income clears.";
    case "NOT_YET":
      return "Not yet — this would strain your cash cushion or upcoming bills.";
    case "NEED_MORE_INFORMATION":
      return "I need one detail — what amount are you planning to spend?";
  }
}

function buildReason(
  verdict: CFOCompactVerdict,
  response: CFOAssistantResponse,
  purchaseName?: string,
  amount?: number
): string {
  const amt = amount ?? response.recommendedAmount;
  const name = purchaseName ?? "This";

  if (verdict === "NEED_MORE_INFORMATION") {
    return "Once I know the amount, I can run it against your cleared balances.";
  }

  if (verdict === "GO_AHEAD" || verdict === "GO_AHEAD_WITH_LIMIT") {
    if (amt) {
      return `A ${formatMoneyPrecise(amt)} ${name.toLowerCase().includes(amt.toString()) ? "purchase" : name} keeps your emergency fund and upcoming bills protected.`;
    }
    return "Your cleared cash covers this without touching protected reserves.";
  }

  if (verdict === "WAIT") {
    return "Waiting keeps your mortgage and major bills fully funded.";
  }

  if (verdict === "NOT_YET") {
    return "This would leave next month's major obligations underfunded.";
  }

  if (response.warnings[0]) return response.warnings[0];

  return response.answer.split(".")[0] + ".";
}

function extractPurchaseContext(
  question: string,
  toolResults: ToolExecutionRecord[]
): { name?: string; amount?: number; canAffordCash?: boolean; balanceAfter?: number } {
  const purchaseTool = toolResults.find((t) => t.toolName === "simulatePurchase");
  const data = purchaseTool?.result.data as {
    impact?: { canAffordCash: boolean; affectedAccounts?: { after: number }[] };
    purchase?: { name: string; amount: number };
  } | undefined;

  if (data?.purchase) {
    return {
      name: data.purchase.name,
      amount: data.purchase.amount,
      canAffordCash: data.impact?.canAffordCash,
      balanceAfter: data.impact?.affectedAccounts?.[0]?.after,
    };
  }

  const amountMatch = question.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
  return { amount: amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined };
}

function buildMetrics(
  response: CFOAssistantResponse,
  intent: FinancialAssistantIntent,
  verdict: CFOCompactVerdict,
  purchaseCtx: ReturnType<typeof extractPurchaseContext>
): CFOCompactAnswer["primaryMetrics"] {
  const safeToday = response.safeToSpendToday ?? 0;

  if (intent === "DEBT_PAYMENT" && response.recommendedAmount) {
    return [
      { label: "Safe today", value: formatMoney(safeToday) },
      { label: "Payment amount", value: formatMoney(response.recommendedAmount) },
      { label: "Risk", value: riskLabel(verdict, response.warnings) },
    ];
  }

  if (intent === "SAFE_TO_SPEND") {
    return [
      { label: "Safe today", value: formatMoney(safeToday) },
      { label: "This week", value: formatMoney(response.safeToSpendThisWeek ?? 0) },
      { label: "Risk", value: "Low" },
    ];
  }

  const afterLabel =
    purchaseCtx.name && purchaseCtx.amount
      ? `After ${purchaseCtx.name.toLowerCase().includes("dinner") ? "dinner" : "purchase"}`
      : "After this";

  let afterValue = "—";
  if (purchaseCtx.balanceAfter != null) {
    afterValue = formatMoney(purchaseCtx.balanceAfter);
  } else if (purchaseCtx.amount != null) {
    afterValue = formatMoney(Math.max(0, safeToday - purchaseCtx.amount));
  } else if (response.monthEndImpact != null) {
    afterValue = formatMoney(response.monthEndImpact);
  }

  return [
    { label: "Safe today", value: formatMoney(safeToday) },
    { label: afterLabel, value: afterValue },
    { label: "Risk", value: riskLabel(verdict, response.warnings) },
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
  snapshotDate?: string
): CFOCompactAnswer {
  const purchaseCtx = extractPurchaseContext(question, toolResults);
  const safeToday = response.safeToSpendToday ?? 0;

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

  const routingTool = toolResults.find((t) => t.toolName === "getRecommendedAccountForExpense");
  const routingData = routingTool?.result.data as { recommended?: { nickname: string } } | undefined;

  const isLargePurchase = (amount ?? 0) > safeToday * 0.5;

  return {
    question,
    verdict,
    headline,
    advice: buildAdvice(verdict, response, purchaseName, amount),
    reason: buildReason(verdict, response, purchaseName, amount),
    status: verdictToStatus(verdict),
    primaryMetrics: buildMetrics(response, intent, verdict, purchaseCtx),
    protectionChecks: buildProtectionChecks(response),
    details: {
      recommendedAccount: routingData?.recommended?.nickname,
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
