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
  computeOperatingCash,
  computeProtectedReserves,
  computeTotalDebt,
} from "./liquid-cash";
import { computeOverdraftRisk, getSevenDayRiskReport, projectDailyBalances } from "./overdraft";
import { runAllScenarios } from "./scenarios";
import { computeFinancialHealthScore } from "./purchase-impact";

export interface DashboardSnapshot {
  asOfDate: string;
  totalLiquidCash: number;
  protectedEmergency: number;
  taxReserve: number;
  personalOperatingCash: number;
  businessOperatingCash: number;
  totalDebt: number;
  creditUtilization: number;
  safeToSpend: ReturnType<typeof computeAllHorizons>;
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
  const liquid = computeLiquidCash(snapshot.accounts);
  const reserves = computeProtectedReserves(snapshot);
  const personal = computeOperatingCash(snapshot.accounts, ["PERSONAL", "EMERGENCY"]);
  const business = computeOperatingCash(snapshot.accounts, [
    "JADESYSTEMS",
    "PACIFIC_LUXE",
    "NY_PROPERTY",
    "TAX_RESERVE",
  ]);
  const debt = computeTotalDebt(snapshot.accounts);
  const utilization = computeCreditUtilization(snapshot.accounts);
  const sts = computeAllHorizons(snapshot);
  const scenarios = runAllScenarios(snapshot);
  const baseScenario = scenarios.find((s) => s.type === "BASE")!;
  const strongScenario = scenarios.find((s) => s.type === "STRONG")!;

  const projections = projectDailyBalances(snapshot, 30);
  const monthEnd = projections[projections.length - 1]?.endingBalance ?? liquid;

  return {
    asOfDate: snapshot.asOfDate,
    totalLiquidCash: liquid,
    protectedEmergency: reserves.emergency,
    taxReserve: reserves.taxReserve,
    personalOperatingCash: personal,
    businessOperatingCash: business,
    totalDebt: debt,
    creditUtilization: utilization.overall,
    safeToSpend: sts,
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
