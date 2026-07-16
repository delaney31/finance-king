import type { EngineSnapshot } from "@/lib/engine/types";
import { buildDashboardSnapshot, computeSafeToSpend } from "@/lib/engine";
import { parseDate } from "@/lib/engine/dates";
import { endOfMonth } from "date-fns";
import type { CalculationLine, FinancialStateSnapshot, FinancialWarning } from "./types";

function billsInMonth(snapshot: EngineSnapshot): number {
  const asOf = parseDate(snapshot.asOfDate);
  const monthEnd = endOfMonth(asOf);
  return snapshot.bills
    .filter((b) => {
      if (!b.isRequired) return false;
      if (!b.nextDueDate) return true;
      const due = parseDate(b.nextDueDate);
      return due >= asOf && due <= monthEnd;
    })
    .reduce((s, b) => s + b.amount, 0);
}

function debtInMonth(snapshot: EngineSnapshot): number {
  const asOf = parseDate(snapshot.asOfDate);
  const monthEnd = endOfMonth(asOf);
  return snapshot.debtPayments
    .filter((d) => {
      const due = parseDate(d.dueDate);
      return due >= asOf && due <= monthEnd;
    })
    .reduce((s, d) => s + d.amount, 0);
}

function plannedInMonth(snapshot: EngineSnapshot): number {
  const asOf = parseDate(snapshot.asOfDate);
  const monthEnd = endOfMonth(asOf);
  return snapshot.plannedPurchases
    .filter((p) => p.isCommitted)
    .filter((p) => {
      if (!p.plannedDate) return true;
      const d = parseDate(p.plannedDate);
      return d >= asOf && d <= monthEnd;
    })
    .reduce((s, p) => s + p.maxAmount, 0);
}

function floorShortfall(snapshot: EngineSnapshot): number {
  return snapshot.accounts
    .filter((a) => a.isLiquid && a.routingTag === "PERSONAL")
    .reduce((s, a) => s + Math.max(0, a.minimumTargetBalance - a.currentBalance), 0);
}

export function buildCalculationLines(
  snapshot: EngineSnapshot,
  dashboard: ReturnType<typeof buildDashboardSnapshot>
): CalculationLine[] {
  const lines: CalculationLine[] = [];

  const liquidAccounts = snapshot.accounts.filter(
    (a) => a.isLiquid && !["CREDIT_CARD", "VEHICLE_LOAN", "MORTGAGE", "PERSONAL_LOAN"].includes(a.accountType)
  );

  for (const a of liquidAccounts) {
    lines.push({
      metric: "totalLiquidCash",
      label: a.nickname,
      amount: a.currentBalance,
    });
  }
  lines.push({
    metric: "totalLiquidCash",
    label: "Total",
    amount: dashboard.totalLiquidCash,
  });

  const personalAccounts = liquidAccounts.filter((a) => a.routingTag === "PERSONAL");
  for (const a of personalAccounts) {
    lines.push({
      metric: "personalOperatingCash",
      label: a.nickname,
      amount: a.currentBalance,
    });
    if (a.protectedBalance > 0) {
      lines.push({
        metric: "personalOperatingCash",
        label: `Less protected on ${a.nickname}`,
        amount: -a.protectedBalance,
      });
    }
  }
  lines.push({
    metric: "personalOperatingCash",
    label: "Total personal operating",
    amount: dashboard.personalOperatingCash,
  });

  const sts = computeSafeToSpend(snapshot, "month");
  lines.push(
    { metric: "safeToSpendToday", label: "Cleared personal liquid", amount: dashboard.clearedLiquidCash },
    { metric: "safeToSpendToday", label: "Committed obligations", amount: -sts.committed },
    { metric: "safeToSpendToday", label: "Safe to spend today", amount: dashboard.safeToSpend.today }
  );

  return lines;
}

export function buildFinancialStateFromEngine(
  userId: string,
  engineSnapshot: EngineSnapshot,
  id: string,
  calculatedAt: string,
  sourceBalanceSnapshotIds: string[] = []
): Omit<FinancialStateSnapshot, "dashboard"> & { dashboard: ReturnType<typeof buildDashboardSnapshot> } {
  const dashboard = buildDashboardSnapshot(engineSnapshot);
  const sts = dashboard.safeToSpend;

  const warnings: FinancialWarning[] = [];
  if (dashboard.isProvisional) {
    warnings.push({
      code: "PROVISIONAL_DATA",
      message: `Incomplete data: ${dashboard.missingFields.join(", ")}`,
      severity: "WARN",
    });
  }
  if (dashboard.doNotSpendAmount > 0) {
    warnings.push({
      code: "NEGATIVE_STS",
      message: `Safe-to-spend shortfall of $${dashboard.doNotSpendAmount.toFixed(0)} before clamping`,
      severity: "WARN",
    });
  }

  return {
    id,
    userId,
    calculatedAt,
    asOfDate: engineSnapshot.asOfDate,
    totalLiquidCash: dashboard.totalLiquidCash,
    clearedLiquidCash: dashboard.clearedLiquidCash,
    pendingCash: dashboard.pendingCash,
    projectedCash: dashboard.clearedLiquidCash + dashboard.pendingCash,
    protectedEmergencyReserve: dashboard.protectedEmergency,
    taxReserve: dashboard.taxReserve,
    personalOperatingCash: dashboard.personalOperatingCash,
    businessOperatingCash: dashboard.businessOperatingCash,
    propertyOperatingCash: dashboard.propertyOperatingCash,
    upcomingRequiredBills: billsInMonth(engineSnapshot),
    committedDebtPayments: debtInMonth(engineSnapshot),
    approvedPlannedSpending: plannedInMonth(engineSnapshot),
    minimumAccountFloors: floorShortfall(engineSnapshot),
    safetyMargin: sts.safetyMargin,
    safeToSpendToday: sts.today,
    safeToSpendThisWeek: sts.thisWeek,
    safeToSpendThisMonth: sts.thisMonth,
    doNotSpendAmount: dashboard.doNotSpendAmount,
    monthEndProjectedCash: dashboard.monthEndBuffer,
    yearEndProjectedCash: dashboard.yearEndBuffer,
    personalAccountsTotal: dashboard.personalAccountsTotal,
    businessAccountsTotal: dashboard.businessAccountsTotal,
    jointAccountsTotal: dashboard.jointAccountsTotal,
    totalDebt: dashboard.totalDebt,
    creditUtilization: dashboard.creditUtilization,
    healthScore: dashboard.healthScore.score,
    warnings,
    calculationLines: buildCalculationLines(engineSnapshot, dashboard),
    sourceBalanceSnapshotIds,
    dashboard,
  };
}
