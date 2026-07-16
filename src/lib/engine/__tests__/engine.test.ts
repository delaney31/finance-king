import { describe, it, expect } from "vitest";
import {
  computeLiquidCash,
  computeProtectedReserves,
  computeSafeToSpend,
  computeAllHorizons,
  computeTotalDebt,
  computeCreditUtilization,
  runScenarioForecast,
  runAllScenarios,
  simulatePurchaseImpact,
  computeOverdraftRisk,
  buildDashboardSnapshot,
} from "@/lib/engine";
import type { EngineSnapshot } from "@/lib/engine/types";

const seedSnapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    { id: "1", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING", routingTag: "PERSONAL", currentBalance: 24032.25, minimumTargetBalance: 10000, protectedBalance: 0, isLiquid: true },
    { id: "2", nickname: "PenFed Savings", institution: "PenFed", accountType: "SAVINGS", routingTag: "EMERGENCY", currentBalance: 40000.01, minimumTargetBalance: 40000, protectedBalance: 40000, isLiquid: true },
    { id: "3", nickname: "Wells Fargo Joint", institution: "Wells Fargo", accountType: "JOINT_CHECKING", routingTag: "NY_PROPERTY", currentBalance: 1000, minimumTargetBalance: 0, protectedBalance: 0, isLiquid: true },
    { id: "4", nickname: "Amex", institution: "Amex", accountType: "CREDIT_CARD", routingTag: "PERSONAL", currentBalance: -30000, minimumTargetBalance: 0, protectedBalance: 0, creditLimit: 35000, isLiquid: false },
  ],
  income: [
    { id: "i1", name: "W-2", amount: 5000, status: "RECEIVED", expectedDate: "2025-07-01", receivedDate: "2025-07-01" },
    { id: "i2", name: "Contract", amount: 18600, status: "SCHEDULED", expectedDate: "2025-08-01" },
  ],
  bills: [
    { id: "b1", name: "NY Mortgage", amount: 8200, nextDueDate: "2025-08-01", dueDay: 1, frequency: "MONTHLY", isRequired: true },
    { id: "b2", name: "Santa Monica Rent", amount: 5700, nextDueDate: "2025-08-01", dueDay: 1, frequency: "MONTHLY", isRequired: true },
    { id: "b3", name: "Porsche Payment", amount: 5700, nextDueDate: "2025-08-15", dueDay: 15, frequency: "MONTHLY", isRequired: true },
    { id: "b4", name: "Tax Payment", amount: 900, nextDueDate: "2025-07-20", dueDay: 10, frequency: "MONTHLY", isRequired: true },
    { id: "b5", name: "401k Repayment", amount: 600, nextDueDate: "2025-07-25", dueDay: 20, frequency: "MONTHLY", isRequired: true },
    { id: "b6", name: "Living Expenses", amount: 6000, nextDueDate: "2025-08-01", dueDay: 1, frequency: "MONTHLY", isRequired: true },
  ],
  debtPayments: [
    { id: "d1", name: "Amex Payment", amount: 15000, dueDate: "2025-07-25", accountId: "1" },
  ],
  plannedPurchases: [
    { id: "p1", name: "Monterey Car Week", maxAmount: 2500, plannedDate: "2025-08-15", isCommitted: true, accountId: "1" },
    { id: "p2", name: "Disneyland", maxAmount: 700, plannedDate: "2025-09-01", isCommitted: true, accountId: "1" },
  ],
  goals: [
    { id: "g1", type: "EMERGENCY_FUND", name: "Emergency Reserve", targetAmount: 40000, currentAmount: 40000.01, isProtected: true, accountId: "2" },
    { id: "g2", type: "TAX_RESERVE", name: "Tax Reserve", targetAmount: 30000, currentAmount: 0, isProtected: false },
    { id: "g3", type: "CUSTOM", name: "Operating Cash", targetAmount: 10000, currentAmount: 24032.25, isProtected: false, accountId: "1" },
  ],
  preferences: { safetyMarginFlat: 500, safetyMarginPercent: 0 },
  provisionalFields: [],
};

describe("Financial Engine", () => {
  it("computes liquid cash excluding credit cards", () => {
    expect(computeLiquidCash(seedSnapshot.accounts)).toBe(65032.26);
  });

  it("computes protected reserves", () => {
    const reserves = computeProtectedReserves(seedSnapshot);
    expect(reserves.emergency).toBe(40000.01);
    expect(reserves.emergencyShortfall).toBe(0);
    expect(reserves.taxShortfall).toBe(30000);
  });

  it("computes safe to spend today", () => {
    const sts = computeSafeToSpend(seedSnapshot, "today");
    expect(sts.availableLiquid).toBe(65032.26);
    expect(sts.today).toBeGreaterThan(0);
    expect(sts.today).toBeLessThan(sts.availableLiquid);
  });

  it("computes all horizons", () => {
    const all = computeAllHorizons(seedSnapshot);
    expect(all.today).toBeGreaterThanOrEqual(all.thisWeek);
    expect(all.thisWeek).toBeGreaterThanOrEqual(all.thisMonth);
  });

  it("computes total debt", () => {
    expect(computeTotalDebt(seedSnapshot.accounts)).toBe(30000);
  });

  it("computes credit utilization", () => {
    const util = computeCreditUtilization(seedSnapshot.accounts);
    expect(util.overall).toBeCloseTo(30000 / 35000, 2);
  });

  it("runs scenario forecasts", () => {
    const scenarios = runAllScenarios(seedSnapshot);
    expect(scenarios).toHaveLength(3);
    const strong = scenarios.find((s) => s.type === "STRONG");
    expect(strong?.yearEndBufferWithEsop).toBeGreaterThan(strong?.yearEndBuffer ?? 0);
  });

  it("conservative scenario has lower income", () => {
    const conservative = runScenarioForecast(seedSnapshot, "CONSERVATIVE");
    const base = runScenarioForecast(seedSnapshot, "BASE");
    expect(conservative.yearEndBuffer).toBeLessThanOrEqual(base.yearEndBuffer);
  });

  it("simulates purchase impact", () => {
    const impact = simulatePurchaseImpact(seedSnapshot, {
      name: "Dinner",
      amount: 350,
      date: "2025-07-20",
      accountId: "1",
    });
    expect(impact.recommendation).toBeDefined();
    expect(["proceed", "reduce", "delay", "decline"]).toContain(impact.recommendation);
  });

  it("blocks spending from emergency reserve", () => {
    const impact = simulatePurchaseImpact(seedSnapshot, {
      name: "Test",
      amount: 100,
      date: "2025-07-20",
      accountId: "2",
    });
    expect(impact.canAffordCash).toBe(false);
    expect(impact.recommendation).toBe("decline");
  });

  it("detects overdraft risk for Amex payment day", () => {
    const risks = computeOverdraftRisk(seedSnapshot, 30);
    expect(Array.isArray(risks)).toBe(true);
  });

  it("builds dashboard snapshot", () => {
    const dashboard = buildDashboardSnapshot(seedSnapshot);
    expect(dashboard.totalLiquidCash).toBe(65032.26);
    expect(dashboard.healthScore.score).toBeGreaterThan(0);
    expect(dashboard.scenarios).toHaveLength(3);
  });
});
