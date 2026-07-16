import type { ScenarioType } from "@prisma/client";
import { addMonths, endOfYear, format } from "date-fns";
import { computeLiquidCash, computeProtectedReserves, computeTotalDebt } from "./liquid-cash";
import { computeSafeToSpend } from "./safe-to-spend";
import { parseDate, toDateString } from "./dates";
import type { EngineSnapshot, ScenarioResult } from "./types";

interface ScenarioParams {
  incomeMultiplier: number;
  expenseMultiplier: number;
  includeNewContractAfterOctober: boolean;
  includeEsop: boolean;
  esopAmount?: number;
  incomeDelayDays: number;
}

const SCENARIO_DEFAULTS: Record<ScenarioType, ScenarioParams> = {
  CONSERVATIVE: {
    incomeMultiplier: 0.9,
    expenseMultiplier: 1.1,
    includeNewContractAfterOctober: false,
    includeEsop: false,
    incomeDelayDays: 7,
  },
  BASE: {
    incomeMultiplier: 1.0,
    expenseMultiplier: 1.0,
    includeNewContractAfterOctober: false,
    includeEsop: false,
    incomeDelayDays: 0,
  },
  STRONG: {
    incomeMultiplier: 1.0,
    expenseMultiplier: 1.0,
    includeNewContractAfterOctober: true,
    includeEsop: true,
    esopAmount: 105000,
    incomeDelayDays: 0,
  },
};

function applyScenarioToSnapshot(
  snapshot: EngineSnapshot,
  params: ScenarioParams
): EngineSnapshot {
  const octEnd = new Date(snapshot.asOfDate.slice(0, 4) + "-10-31");

  return {
    ...snapshot,
    income: snapshot.income
      .filter((i) => {
        if (!params.includeNewContractAfterOctober && i.name.toLowerCase().includes("new contract")) {
          if (i.expectedDate && parseDate(i.expectedDate) > octEnd) return false;
        }
        return true;
      })
      .map((i) => ({
        ...i,
        amount: i.amount * params.incomeMultiplier,
      })),
    bills: snapshot.bills.map((b) => ({
      ...b,
      amount: b.amount * params.expenseMultiplier,
    })),
    debtPayments: snapshot.debtPayments.map((p) => ({
      ...p,
      amount: p.amount,
    })),
  };
}

export function runScenarioForecast(
  snapshot: EngineSnapshot,
  type: ScenarioType,
  customParams?: Partial<ScenarioParams>
): ScenarioResult {
  const params = { ...SCENARIO_DEFAULTS[type], ...customParams };
  const adjusted = applyScenarioToSnapshot(snapshot, params);
  const asOf = parseDate(snapshot.asOfDate);
  const yearEnd = endOfYear(asOf);

  const monthlyEndingCash: Record<string, number> = {};
  let runningCash = computeLiquidCash(adjusted.accounts);

  let cursor = asOf;
  while (cursor <= yearEnd) {
    const monthKey = format(cursor, "yyyy-MM");
    const monthIncome = adjusted.income
      .filter(
        (i) =>
          i.expectedDate &&
          i.expectedDate.startsWith(monthKey) &&
          i.status !== "CANCELLED"
      )
      .reduce((s, i) => s + i.amount, 0);

    const monthExpenses = adjusted.bills
      .filter((b) => b.frequency === "MONTHLY")
      .reduce((s, b) => s + b.amount, 0);

    const monthDebt = adjusted.debtPayments
      .filter((p) => p.dueDate.startsWith(monthKey))
      .reduce((s, p) => s + p.amount, 0);

    runningCash = runningCash + monthIncome - monthExpenses - monthDebt;
    monthlyEndingCash[monthKey] = runningCash;
    cursor = addMonths(cursor, 1);
  }

  const reserves = computeProtectedReserves(adjusted);
  const sts = computeSafeToSpend(adjusted, "month");
  const debt = computeTotalDebt(adjusted.accounts);

  const yearEndBuffer = runningCash;
  let yearEndBufferWithEsop = yearEndBuffer;

  if (params.includeEsop && params.esopAmount) {
    yearEndBufferWithEsop = yearEndBuffer + params.esopAmount;
  }

  return {
    type,
    monthlyEndingCash,
    safeToSpendMonth: sts.today,
    emergencyReserve: reserves.emergency,
    taxReserve: reserves.taxReserve,
    debtBalance: debt,
    yearEndBuffer,
    yearEndBufferWithEsop: params.includeEsop ? yearEndBufferWithEsop : undefined,
  };
}

export function runAllScenarios(snapshot: EngineSnapshot): ScenarioResult[] {
  return (["CONSERVATIVE", "BASE", "STRONG"] as ScenarioType[]).map((t) =>
    runScenarioForecast(snapshot, t)
  );
}
