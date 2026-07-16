import { endOfMonth, endOfYear, parseISO } from "date-fns";
import { computeProtectedReserves } from "./liquid-cash";
import { computeSafeToSpend } from "./safe-to-spend";
import { runScenarioForecast } from "./scenarios";
import type { EngineSnapshot, PurchaseImpact } from "./types";

export interface PurchaseRequest {
  name: string;
  amount: number;
  date: string;
  accountId: string;
  isRecurring?: boolean;
  isBusiness?: boolean;
}

export function simulatePurchaseImpact(
  snapshot: EngineSnapshot,
  purchase: PurchaseRequest
): PurchaseImpact {
  const warnings: string[] = [];
  const account = snapshot.accounts.find((a) => a.id === purchase.accountId);

  if (!account) {
    return {
      canAffordCash: false,
      recommendation: "decline",
      affectedAccounts: [],
      monthEndBuffer: 0,
      yearEndBuffer: 0,
      protectedReservesIntact: false,
      billsRemainFunded: false,
      maxSafeBudget: 0,
      warnings: ["Account not found"],
    };
  }

  const stsBefore = computeSafeToSpend(snapshot, "month");
  const maxSafeBudget = stsBefore.today;

  if (account.routingTag === "EMERGENCY") {
    warnings.push("Cannot spend from protected emergency reserve");
    return {
      canAffordCash: false,
      recommendation: "decline",
      affectedAccounts: [{ accountId: account.id, before: account.currentBalance, after: account.currentBalance }],
      monthEndBuffer: stsBefore.today,
      yearEndBuffer: runScenarioForecast(snapshot, "BASE").yearEndBuffer,
      protectedReservesIntact: false,
      billsRemainFunded: true,
      maxSafeBudget,
      warnings,
    };
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

  const protectedIntact =
    reserves.emergency >= reservesBefore.emergency &&
    reserves.taxReserve >= reservesBefore.taxReserve;

  if (!protectedIntact) warnings.push("Would reduce protected reserves");
  if (afterBalance < account.minimumTargetBalance) {
    warnings.push(`Would fall below minimum floor on ${account.nickname}`);
  }
  if (stsAfter.today < 0) warnings.push("Would exceed safe-to-spend limit");

  const canAfford = purchase.amount <= maxSafeBudget && protectedIntact;
  const billsFunded = stsAfter.today >= 0;

  let recommendation: PurchaseImpact["recommendation"] = "proceed";
  if (!canAfford && purchase.amount > maxSafeBudget * 1.5) {
    recommendation = "decline";
  } else if (!canAfford) {
    recommendation = "delay";
  } else if (purchase.amount > maxSafeBudget * 0.8) {
    recommendation = "reduce";
  }

  const yearEnd = runScenarioForecast(modifiedSnapshot, "BASE").yearEndBuffer;

  return {
    canAffordCash: canAfford,
    recommendation,
    affectedAccounts: [
      { accountId: account.id, before: account.currentBalance, after: afterBalance },
    ],
    monthEndBuffer: stsAfter.today,
    yearEndBuffer: yearEnd,
    protectedReservesIntact: protectedIntact,
    billsRemainFunded: billsFunded,
    maxSafeBudget,
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
