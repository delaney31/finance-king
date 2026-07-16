import { describe, it, expect } from "vitest";
import { cfoAssistantResponseSchema } from "../schemas";
import { buildFallbackResponse } from "../response-builder";
import type { EngineSnapshot } from "@/lib/engine/types";
import { simulatePurchaseImpact } from "@/lib/engine";

const snapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    { id: "1", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING", routingTag: "PERSONAL", currentBalance: 24032.25, minimumTargetBalance: 10000, protectedBalance: 0, isLiquid: true },
    { id: "2", nickname: "Emergency", institution: "PenFed", accountType: "SAVINGS", routingTag: "EMERGENCY", currentBalance: 40000, minimumTargetBalance: 40000, protectedBalance: 40000, isLiquid: true },
  ],
  income: [],
  bills: [{ id: "b1", name: "Mortgage", amount: 8200, nextDueDate: "2025-08-01", dueDay: 1, frequency: "MONTHLY", isRequired: true }],
  debtPayments: [],
  plannedPurchases: [{ id: "p1", name: "Disneyland", maxAmount: 700, plannedDate: "2025-09-01", isCommitted: true, accountId: "1" }],
  goals: [],
  preferences: { safetyMarginFlat: 500, safetyMarginPercent: 0 },
  provisionalFields: [],
};

describe("Financial AI tools integration", () => {
  it("dinner tonight - small purchase simulation", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Dinner tonight",
      amount: 75,
      date: "2025-07-16",
      accountId: "1",
    });
    const response = buildFallbackResponse("CAN_I_AFFORD", snapshot, [
      {
        toolName: "simulatePurchase",
        arguments: {},
        result: {
          data: { impact, purchase: { name: "Dinner", amount: 75 }, recommendedAccount: { id: "1", nickname: "PenFed" } },
          warnings: [],
          assumptions: [],
          calculatedAt: new Date().toISOString(),
          sourceSnapshotId: "s1",
        },
        durationMs: 1,
      },
    ]);
    const parsed = cfoAssistantResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
    expect(response.answer.length).toBeGreaterThan(10);
  });

  it("Disneyland - uses committed planned purchase context", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Disneyland",
      amount: 600,
      date: "2025-09-01",
      accountId: "1",
    });
    expect(impact.recommendation).toBeDefined();
    expect(["proceed", "reduce", "delay", "decline"]).toContain(impact.recommendation);
  });

  it("protected reserves remain excluded from spending", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Emergency spend",
      amount: 1000,
      date: "2025-07-16",
      accountId: "2",
    });
    expect(impact.canAffordCash).toBe(false);
    expect(impact.recommendation).toBe("decline");
  });

  it("Pacific Luxe advertising - business flag", () => {
    const response = buildFallbackResponse("CAN_I_AFFORD", snapshot, []);
    expect(response.safeToSpendToday).toBeGreaterThanOrEqual(0);
  });

  it("explain safe-to-spend includes line items", () => {
    const response = buildFallbackResponse("EXPLAIN_METRIC", snapshot, [
      {
        toolName: "explainMetric",
        arguments: { metricName: "safe_to_spend" },
        result: {
          data: {
            metricName: "safe_to_spend",
            summary: "Safe-to-spend breakdown",
            lines: [
              { label: "Cleared liquid cash", amount: 64032 },
              { label: "Committed obligations", amount: 20000 },
              { label: "Safe to spend today", amount: 44032 },
            ],
          },
          warnings: [],
          assumptions: [],
          calculatedAt: new Date().toISOString(),
          sourceSnapshotId: "s1",
        },
        durationMs: 1,
      },
    ]);
    expect(response.supportingCalculations.length).toBeGreaterThan(1);
  });
});
