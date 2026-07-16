import type { RiskLevel, ScenarioType } from "@prisma/client";

export interface EngineAccount {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
  routingTag: string;
  currentBalance: number;
  minimumTargetBalance: number;
  protectedBalance: number;
  creditLimit?: number | null;
  isLiquid: boolean;
}

export interface EngineIncome {
  id: string;
  name: string;
  amount: number;
  status: "SCHEDULED" | "RECEIVED" | "CANCELLED";
  expectedDate?: string | null;
  receivedDate?: string | null;
  isProvisional?: boolean;
}

export interface EngineBill {
  id: string;
  name: string;
  amount: number;
  nextDueDate?: string | null;
  dueDay?: number | null;
  frequency: string;
  isRequired: boolean;
  accountId?: string | null;
}

export interface EngineDebtPayment {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  accountId?: string | null;
}

export interface EnginePlannedPurchase {
  id: string;
  name: string;
  maxAmount: number;
  plannedDate?: string | null;
  isCommitted: boolean;
  accountId?: string | null;
}

export interface EngineGoal {
  id: string;
  type: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  isProtected: boolean;
  accountId?: string | null;
}

export interface EnginePreferences {
  safetyMarginFlat: number;
  safetyMarginPercent: number;
}

export interface EngineSnapshot {
  asOfDate: string;
  accounts: EngineAccount[];
  income: EngineIncome[];
  bills: EngineBill[];
  debtPayments: EngineDebtPayment[];
  plannedPurchases: EnginePlannedPurchase[];
  goals: EngineGoal[];
  preferences: EnginePreferences;
  provisionalFields: string[];
}

export interface SafeToSpendResult {
  today: number;
  thisWeek: number;
  thisMonth: number;
  nextPayday?: number;
  availableLiquid: number;
  committed: number;
  protectedAmount: number;
  safetyMargin: number;
  isProvisional: boolean;
  missingFields: string[];
}

export interface DailyProjection {
  date: string;
  startingBalance: number;
  scheduledIncome: number;
  scheduledExpenses: number;
  actualSpending: number;
  endingBalance: number;
  safeToSpend: number;
  riskLevel: RiskLevel;
  byAccount: Record<string, number>;
}

export interface OverdraftRisk {
  accountId: string;
  accountName: string;
  riskLevel: RiskLevel;
  lowestBalance: number;
  lowestBalanceDate: string;
  suggestedTransfer?: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    reason: string;
  };
}

export interface ScenarioResult {
  type: ScenarioType;
  monthlyEndingCash: Record<string, number>;
  safeToSpendMonth: number;
  emergencyReserve: number;
  taxReserve: number;
  debtBalance: number;
  yearEndBuffer: number;
  yearEndBufferWithEsop?: number;
}

export interface PurchaseImpact {
  canAffordCash: boolean;
  recommendation: "proceed" | "reduce" | "delay" | "decline";
  affectedAccounts: { accountId: string; before: number; after: number }[];
  monthEndBuffer: number;
  yearEndBuffer: number;
  protectedReservesIntact: boolean;
  billsRemainFunded: boolean;
  maxSafeBudget: number;
  warnings: string[];
}

export interface CreditCardState {
  id: string;
  name: string;
  balance: number;
  limit: number;
  apr: number;
  minimumPayment: number;
  dueDay?: number | null;
}

export interface PayoffPlan {
  strategy: "avalanche" | "snowball";
  monthlyPayment: number;
  payoffDate: string;
  totalInterest: number;
  payments: { month: string; cardId: string; amount: number; remainingBalance: number }[];
}
