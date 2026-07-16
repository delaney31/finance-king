import { computeProtectedReserves } from "./liquid-cash";
import { computeSafeToSpend } from "./safe-to-spend";
import { runScenarioForecast } from "./scenarios";
import type { EngineSnapshot, PurchaseImpact, PurchasePrimaryReason } from "./types";

export interface PurchaseRequest {
  name: string;
  amount: number;
  date: string;
  accountId: string;
  isRecurring?: boolean;
  isBusiness?: boolean;
}

function findUnderfundedObligation(
  snapshot: EngineSnapshot,
  shortfall: number
): PurchaseImpact["underfundedObligation"] | undefined {
  if (shortfall <= 0) return undefined;

  const obligations = [
    ...snapshot.bills
      .filter((b) => b.isRequired)
      .map((b) => ({
        name: b.name,
        amount: b.amount,
        date: b.nextDueDate ?? undefined,
      })),
    ...snapshot.debtPayments.map((d) => ({
      name: d.name,
      amount: d.amount,
      date: d.dueDate,
    })),
  ]
    .filter((o) => o.date)
    .sort((a, b) => (a.date! > b.date! ? 1 : -1));

  const next = obligations[0];
  if (!next) return undefined;

  return {
    name: next.name,
    amount: next.amount,
    date: next.date,
    shortfall,
  };
}

function findAffordabilityAfterIncome(
  snapshot: EngineSnapshot,
  purchaseAmount: number,
  accountId: string
): PurchaseImpact["affordabilityAfterIncome"] | undefined {
  const nextIncome = snapshot.income
    .filter((i) => i.status === "SCHEDULED" && i.expectedDate)
    .sort((a, b) => (a.expectedDate! > b.expectedDate! ? 1 : -1))[0];

  if (!nextIncome) return undefined;

  const incomeDate = nextIncome.expectedDate!;
  const modifiedSnapshot: EngineSnapshot = {
    ...snapshot,
    accounts: snapshot.accounts.map((a) =>
      a.id === accountId
        ? { ...a, currentBalance: a.currentBalance + nextIncome.amount }
        : a
    ),
    income: snapshot.income.map((i) =>
      i.id === nextIncome.id
        ? { ...i, status: "RECEIVED", receivedDate: incomeDate }
        : i
    ),
  };

  const stsAfterIncome = computeSafeToSpend(modifiedSnapshot, "month");
  const maxAffordable = stsAfterIncome.today;

  if (maxAffordable < purchaseAmount) return undefined;

  return {
    incomeName: nextIncome.name,
    amount: nextIncome.amount,
    date: incomeDate,
    safeToSpendAfter: maxAffordable,
    maxAffordablePurchase: maxAffordable,
  };
}

function detectPrimaryReason(params: {
  isBusiness?: boolean;
  accountRoutingTag?: string;
  protectedIntact: boolean;
  emergencyAmountUsed: number;
  taxAmountUsed: number;
  billsFunded: boolean;
  floorBreached: boolean;
  canAfford: boolean;
  amount: number;
  maxSafeBudget: number;
  recommendation: PurchaseImpact["recommendation"];
  warnings: string[];
}): PurchasePrimaryReason {
  if (params.isBusiness && params.accountRoutingTag && params.accountRoutingTag !== "PERSONAL") {
    return "BUSINESS_FUNDS_NOT_AVAILABLE_PERSONALLY";
  }
  if (params.emergencyAmountUsed > 0) return "EMERGENCY_RESERVE_TOUCHED";
  if (params.taxAmountUsed > 0) return "TAX_RESERVE_TOUCHED";
  if (!params.billsFunded) return "UPCOMING_BILLS_UNDERFUNDED";
  if (params.floorBreached) return "ACCOUNT_FLOOR_BREACHED";
  if (params.warnings.some((w) => /overdraft/i.test(w))) return "OVERDRAFT_RISK";
  if (params.recommendation === "reduce") return "BUDGET_EXCEEDED";
  if (!params.canAfford && params.amount > params.maxSafeBudget) {
    return "INSUFFICIENT_CLEARED_CASH";
  }
  if (!params.canAfford) return "PENDING_INCOME_REQUIRED";
  return "OTHER";
}

function emptyImpact(overrides: Partial<PurchaseImpact> = {}): PurchaseImpact {
  return {
    canAffordCash: false,
    recommendation: "decline",
    affectedAccounts: [],
    monthEndBuffer: 0,
    yearEndBuffer: 0,
    protectedReservesIntact: false,
    billsRemainFunded: false,
    maxSafeBudget: 0,
    safeToSpendBefore: 0,
    safeToSpendAfter: 0,
    requiredCushion: 0,
    shortfall: 0,
    emergencyAmountUsed: 0,
    taxAmountUsed: 0,
    primaryReason: "OTHER",
    warnings: [],
    ...overrides,
  };
}

export function simulatePurchaseImpact(
  snapshot: EngineSnapshot,
  purchase: PurchaseRequest
): PurchaseImpact {
  const warnings: string[] = [];
  const account = snapshot.accounts.find((a) => a.id === purchase.accountId);

  if (!account) {
    return emptyImpact({
      warnings: ["Account not found"],
      primaryReason: "OTHER",
    });
  }

  const stsBefore = computeSafeToSpend(snapshot, "month");
  const maxSafeBudget = stsBefore.today;
  const requiredCushion = stsBefore.committed;

  if (account.routingTag === "EMERGENCY") {
    warnings.push("Cannot spend from protected emergency reserve");
    return emptyImpact({
      recommendation: "decline",
      affectedAccounts: [
        { accountId: account.id, nickname: account.nickname, before: account.currentBalance, after: account.currentBalance },
      ],
      monthEndBuffer: stsBefore.today,
      yearEndBuffer: runScenarioForecast(snapshot, "BASE").yearEndBuffer,
      protectedReservesIntact: false,
      billsRemainFunded: true,
      maxSafeBudget,
      safeToSpendBefore: maxSafeBudget,
      safeToSpendAfter: maxSafeBudget,
      requiredCushion,
      shortfall: purchase.amount,
      emergencyAmountUsed: purchase.amount,
      primaryReason: "EMERGENCY_RESERVE_TOUCHED",
      warnings,
    });
  }

  if (purchase.isBusiness === false && account.routingTag !== "PERSONAL" && account.routingTag !== "NY_PROPERTY") {
    warnings.push(`${account.nickname} is not a personal spending account`);
  }

  const afterBalance = account.currentBalance - purchase.amount;
  const modifiedSnapshot: EngineSnapshot = {
    ...snapshot,
    accounts: snapshot.accounts.map((a) =>
      a.id === purchase.accountId ? { ...a, currentBalance: afterBalance } : a
    ),
    plannedPurchases: [
      ...snapshot.plannedPurchases,
      {
        id: "simulated",
        name: purchase.name,
        maxAmount: purchase.amount,
        plannedDate: purchase.date,
        isCommitted: true,
        accountId: purchase.accountId,
      },
    ],
  };

  const stsAfter = computeSafeToSpend(modifiedSnapshot, "month");
  const reserves = computeProtectedReserves(modifiedSnapshot);
  const reservesBefore = computeProtectedReserves(snapshot);

  const emergencyAmountUsed = Math.max(0, reservesBefore.emergency - reserves.emergency);
  const taxAmountUsed = Math.max(0, reservesBefore.taxReserve - reserves.taxReserve);

  const protectedIntact =
    reserves.emergency >= reservesBefore.emergency &&
    reserves.taxReserve >= reservesBefore.taxReserve;

  const floorBreached = afterBalance < account.minimumTargetBalance;
  if (!protectedIntact) warnings.push("Would reduce protected reserves");
  if (floorBreached) {
    warnings.push(`Would fall below minimum floor on ${account.nickname}`);
  }
  if (stsAfter.today < 0) warnings.push("Would exceed safe-to-spend limit");

  const canAfford = purchase.amount <= maxSafeBudget && protectedIntact;
  const billsFunded = stsAfter.today >= 0;

  const safeToSpendAfter = Math.max(0, maxSafeBudget - purchase.amount);
  const shortfall = canAfford
    ? 0
    : Math.max(
        purchase.amount > maxSafeBudget ? purchase.amount - maxSafeBudget : 0,
        stsAfter.today < 0 ? Math.abs(stsAfter.today) : 0
      );

  let recommendation: PurchaseImpact["recommendation"] = "proceed";
  if (!canAfford && purchase.amount > maxSafeBudget * 1.5) {
    recommendation = "decline";
  } else if (!canAfford) {
    recommendation = "delay";
  } else if (purchase.amount > maxSafeBudget * 0.8) {
    recommendation = "reduce";
  }

  const primaryReason = detectPrimaryReason({
    isBusiness: purchase.isBusiness,
    accountRoutingTag: account.routingTag,
    protectedIntact,
    emergencyAmountUsed,
    taxAmountUsed,
    billsFunded,
    floorBreached,
    canAfford,
    amount: purchase.amount,
    maxSafeBudget,
    recommendation,
    warnings,
  });

  const underfundedObligation = !billsFunded
    ? findUnderfundedObligation(snapshot, shortfall)
    : undefined;

  const affordabilityAfterIncome =
    !canAfford
      ? findAffordabilityAfterIncome(snapshot, purchase.amount, purchase.accountId)
      : undefined;

  const yearEnd = runScenarioForecast(modifiedSnapshot, "BASE").yearEndBuffer;

  return {
    canAffordCash: canAfford,
    recommendation,
    affectedAccounts: [
      { accountId: account.id, nickname: account.nickname, before: account.currentBalance, after: afterBalance },
    ],
    monthEndBuffer: stsAfter.today,
    yearEndBuffer: yearEnd,
    protectedReservesIntact: protectedIntact,
    billsRemainFunded: billsFunded,
    maxSafeBudget,
    safeToSpendBefore: maxSafeBudget,
    safeToSpendAfter,
    requiredCushion,
    shortfall,
    emergencyAmountUsed,
    taxAmountUsed,
    primaryReason,
    underfundedObligation,
    affordabilityAfterIncome,
    warnings,
  };
}

export function computeFinancialHealthScore(snapshot: EngineSnapshot): {
  score: number;
  label: string;
  factors: { name: string; score: number; weight: number }[];
} {
  const sts = computeSafeToSpend(snapshot, "month");
  const reserves = computeProtectedReserves(snapshot);
  const emergencyGoal = snapshot.goals.find((g) => g.type === "EMERGENCY_FUND");
  const emergencyPct = emergencyGoal
    ? Math.min(1, reserves.emergency / emergencyGoal.targetAmount)
    : 0.5;

  const stsRatio = sts.availableLiquid > 0 ? Math.min(1, sts.today / sts.availableLiquid) : 0;

  const factors = [
    { name: "Safe to Spend", score: stsRatio * 100, weight: 0.3 },
    { name: "Emergency Fund", score: emergencyPct * 100, weight: 0.3 },
    { name: "Tax Reserve", score: reserves.taxShortfall === 0 ? 100 : 50, weight: 0.2 },
    { name: "Data Completeness", score: snapshot.provisionalFields.length === 0 ? 100 : 60, weight: 0.2 },
  ];

  const score = Math.round(
    factors.reduce((s, f) => s + f.score * f.weight, 0)
  );

  let label = "Needs Attention";
  if (score >= 80) label = "Strong";
  else if (score >= 60) label = "Stable";
  else if (score >= 40) label = "Cautious";

  return { score, label, factors };
}
