import { describe, it, expect } from "vitest";
import {
  computePersonalOperatingCash,
  computeTotalLiquidCashCurrent,
  computeBusinessOperatingCash,
} from "@/lib/engine/liquid-cash";
import { buildDashboardSnapshot } from "@/lib/engine";
import { buildFinancialStateFromEngine } from "@/lib/financial-state/build";
import type { EngineSnapshot } from "@/lib/engine/types";

const snapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    { id: "1", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING", routingTag: "PERSONAL", currentBalance: 24032.25, minimumTargetBalance: 10000, protectedBalance: 0, isLiquid: true },
    { id: "2", nickname: "PenFed Savings", institution: "PenFed", accountType: "SAVINGS", routingTag: "EMERGENCY", currentBalance: 40000.01, minimumTargetBalance: 40000, protectedBalance: 40000, isLiquid: true },
    { id: "3", nickname: "Wells Fargo Joint", institution: "Wells Fargo", accountType: "JOINT_CHECKING", routingTag: "NY_PROPERTY", currentBalance: 1000, minimumTargetBalance: 0, protectedBalance: 0, isLiquid: true },
  ],
  income: [],
  bills: [],
  debtPayments: [],
  plannedPurchases: [],
  goals: [],
  preferences: { safetyMarginFlat: 500, safetyMarginPercent: 0 },
  provisionalFields: [],
};

describe("financial state SSOT", () => {
  it("total liquid cash equals sum of liquid account balances", () => {
    const total = computeTotalLiquidCashCurrent(snapshot.accounts);
    expect(total).toBeCloseTo(24032.25 + 40000.01 + 1000, 2);
  });

  it("personal operating excludes protected emergency savings", () => {
    const personal = computePersonalOperatingCash(snapshot.accounts);
    expect(personal).toBeCloseTo(24032.25, 2);
    expect(personal).not.toBeCloseTo(65032.26, 0);
  });

  it("business operating excludes personal and emergency accounts", () => {
    const business = computeBusinessOperatingCash(snapshot.accounts);
    expect(business).toBe(0);
  });

  it("dashboard snapshot aligns personal operating with engine", () => {
    const dashboard = buildDashboardSnapshot(snapshot);
    expect(dashboard.personalOperatingCash).toBe(computePersonalOperatingCash(snapshot.accounts));
    expect(dashboard.totalLiquidCash).toBe(computeTotalLiquidCashCurrent(snapshot.accounts));
  });

  it("financial state snapshot exposes consistent KPI fields", () => {
    const state = buildFinancialStateFromEngine("u1", snapshot, "snap-1", new Date().toISOString());
    expect(state.totalLiquidCash).toBe(state.dashboard.totalLiquidCash);
    expect(state.personalOperatingCash).toBe(state.dashboard.personalOperatingCash);
    expect(state.safeToSpendToday).toBe(state.dashboard.safeToSpend.today);
    expect(state.calculationLines.length).toBeGreaterThan(0);
  });

  it("protected emergency is separate from personal operating", () => {
    const state = buildFinancialStateFromEngine("u1", snapshot, "snap-1", new Date().toISOString());
    expect(state.protectedEmergencyReserve).toBeGreaterThan(0);
    expect(state.personalOperatingCash + state.protectedEmergencyReserve).toBeLessThanOrEqual(
      state.personalAccountsTotal + 1
    );
  });
});
