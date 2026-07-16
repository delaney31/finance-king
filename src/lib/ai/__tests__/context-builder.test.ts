import { describe, it, expect } from "vitest";
import { buildSafeContext, contextContainsFullAccountNumbers, maskSensitiveText } from "../context-builder";
import type { EngineSnapshot } from "@/lib/engine/types";

const snapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    { id: "1", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING", routingTag: "PERSONAL", currentBalance: 24032.25, availableBalance: 24032.25, minimumTargetBalance: 10000, protectedBalance: 0, isLiquid: true },
    { id: "2", nickname: "PenFed Savings", institution: "PenFed", accountType: "SAVINGS", routingTag: "EMERGENCY", currentBalance: 40000, minimumTargetBalance: 40000, protectedBalance: 40000, isLiquid: true },
  ],
  income: [{ id: "i1", name: "Contract", amount: 18600, status: "SCHEDULED", expectedDate: "2025-08-01", isProvisional: true }],
  bills: [],
  debtPayments: [],
  plannedPurchases: [],
  goals: [],
  preferences: { safetyMarginFlat: 500, safetyMarginPercent: 0 },
  provisionalFields: ["provisional_income"],
};

describe("Context builder", () => {
  it("never includes full account numbers", () => {
    const context = buildSafeContext(snapshot, []);
    expect(contextContainsFullAccountNumbers(context)).toBe(false);
  });

  it("masks sensitive numeric sequences", () => {
    expect(maskSensitiveText("account 1234567890123456")).toContain("****");
  });

  it("uses cleared available balance not pending", () => {
    const context = buildSafeContext(snapshot, []);
    const checking = context.accounts.find((a) => a.id === "1");
    expect(checking?.clearedBalance).toBe(24032.25);
  });

  it("flags provisional income in context", () => {
    const context = buildSafeContext(snapshot, []);
    expect(context.expectedIncome[0]?.provisional).toBe(true);
  });
});
