export * from "./types";
export * from "./dates";
export * from "./liquid-cash";
export * from "./safe-to-spend";
export * from "./overdraft";
export * from "./scenarios";
export * from "./credit";
export * from "./purchase-impact";

import type { EngineSnapshot } from "./types";
import { computeAllHorizons } from "./safe-to-spend";
import {
  computeCreditUtilization,
  computeLiquidCash,
  computeClearedLiquidCash,
  computePendingCash,
  computePersonalOperatingCash,
  computeBusinessOperatingCash,
  computePropertyOperatingCash,
  computeProtectedReserves,
  computeTotalDebt,
  computeTotalLiquidCashCurrent,
  computeAccountTotalsByDesignation,
} from "./liquid-cash";
import { computeOverdraftRisk, getSevenDayRiskReport, projectDailyBalances } from "./overdraft";
import { runAllScenarios } from "./scenarios";
import { computeFinancialHealthScore } from "./purchase-impact";

export interface DashboardSnapshot {
  asOfDate: string;
  totalLiquidCash: number;
  clearedLiquidCash: number;
  pendingCash: number;
  protectedEmergency: number;
  taxReserve: number;
  personalOperatingCash: number;
  businessOperatingCash: number;
  propertyOperatingCash: number;
  personalAccountsTotal: number;
  businessAccountsTotal: number;
  jointAccountsTotal: number;
  totalDebt: number;
  creditUtilization: number;
  safeToSpend: ReturnType<typeof computeAllHorizons>;
  doNotSpendAmount: number;
  monthEndBuffer: number;
  yearEndBuffer: number;
  yearEndBufferWithEsop?: number;
  healthScore: ReturnType<typeof computeFinancialHealthScore>;
  overdraftRisks: ReturnType<typeof computeOverdraftRisk>;
  sevenDayRisk: ReturnType<typeof getSevenDayRiskReport>;
  scenarios: ReturnType<typeof runAllScenarios>;
  isProvisional: boolean;
  missingFields: string[];
}

export function buildDashboardSnapshot(snapshot: EngineSnapshot): DashboardSnapshot {
  const liquidCurrent = computeTotalLiquidCashCurrent(snapshot.accounts);
  const clearedLiquid = computeClearedLiquidCash(snapshot.accounts);
  const pendingCash = computePendingCash(snapshot.accounts);
  const reserves = computeProtectedReserves(snapshot);
  const personal = computePersonalOperatingCash(snapshot.accounts);
  const business = computeBusinessOperatingCash(snapshot.accounts);
  const property = computePropertyOperatingCash(snapshot.accounts);
  const accountTotals = computeAccountTotalsByDesignation(snapshot.accounts);
  const debt = computeTotalDebt(snapshot.accounts);
  const utilization = computeCreditUtilization(snapshot.accounts);
  const sts = computeAllHorizons(snapshot);
  const scenarios = runAllScenarios(snapshot);
  const baseScenario = scenarios.find((s) => s.type === "BASE")!;
  const strongScenario = scenarios.find((s) => s.type === "STRONG")!;

  const projections = projectDailyBalances(snapshot, 30);
  const monthEnd = projections[projections.length - 1]?.endingBalance ?? clearedLiquid;

  const rawSafeToday = sts.today;
  const doNotSpend = rawSafeToday < 0 ? Math.abs(rawSafeToday) : 0;

  return {
    asOfDate: snapshot.asOfDate,
    totalLiquidCash: liquidCurrent,
    clearedLiquidCash: clearedLiquid,
    pendingCash,
    protectedEmergency: reserves.emergency,
    taxReserve: reserves.taxReserve,
    personalOperatingCash: personal,
    businessOperatingCash: business,
    propertyOperatingCash: property,
    personalAccountsTotal: accountTotals.personal,
    businessAccountsTotal: accountTotals.business,
    jointAccountsTotal: accountTotals.joint,
    totalDebt: debt,
    creditUtilization: utilization.overall,
    safeToSpend: {
      ...sts,
      today: Math.max(0, rawSafeToday),
    },
    doNotSpendAmount: doNotSpend,
    monthEndBuffer: monthEnd,
    yearEndBuffer: baseScenario.yearEndBuffer,
    yearEndBufferWithEsop: strongScenario.yearEndBufferWithEsop,
    healthScore: computeFinancialHealthScore(snapshot),
    overdraftRisks: computeOverdraftRisk(snapshot),
    sevenDayRisk: getSevenDayRiskReport(snapshot),
    scenarios,
    isProvisional: sts.isProvisional,
    missingFields: sts.missingFields,
  };
}
