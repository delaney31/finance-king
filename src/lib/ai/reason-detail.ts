import type {
  CFOCompactVerdict,
  CFOReasonDetail,
  CFOReasonPrimary,
  ToolExecutionRecord,
} from "./types";
import type { EngineSnapshot, PurchaseImpact } from "@/lib/engine/types";
import { format } from "date-fns";

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(date?: string | null): string | undefined {
  if (!date) return undefined;
  try {
    return format(new Date(date), "MMM d");
  } catch {
    return date;
  }
}

export interface PurchaseContext {
  name?: string;
  amount?: number;
  canAffordCash?: boolean;
  impact?: PurchaseImpact;
  accountNickname?: string;
}

export function extractPurchaseContext(
  question: string,
  toolResults: ToolExecutionRecord[]
): PurchaseContext {
  const purchaseTool = toolResults.find(
    (t) => t.toolName === "simulatePurchase" || t.toolName === "simulateBusinessPurchase"
  );
  const data = purchaseTool?.result.data as {
    impact?: PurchaseImpact;
    purchase?: { name: string; amount: number; accountId?: string };
    recommendedAccount?: { nickname: string };
  } | undefined;

  if (data?.purchase) {
    return {
      name: data.purchase.name,
      amount: data.purchase.amount,
      canAffordCash: data.impact?.canAffordCash,
      impact: data.impact,
      accountNickname:
        data.impact?.affectedAccounts[0]?.nickname ?? data.recommendedAccount?.nickname,
    };
  }

  const amountMatch = question.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
  return { amount: amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined };
}

function buildExplanation(
  primaryReason: CFOReasonPrimary,
  ctx: PurchaseContext,
  verdict: CFOCompactVerdict
): string {
  const impact = ctx.impact;
  const name = ctx.name ?? "this purchase";
  const amount = ctx.amount;
  const account = ctx.accountNickname ?? impact?.affectedAccounts[0]?.nickname;
  const obligation = impact?.underfundedObligation;

  switch (primaryReason) {
    case "UPCOMING_BILLS_UNDERFUNDED":
      if (obligation) {
        const dateStr = formatDate(obligation.date);
        return `A ${amount ? formatMoney(amount) + " " : ""}${name} would leave your ${obligation.name}${dateStr ? ` (${dateStr})` : ""} short by ${formatMoney(obligation.shortfall)}.`;
      }
      return `A ${amount ? formatMoney(amount) + " " : ""}${name} would leave upcoming bills underfunded.`;
    case "ACCOUNT_FLOOR_BREACHED":
      return account
        ? `Your ${account} would fall below its minimum floor after this purchase.`
        : "This purchase would breach a minimum account balance floor.";
    case "EMERGENCY_RESERVE_TOUCHED":
      return impact?.emergencyAmountUsed
        ? `This requires using ${formatMoney(impact.emergencyAmountUsed)} of your protected emergency savings.`
        : "This would draw on your protected emergency reserve.";
    case "TAX_RESERVE_TOUCHED":
      return impact?.taxAmountUsed
        ? `This would use ${formatMoney(impact.taxAmountUsed)} reserved for taxes.`
        : "This would reduce your tax reserve.";
    case "INSUFFICIENT_CLEARED_CASH":
      return `Cleared personal cash only supports ${formatMoney(impact?.maxSafeBudget ?? 0)} in discretionary spending today.`;
    case "PENDING_INCOME_REQUIRED":
      if (impact?.affordabilityAfterIncome) {
        const inc = impact.affordabilityAfterIncome;
        const dateStr = formatDate(inc.date);
        return `The purchase is affordable only if your pending ${formatMoney(inc.amount)} ${inc.incomeName} deposit clears${dateStr ? ` on ${dateStr}` : ""}.`;
      }
      return "You need more cleared cash or confirmed income before this purchase is safe.";
    case "BUSINESS_FUNDS_NOT_AVAILABLE_PERSONALLY":
      return account
        ? `${account} has enough cash, but this is a personal expense and should not be paid from a business account.`
        : "Business account cash is not available for personal spending.";
    case "OVERDRAFT_RISK":
      return "This purchase would create overdraft risk on a linked account.";
    case "BUDGET_EXCEEDED":
      return `Keep ${name} under ${formatMoney(impact?.maxSafeBudget ?? 0)} to stay within safe spending limits.`;
    case "OTHER":
      if (verdict === "GO_AHEAD" || verdict === "GO_AHEAD_WITH_LIMIT") {
        return "Upcoming bills remain fully funded and protected reserves stay intact.";
      }
      return "This purchase does not fit within your current cleared cash and commitments.";
  }
}

function buildBreakdown(
  ctx: PurchaseContext,
  snapshot?: EngineSnapshot
): CFOReasonDetail["breakdown"] {
  const impact = ctx.impact;
  const amount = ctx.amount ?? 0;
  const safeToday = impact?.safeToSpendBefore ?? 0;
  const rows: CFOReasonDetail["breakdown"] = [];

  rows.push({
    label: "Safe personal spending today",
    amount: safeToday,
    status: "AVAILABLE",
  });

  if (amount > 0) {
    rows.push({
      label: `${ctx.name ?? "Purchase"} estimate`,
      amount: -amount,
      status: "RESERVED",
    });
  }

  if (impact) {
    if (impact.requiredCushion > 0) {
      rows.push({
        label: "Required bill cushion",
        amount: -impact.requiredCushion,
        status: "RESERVED",
      });
    }

    if (impact.shortfall > 0) {
      rows.push({
        label: "Resulting shortfall",
        amount: impact.shortfall,
        status: "SHORTFALL",
      });
    } else if (amount > 0) {
      rows.push({
        label: "Safe spending afterward",
        amount: impact.safeToSpendAfter,
        status: "AVAILABLE",
      });
    }
  }

  if (snapshot && rows.length < 4) {
    const obligations = toolObligations(snapshot).slice(0, 2);
    for (const o of obligations) {
      if (!rows.some((r) => r.label.includes(o.name))) {
        rows.push({
          label: `Reserved for ${o.name}`,
          amount: o.amount,
          status: "RESERVED",
        });
      }
    }
  }

  return rows.slice(0, 5);
}

function toolObligations(snapshot: EngineSnapshot) {
  return [
    ...snapshot.bills.filter((b) => b.isRequired).map((b) => ({
      name: b.name,
      amount: b.amount,
      date: b.nextDueDate,
    })),
    ...snapshot.debtPayments.map((d) => ({
      name: d.name,
      amount: d.amount,
      date: d.dueDate,
    })),
  ]
    .filter((o) => o.date)
    .sort((a, b) => (a.date! > b.date! ? 1 : -1));
}

function buildAffordabilityTrigger(
  impact?: PurchaseImpact,
  verdict?: CFOCompactVerdict
): CFOReasonDetail["affordabilityTrigger"] | undefined {
  if (!impact || verdict === "GO_AHEAD" || verdict === "GO_AHEAD_WITH_LIMIT") {
    return undefined;
  }

  if (impact.affordabilityAfterIncome) {
    const inc = impact.affordabilityAfterIncome;
    return {
      type: "INCOME_CLEARS",
      description: `Your next ${inc.incomeName} deposit clears`,
      amount: inc.amount,
      date: inc.date ?? undefined,
    };
  }

  if (impact.underfundedObligation) {
    const o = impact.underfundedObligation;
    return {
      type: "BILL_IS_PAID",
      description: `After ${o.name} is fully funded`,
      amount: o.amount,
      date: o.date,
    };
  }

  return undefined;
}

export function buildReasonDetail(
  verdict: CFOCompactVerdict,
  ctx: PurchaseContext,
  snapshot?: EngineSnapshot
): CFOReasonDetail {
  const impact = ctx.impact;
  const primaryReason: CFOReasonPrimary =
    impact?.primaryReason ??
    (verdict === "NEED_MORE_INFORMATION" ? "OTHER" : "INSUFFICIENT_CLEARED_CASH");

  const maximumSafeAmount = impact?.maxSafeBudget ?? 0;
  const shortfallAmount = impact?.shortfall ?? 0;

  return {
    primaryReason,
    explanation: buildExplanation(primaryReason, ctx, verdict),
    affectedAccount: ctx.accountNickname ?? impact?.affectedAccounts[0]?.nickname,
    affectedObligation: impact?.underfundedObligation?.name,
    affectedDate: impact?.underfundedObligation?.date ?? impact?.affordabilityAfterIncome?.date,
    shortfallAmount: shortfallAmount > 0 ? shortfallAmount : undefined,
    maximumSafeAmount: maximumSafeAmount > 0 ? maximumSafeAmount : undefined,
    affordabilityTrigger: buildAffordabilityTrigger(impact, verdict),
    breakdown: buildBreakdown(ctx, snapshot),
  };
}

export function buildAffordabilitySummary(
  ctx: PurchaseContext,
  verdict: CFOCompactVerdict
): { affordableNow?: string; affordableAfter?: string } {
  const impact = ctx.impact;
  if (!impact || verdict === "NEED_MORE_INFORMATION") return {};

  const maxNow = impact.maxSafeBudget;
  const result: { affordableNow?: string; affordableAfter?: string } = {};

  if (verdict === "GO_AHEAD" || verdict === "GO_AHEAD_WITH_LIMIT") {
    result.affordableNow = `Up to ${formatMoney(ctx.amount ?? maxNow)}`;
    return result;
  }

  result.affordableNow = `Up to ${formatMoney(maxNow)}`;

  if (impact.affordabilityAfterIncome) {
    const inc = impact.affordabilityAfterIncome;
  const dateStr = formatDate(inc.date);
    result.affordableAfter = `Up to ${formatMoney(inc.maxAffordablePurchase)} after ${inc.incomeName} clears${dateStr ? ` on ${dateStr}` : ""}`;
  } else if (ctx.amount && maxNow > 0) {
    result.affordableAfter = undefined;
  }

  return result;
}
