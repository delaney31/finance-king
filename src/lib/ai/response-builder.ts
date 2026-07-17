import type {
  CFOAssistantResponse,
  CFORecommendation,
  FinancialAssistantIntent,
  ToolExecutionRecord,
} from "./types";
import { EDUCATIONAL_DISCLAIMER } from "./types";
import { computeAllHorizons } from "@/lib/engine";
import type { EngineSnapshot } from "@/lib/engine/types";

function mapPurchaseRecommendation(
  rec: "proceed" | "reduce" | "delay" | "decline"
): CFORecommendation {
  switch (rec) {
    case "proceed":
      return "PROCEED";
    case "reduce":
      return "PROCEED_WITH_LIMIT";
    case "delay":
      return "DELAY";
    case "decline":
      return "DECLINE";
  }
}

export function buildFallbackResponse(
  intent: FinancialAssistantIntent,
  snapshot: EngineSnapshot,
  toolResults: ToolExecutionRecord[]
): CFOAssistantResponse {
  const sts = computeAllHorizons(snapshot);
  const obligations = toolResults.find((t) => t.toolName === "getUpcomingObligations");
  void obligations;
  const assumptions = [EDUCATIONAL_DISCLAIMER];
  const warnings: string[] = [];
  const supportingCalculations: CFOAssistantResponse["supportingCalculations"] = [
    { label: "Safe to spend today", amount: sts.today },
    { label: "Safe to spend this week", amount: sts.thisWeek },
    { label: "Safe to spend this month", amount: sts.thisMonth },
  ];

  let answer = "";
  let recommendation: CFORecommendation = "INFORMATION_ONLY";
  let emergencyReserveAffected = false;
  let taxReserveAffected = false;
  let nextBillsCovered = true;
  let monthEndImpact: number | undefined;
  let yearEndImpact: number | undefined;
  let recommendedAccountId: string | undefined;
  let recommendedAmount: number | undefined;

  const stsTool = toolResults.find((t) => t.toolName === "calculateSafeToSpend");
  const purchaseTool = toolResults.find(
    (t) => t.toolName === "simulatePurchase" || t.toolName === "simulateBusinessPurchase"
  );
  const explainTool = toolResults.find((t) => t.toolName === "explainMetric");
  const debtTool = toolResults.find((t) => t.toolName === "calculateDebtPaymentOptions");
  const overdraftTool = toolResults.find((t) => t.toolName === "detectOverdraftRisk");
  const delayTool = toolResults.find((t) => t.toolName === "simulateIncomeDelay");
  const routingTool = toolResults.find((t) => t.toolName === "getRecommendedAccountForExpense");

  switch (intent) {
    case "SAFE_TO_SPEND": {
      const data = stsTool?.result.data as { breakdown?: { label: string; amount?: number }[] } | undefined;
      if (data?.breakdown) {
        for (const line of data.breakdown) {
          supportingCalculations.push({ label: line.label, amount: line.amount });
        }
      }
      answer = `You can safely spend up to $${sts.today.toFixed(2)} today, $${sts.thisWeek.toFixed(2)} this week, and $${sts.thisMonth.toFixed(2)} this month based on cleared cash minus protected reserves and committed obligations.`;
      recommendation = "INFORMATION_ONLY";
      break;
    }
    case "CAN_I_AFFORD": {
      const data = purchaseTool?.result.data as {
        impact?: {
          canAffordCash: boolean;
          recommendation: "proceed" | "reduce" | "delay" | "decline";
          monthEndBuffer: number;
          yearEndBuffer: number;
          protectedReservesIntact: boolean;
          billsRemainFunded: boolean;
          warnings: string[];
          affectedAccounts: { accountId: string; nickname?: string; before: number; after: number }[];
          safeToSpendAfter: number;
          requiredCushion: number;
          shortfall: number;
          emergencyAmountUsed: number;
          taxAmountUsed: number;
        };
        purchase?: { name: string; amount: number };
        recommendedAccount?: { id: string; nickname: string };
      };
      const impact = data?.impact;
      const purchase = data?.purchase;
      if (impact && purchase) {
        recommendation = mapPurchaseRecommendation(impact.recommendation);
        answer =
          impact.canAffordCash
            ? `Yes, you can afford ${purchase.name} at $${purchase.amount.toFixed(2)} from cleared funds without breaching protected reserves.`
            : `I recommend delaying ${purchase.name} ($${purchase.amount.toFixed(2)}). It would strain your safe-to-spend or protected reserves.`;
        monthEndImpact = impact.monthEndBuffer;
        yearEndImpact = impact.yearEndBuffer;
        emergencyReserveAffected = !impact.protectedReservesIntact || impact.emergencyAmountUsed > 0;
        taxReserveAffected = impact.taxAmountUsed > 0;
        nextBillsCovered = impact.billsRemainFunded;
        warnings.push(...impact.warnings);
        recommendedAccountId = data.recommendedAccount?.id;
        recommendedAmount = purchase.amount;
        if (impact.affectedAccounts[0]) {
          supportingCalculations.push({
            label: "Safe to spend after purchase",
            amount: impact.safeToSpendAfter,
          });
          supportingCalculations.push({
            label: "Required cushion",
            amount: impact.requiredCushion,
          });
          if (impact.shortfall > 0) {
            supportingCalculations.push({
              label: "Shortfall",
              amount: impact.shortfall,
            });
          }
        }
      } else {
        answer = `Your safe-to-spend today is $${sts.today.toFixed(2)}. Provide an amount to simulate a specific purchase.`;
      }
      break;
    }
    case "EXPLAIN_METRIC": {
      const data = explainTool?.result.data as { summary?: string; lines?: { label: string; amount?: number }[] };
      answer = data?.summary ?? `Safe-to-spend is $${sts.today.toFixed(2)} based on cleared cash minus commitments.`;
      if (data?.lines) {
        supportingCalculations.push(...data.lines.map((l) => ({ label: l.label, amount: l.amount })));
      }
      recommendation = "INFORMATION_ONLY";
      break;
    }
    case "DEBT_PAYMENT": {
      const data = debtTool?.result.data as { targetCard?: { name: string; minimumPayment: number }; utilizationTargets?: { threshold: number; paymentNeeded: number }[] };
      const target = data?.targetCard;
      const pay30 = data?.utilizationTargets?.find((t) => t.threshold === 0.3);
      answer = target
        ? `Minimum required on ${target.name}: $${target.minimumPayment.toFixed(2)}. To reach 30% utilization, pay $${(pay30?.paymentNeeded ?? 0).toFixed(2)}. Do not drain emergency savings solely for utilization.`
        : "Review your debt payment plan in the Credit section.";
      recommendation = "INFORMATION_ONLY";
      recommendedAmount = pay30?.paymentNeeded ?? target?.minimumPayment;
      break;
    }
    case "OVERDRAFT_RISK": {
      const data = overdraftTool?.result.data as { risks?: { accountName: string; lowestBalance: number; riskLevel: string; suggestedTransfer?: { amount: number; reason: string } }[] };
      const atRisk = data?.risks?.filter((r) => r.riskLevel === "RED" || r.riskLevel === "ORANGE") ?? [];
      answer =
        atRisk.length > 0
          ? `Yes, ${atRisk.length} account(s) show overdraft risk. ${atRisk[0].accountName} may drop to $${atRisk[0].lowestBalance.toFixed(2)}.`
          : "No immediate overdraft risk detected in the next 30 days.";
      recommendation = atRisk.length > 0 ? "DELAY" : "INFORMATION_ONLY";
      if (atRisk[0]?.suggestedTransfer) {
        recommendedAmount = atRisk[0].suggestedTransfer.amount;
        supportingCalculations.push({ label: "Suggested transfer", amount: atRisk[0].suggestedTransfer.amount, description: atRisk[0].suggestedTransfer.reason });
      }
      break;
    }
    case "INCOME_DELAY": {
      const data = delayTool?.result.data as { income?: { name: string; amount: number }; safeToSpendBefore?: number; safeToSpendAfter?: number };
      answer = data?.income
        ? `If ${data.income.name} ($${data.income.amount.toFixed(2)}) is delayed, safe-to-spend drops from $${(data.safeToSpendBefore ?? sts.today).toFixed(2)} to $${(data.safeToSpendAfter ?? sts.today).toFixed(2)}. Pending income is not spendable until cleared.`
        : "No matching scheduled income found to simulate a delay.";
      recommendation = "INFORMATION_ONLY";
      assumptions.push("Projected income is not guaranteed until received and cleared");
      break;
    }
    case "ACCOUNT_ROUTING": {
      const data = routingTool?.result.data as { recommended?: { id: string; nickname: string; balance: number } };
      answer = data?.recommended
        ? `Pay from ${data.recommended.nickname} (cleared balance $${data.recommended.balance.toFixed(2)}).`
        : "No optimal routing account found. Use your primary checking with adequate floor.";
      recommendedAccountId = data?.recommended?.id;
      recommendation = "PROCEED";
      break;
    }
    default:
      answer = `Your cleared liquid position supports $${sts.today.toFixed(2)} safe to spend today. Focus on funding upcoming obligations before discretionary spending.`;
      recommendation = "INFORMATION_ONLY";
  }

  for (const tr of toolResults) {
    warnings.push(...tr.result.warnings);
    assumptions.push(...tr.result.assumptions);
  }

  if (sts.isProvisional) {
    warnings.push("Some financial data is provisional — answer may change when confirmed");
  }

  const suggestedFollowUpQuestions = [
    "How much can I safely spend today?",
    "Can I afford dinner tonight?",
    "Am I at risk of an overdraft?",
    "What is the smartest financial action I should take today?",
  ];

  return {
    answer,
    recommendation,
    safeToSpendToday: sts.today,
    safeToSpendThisWeek: sts.thisWeek,
    safeToSpendThisMonth: sts.thisMonth,
    recommendedAmount,
    recommendedAccountId,
    monthEndImpact,
    yearEndImpact,
    emergencyReserveAffected,
    taxReserveAffected,
    nextBillsCovered,
    warnings: [...new Set(warnings)],
    assumptions: [...new Set(assumptions)],
    supportingCalculations,
    suggestedFollowUpQuestions,
  };
}

export async function enhanceWithLLM(
  provider: { generateStructuredResponse: <T>(req: { systemPrompt: string; userPrompt: string; schema: string }) => Promise<{ data: T }> },
  question: string,
  context: string,
  fallback: CFOAssistantResponse
): Promise<CFOAssistantResponse> {
  try {
    const { data } = await provider.generateStructuredResponse<CFOAssistantResponse>({
      systemPrompt: `You are Ask My CFO for Finance King. Explain pre-calculated financial results clearly. NEVER invent numbers — use only values from tool results. Include educational disclaimer. Map purchase recommendations to PROCEED/PROCEED_WITH_LIMIT/DELAY/DECLINE/INFORMATION_ONLY.`,
      userPrompt: `Question: ${question}\n\nCalculated context:\n${context}\n\nFallback answer for reference:\n${JSON.stringify(fallback)}`,
      schema: JSON.stringify({
        answer: "string",
        recommendation: "PROCEED|PROCEED_WITH_LIMIT|DELAY|DECLINE|INFORMATION_ONLY",
        safeToSpendToday: "number?",
        supportingCalculations: "[{label, amount?, description?}]",
        warnings: "[string]",
        assumptions: "[string]",
        suggestedFollowUpQuestions: "[string]",
        emergencyReserveAffected: "boolean",
        taxReserveAffected: "boolean",
        nextBillsCovered: "boolean",
      }),
    });
    return { ...fallback, ...data, answer: data.answer || fallback.answer };
  } catch {
    return fallback;
  }
}
