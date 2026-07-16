import { prisma } from "@/lib/db";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { buildFinancialStateFromEngine } from "./build";
import type { FinancialStateSnapshot } from "./types";

export interface RecalculateOptions {
  reason?: string;
  sourceEventId?: string;
  sourceBalanceSnapshotIds?: string[];
}

export async function recalculateFinancialState(
  userId: string,
  options?: RecalculateOptions
): Promise<FinancialStateSnapshot> {
  const engineSnapshot = await getEngineSnapshot(userId);
  const calculatedAt = new Date().toISOString();

  const dashboardPreview = buildFinancialStateFromEngine(
    userId,
    engineSnapshot,
    "preview",
    calculatedAt,
    options?.sourceBalanceSnapshotIds ?? []
  );

  const record = await prisma.financialStateSnapshot.create({
    data: {
      userId,
      asOfDate: new Date(engineSnapshot.asOfDate),
      payload: {
        ...dashboardPreview.dashboard,
        calculationLines: dashboardPreview.calculationLines,
        warnings: dashboardPreview.warnings,
        reason: options?.reason,
        sourceEventId: options?.sourceEventId,
      } as object,
      safeToSpendToday: dashboardPreview.safeToSpendToday,
      monthEndBuffer: dashboardPreview.monthEndProjectedCash,
      creditUtilization: dashboardPreview.creditUtilization,
      totalLiquidCash: dashboardPreview.totalLiquidCash,
    },
  });

  return buildFinancialStateFromEngine(
    userId,
    engineSnapshot,
    record.id,
    calculatedAt,
    options?.sourceBalanceSnapshotIds ?? []
  );
}

export async function getLatestFinancialState(userId: string): Promise<FinancialStateSnapshot | null> {
  const latest = await prisma.financialStateSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return null;

  const engineSnapshot = await getEngineSnapshot(userId);
  const payload = latest.payload as Record<string, unknown>;
  const state = buildFinancialStateFromEngine(
    userId,
    engineSnapshot,
    latest.id,
    latest.createdAt.toISOString()
  );

  // Use persisted dashboard if engine hasn't changed materially — for speed use fresh compute
  return state;
}

export async function getOrRecalculateFinancialState(
  userId: string,
  options?: RecalculateOptions
): Promise<FinancialStateSnapshot> {
  const latest = await getLatestFinancialState(userId);
  const engineSnapshot = await getEngineSnapshot(userId);

  if (latest && latest.asOfDate === engineSnapshot.asOfDate) {
    const ageMs = Date.now() - new Date(latest.calculatedAt).getTime();
    if (ageMs < 60_000) return latest;
  }

  return recalculateFinancialState(userId, options);
}
