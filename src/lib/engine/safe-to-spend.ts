import { addDays, endOfMonth, endOfWeek } from "date-fns";
import { decimalToNumber, sumMoney, toDecimal } from "@/lib/utils/money";
import { getMonthEnd, getWeekEnd, isOnOrAfter, isOnOrBefore, parseDate, toDateString } from "./dates";
import { computeLiquidCash, computeProtectedReserves } from "./liquid-cash";
import type { EngineBill, EngineDebtPayment, EnginePlannedPurchase, EngineSnapshot, SafeToSpendResult } from "./types";

function getHorizonEnd(asOf: Date, horizon: "today" | "week" | "month" | "payday", nextPayday?: Date): Date {
  switch (horizon) {
    case "today":
      return asOf;
    case "week":
      return getWeekEnd(asOf);
    case "month":
      return getMonthEnd(asOf);
    case "payday":
      return nextPayday ?? getWeekEnd(asOf);
  }
}

function billsInHorizon(bills: EngineBill[], asOf: Date, horizonEnd: Date): EngineBill[] {
  return bills.filter((b) => {
    if (!b.nextDueDate) {
      if (b.dueDay) {
        const dueThisMonth = new Date(asOf.getFullYear(), asOf.getMonth(), b.dueDay);
        return dueThisMonth >= asOf && dueThisMonth <= horizonEnd;
      }
      return b.frequency === "MONTHLY";
    }
    const due = parseDate(b.nextDueDate);
    return due >= asOf && due <= horizonEnd;
  });
}

function debtPaymentsInHorizon(
  payments: EngineDebtPayment[],
  asOf: Date,
  horizonEnd: Date
): EngineDebtPayment[] {
  return payments.filter((p) => {
    const due = parseDate(p.dueDate);
    return due >= asOf && due <= horizonEnd;
  });
}

function plannedInHorizon(
  purchases: EnginePlannedPurchase[],
  asOf: Date,
  horizonEnd: Date
): EnginePlannedPurchase[] {
  return purchases.filter((p) => {
    if (!p.isCommitted) return false;
    if (!p.plannedDate) return true;
    const d = parseDate(p.plannedDate);
    return d >= asOf && d <= horizonEnd;
  });
}

function computeFloorShortfall(accounts: EngineSnapshot["accounts"]): number {
  return accounts
    .filter((a) => a.isLiquid)
    .reduce((sum, a) => sum + Math.max(0, a.minimumTargetBalance - a.currentBalance), 0);
}

function computeSafetyMargin(snapshot: EngineSnapshot, availableLiquid: number): number {
  const flat = snapshot.preferences.safetyMarginFlat;
  const pct = snapshot.preferences.safetyMarginPercent;
  return flat + availableLiquid * pct;
}

function computeCommitted(
  snapshot: EngineSnapshot,
  asOf: Date,
  horizonEnd: Date
): { total: number; missing: string[] } {
  const missing: string[] = [];
  const reserves = computeProtectedReserves(snapshot);

  const horizonBills = billsInHorizon(snapshot.bills, asOf, horizonEnd);
  const horizonDebt = debtPaymentsInHorizon(snapshot.debtPayments, asOf, horizonEnd);
  const horizonPlanned = plannedInHorizon(snapshot.plannedPurchases, asOf, horizonEnd);

  if (snapshot.bills.some((b) => b.isRequired && !b.nextDueDate && !b.dueDay)) {
    missing.push("bill_due_dates");
  }

  const billTotal = horizonBills.filter((b) => b.isRequired).map((b) => b.amount);
  const debtTotal = horizonDebt.map((p) => p.amount);
  const plannedTotal = horizonPlanned.map((p) => p.maxAmount);
  const floorShortfall = computeFloorShortfall(snapshot.accounts);

  const availableLiquid = computeLiquidCash(snapshot.accounts);
  const safetyMargin = computeSafetyMargin(snapshot, availableLiquid);

  const total = decimalToNumber(
    sumMoney([
      reserves.emergencyShortfall,
      reserves.taxShortfall,
      ...billTotal,
      ...debtTotal,
      ...plannedTotal,
      floorShortfall,
      safetyMargin,
    ])
  );

  return { total, missing };
}

function computeSafeToSpendForHorizon(
  snapshot: EngineSnapshot,
  horizon: "today" | "week" | "month" | "payday",
  nextPayday?: Date
): number {
  const asOf = parseDate(snapshot.asOfDate);
  const horizonEnd = getHorizonEnd(asOf, horizon, nextPayday);
  const availableLiquid = computeLiquidCash(snapshot.accounts);
  const { total: committed } = computeCommitted(snapshot, asOf, horizonEnd);
  return Math.max(0, availableLiquid - committed);
}

export function computeSafeToSpend(
  snapshot: EngineSnapshot,
  horizon: "today" | "week" | "month" | "payday" = "today",
  nextPayday?: Date
): SafeToSpendResult {
  const asOf = parseDate(snapshot.asOfDate);
  const horizonEnd = getHorizonEnd(asOf, horizon, nextPayday);
  const availableLiquid = computeLiquidCash(snapshot.accounts);
  const { total: committed, missing } = computeCommitted(snapshot, asOf, horizonEnd);
  const reserves = computeProtectedReserves(snapshot);
  const safetyMargin = computeSafetyMargin(snapshot, availableLiquid);

  const safeToSpend = Math.max(0, availableLiquid - committed);

  return {
    today: computeSafeToSpendForHorizon(snapshot, "today"),
    thisWeek: computeSafeToSpendForHorizon(snapshot, "week"),
    thisMonth: computeSafeToSpendForHorizon(snapshot, "month"),
    nextPayday: nextPayday
      ? computeSafeToSpendForHorizon(snapshot, "payday", nextPayday)
      : undefined,
    availableLiquid,
    committed,
    protectedAmount: reserves.totalProtected,
    safetyMargin,
    isProvisional: missing.length > 0 || snapshot.provisionalFields.length > 0,
    missingFields: [...missing, ...snapshot.provisionalFields],
  };
}

export function computeAllHorizons(
  snapshot: EngineSnapshot,
  nextPayday?: Date
): SafeToSpendResult {
  const todayResult = computeSafeToSpend(snapshot, "today");
  const weekResult = computeSafeToSpend(snapshot, "week");
  const monthResult = computeSafeToSpend(snapshot, "month");
  const paydayResult = nextPayday
    ? computeSafeToSpend(snapshot, "payday", nextPayday)
    : undefined;

  return {
    today: todayResult.today,
    thisWeek: weekResult.thisWeek,
    thisMonth: monthResult.thisMonth,
    nextPayday: paydayResult?.today,
    availableLiquid: todayResult.availableLiquid,
    committed: todayResult.committed,
    protectedAmount: todayResult.protectedAmount,
    safetyMargin: todayResult.safetyMargin,
    isProvisional: todayResult.isProvisional,
    missingFields: todayResult.missingFields,
  };
}
