import { prisma } from "@/lib/db";
import { buildDashboardSnapshot } from "@/lib/engine";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import type { FinancialStateSnapshot } from "./types";

export { buildImportSummaryMessage } from "./import-summary";

export async function recalculateFinancialState(userId: string): Promise<FinancialStateSnapshot> {
  const engineSnapshot = await getEngineSnapshot(userId);
  const dashboard = buildDashboardSnapshot(engineSnapshot);
  const calculatedAt = new Date().toISOString();

  await prisma.financialStateSnapshot.create({
    data: {
      userId,
      asOfDate: new Date(engineSnapshot.asOfDate),
      payload: dashboard as object,
      safeToSpendToday: dashboard.safeToSpend.today,
      monthEndBuffer: dashboard.monthEndBuffer,
      creditUtilization: dashboard.creditUtilization,
      totalLiquidCash: dashboard.totalLiquidCash,
    },
  });

  return {
    userId,
    asOfDate: engineSnapshot.asOfDate,
    dashboard,
    calculatedAt,
  };
}
