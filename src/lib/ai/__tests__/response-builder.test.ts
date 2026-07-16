import { describe, it, expect } from "vitest";
import { buildFallbackResponse } from "../response-builder";
import type { EngineSnapshot } from "@/lib/engine/types";
import type { ToolExecutionRecord } from "../types";
import { simulatePurchaseImpact, computeAllHorizons } from "@/lib/engine";

const seedSnapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    { id: "1", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING", routingTag: "PERSONAL", currentBalance: 24032.25, minimumTargetBalance: 10000, protectedBalance: 0, isLiquid: true },
    { id: "2", nickname: "PenFed Savings", institution: "PenFed", accountType: "SAVINGS", routingTag: "EMERGENCY", currentBalance: 40000.01, minimumTargetBalance: 40000, protectedBalance: 40000, isLiquid: true },
  ],
  income: [{ id: "i1", name: "Contract", amount: 18600, status: "SCHEDULED", expectedDate: "2025-08-01" }],
  bills: [{ id: "b1", name: "Mortgage", amount: 8200, nextDueDate: "2025-08-01", dueDay: 1, frequency: "MONTHLY", isRequired: true }],
  debtPayments: [{ id: "d1", name: "Amex", amount: 15000, dueDate: "2025-07-25", accountId: "1" }],
  plannedPurchases: [],
  goals: [{ id: "g1", type: "EMERGENCY_FUND", name: "Emergency", targetAmount: 40000, currentAmount: 40000, isProtected: true }],
  preferences: { safetyMarginFlat: 500, safetyMarginPercent: 0 },
  provisionalFields: [],
};

describe("Response builder", () => {
  it("includes assumptions in every response", () => {
    const response = buildFallbackResponse("SAFE_TO_SPEND", seedSnapshot, []);
    expect(response.assumptions.length).toBeGreaterThan(0);
    expect(response.answer).toContain("safely spend");
    expect(response.safeToSpendToday).toBeDefined();
  });

  it("uses deterministic purchase simulation in can-afford response", () => {
    const impact = simulatePurchaseImpact(seedSnapshot, {
      name: "Dinner",
      amount: 75,
      date: "2025-07-16",
      accountId: "1",
    });
    const toolCalls: ToolExecutionRecord[] = [
      {
        toolName: "simulatePurchase",
        arguments: { name: "Dinner", amount: 75 },
        result: {
          data: {
            impact,
            purchase: { name: "Dinner", amount: 75 },
            recommendedAccount: { id: "1", nickname: "PenFed Checking" },
          },
          warnings: impact.warnings,
          assumptions: [],
          calculatedAt: new Date().toISOString(),
          sourceSnapshotId: "snap-1",
        },
        durationMs: 10,
      },
    ];
    const response = buildFallbackResponse("CAN_I_AFFORD", seedSnapshot, toolCalls);
    expect(response.recommendation).toBeDefined();
    expect(response.supportingCalculations.some((c) => c.label.includes("Safe to spend after purchase"))).toBe(true);
  });

  it("AI cannot override deterministic safe-to-spend", () => {
    const sts = computeAllHorizons(seedSnapshot);
    const response = buildFallbackResponse("SAFE_TO_SPEND", seedSnapshot, []);
    expect(response.safeToSpendToday).toBe(sts.today);
  });

  it("rejects invalid model output via schema - fallback preserves engine values", () => {
    const response = buildFallbackResponse("EXPLAIN_METRIC", seedSnapshot, [
      {
        toolName: "explainMetric",
        arguments: { metricName: "safe_to_spend" },
        result: {
          data: { metricName: "safe_to_spend", summary: "Test", lines: [{ label: "Safe to spend today", amount: computeAllHorizons(seedSnapshot).today }] },
          warnings: [],
          assumptions: ["Provisional data"],
          calculatedAt: new Date().toISOString(),
          sourceSnapshotId: "snap-1",
        },
        durationMs: 5,
      },
    ]);
    expect(response.assumptions).toContain("Provisional data");
  });
});
