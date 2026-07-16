import type { DashboardSnapshot } from "@/lib/engine";

export interface FinancialWarning {
  code: string;
  message: string;
  severity: "INFO" | "WARN" | "CRITICAL";
}

export interface CalculationLine {
  metric: string;
  label: string;
  amount: number;
  description?: string;
}

export interface FinancialStateSnapshot {
  id: string;
  userId: string;
  calculatedAt: string;
  asOfDate: string;

  totalLiquidCash: number;
  clearedLiquidCash: number;
  pendingCash: number;
  projectedCash: number;

  protectedEmergencyReserve: number;
  taxReserve: number;
  personalOperatingCash: number;
  businessOperatingCash: number;
  propertyOperatingCash: number;

  upcomingRequiredBills: number;
  committedDebtPayments: number;
  approvedPlannedSpending: number;
  minimumAccountFloors: number;
  safetyMargin: number;

  safeToSpendToday: number;
  safeToSpendThisWeek: number;
  safeToSpendThisMonth: number;
  doNotSpendAmount: number;

  monthEndProjectedCash: number;
  yearEndProjectedCash: number;

  personalAccountsTotal: number;
  businessAccountsTotal: number;
  jointAccountsTotal: number;

  totalDebt: number;
  creditUtilization: number;
  healthScore: number;

  warnings: FinancialWarning[];
  calculationLines: CalculationLine[];
  sourceBalanceSnapshotIds: string[];

  /** Full dashboard payload for charts and scenarios */
  dashboard: DashboardSnapshot;
}

export type FinancialStateChangedEvent = {
  userId: string;
  previousSnapshotId: string;
  newSnapshotId: string;
  reason: string;
  changedEntityIds: string[];
};

export const FINANCIAL_STATE_CHANGED_EVENT = "finance-king:financial-state-changed";
