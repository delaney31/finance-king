import { describe, it, expect, vi } from "vitest";
import {
  buildCompactAnswer,
  validateVerdict,
  recommendationToVerdict,
} from "../compact-presenter";
import type { CFOAssistantResponse } from "../types";
import type { EngineSnapshot } from "@/lib/engine/types";
import { simulatePurchaseImpact, computeAllHorizons } from "@/lib/engine";

const snapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    { id: "1", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING", routingTag: "PERSONAL", currentBalance: 24032.25, minimumTargetBalance: 10000, protectedBalance: 0, isLiquid: true },
    { id: "2", nickname: "Emergency", institution: "PenFed", accountType: "SAVINGS", routingTag: "EMERGENCY", currentBalance: 40000, minimumTargetBalance: 40000, protectedBalance: 40000, isLiquid: true },
  ],
  income: [],
  bills: [{ id: "b1", name: "NY Mortgage", amount: 8200, nextDueDate: "2025-08-01", dueDay: 1, frequency: "MONTHLY", isRequired: true }],
  debtPayments: [],
  plannedPurchases: [],
  goals: [],
  preferences: { safetyMarginFlat: 500, safetyMarginPercent: 0 },
  provisionalFields: [],
};

function baseResponse(overrides: Partial<CFOAssistantResponse> = {}): CFOAssistantResponse {
  const sts = computeAllHorizons(snapshot);
  return {
    answer: "Test",
    recommendation: "PROCEED",
    safeToSpendToday: sts.today,
    safeToSpendThisWeek: sts.thisWeek,
    safeToSpendThisMonth: sts.thisMonth,
    emergencyReserveAffected: false,
    taxReserveAffected: false,
    nextBillsCovered: true,
    warnings: [],
    assumptions: [],
    supportingCalculations: [{ label: "Safe to spend today", amount: sts.today }],
    suggestedFollowUpQuestions: ["What next?"],
    ...overrides,
  };
}

describe("compact presenter", () => {
  it("small affordable purchase shows GO AHEAD", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Dinner tonight",
      amount: 75,
      date: "2025-07-16",
      accountId: "1",
    });
    const response = baseResponse({
      recommendation: impact.canAffordCash ? "PROCEED" : "DECLINE",
      recommendedAmount: 75,
    });
    const toolResults = [
      {
        toolName: "simulatePurchase",
        arguments: {},
        result: {
          data: {
            impact,
            purchase: { name: "Dinner tonight", amount: 75 },
          },
          warnings: [],
          assumptions: [],
          calculatedAt: new Date().toISOString(),
          sourceSnapshotId: "s1",
        },
        durationMs: 1,
      },
    ];

    const compact = buildCompactAnswer(
      "Can I afford dinner tonight?",
      response,
      "CAN_I_AFFORD",
      toolResults,
      "2025-07-16"
    );

    expect(compact.verdict).toBe("GO_AHEAD");
    expect(compact.headline).toMatch(/GO AHEAD/i);
    expect(compact.primaryMetrics).toHaveLength(3);
    expect(compact.advice).toMatch(/keep it under|Yes/i);
  });

  it("purchase below safe-to-spend does not show NOT_YET", () => {
    const sts = computeAllHorizons(snapshot);
    const corrected = validateVerdict({
      verdict: "NOT_YET",
      safeToSpendToday: sts.today,
      recommendedAmount: 75,
      canAffordCash: true,
      emergencyReserveAffected: false,
      nextBillsCovered: true,
    });
    expect(corrected).not.toBe("NOT_YET");
  });

  it("hides technical intent from compact output", () => {
    const compact = buildCompactAnswer(
      "Can I afford dinner tonight?",
      baseResponse(),
      "CAN_I_AFFORD",
      [],
      "2025-07-16"
    );
    const serialized = JSON.stringify(compact);
    expect(serialized).not.toContain("CAN_I_AFFORD");
    expect(serialized).not.toContain("DECLINE");
    expect(serialized).not.toContain("Intent");
  });

  it("missing amount asks for more information", () => {
    const compact = buildCompactAnswer(
      "Can I afford dinner tonight?",
      baseResponse({ recommendation: "INFORMATION_ONLY" }),
      "CAN_I_AFFORD",
      [],
      "2025-07-16"
    );
    expect(compact.verdict).toBe("NEED_MORE_INFORMATION");
    expect(compact.advice).toMatch(/detail|amount/i);
  });

  it("warns when bills not covered", () => {
    const compact = buildCompactAnswer(
      "Can I afford a yacht?",
      baseResponse({
        recommendation: "DECLINE",
        nextBillsCovered: false,
        emergencyReserveAffected: true,
      }),
      "CAN_I_AFFORD",
      [
        {
          toolName: "simulatePurchase",
          arguments: {},
          result: {
            data: {
              impact: {
                canAffordCash: false,
                recommendation: "decline",
                protectedReservesIntact: false,
                billsRemainFunded: false,
              },
              purchase: { name: "Yacht", amount: 500000 },
            },
            warnings: ["Would exceed safe-to-spend"],
            assumptions: [],
            calculatedAt: new Date().toISOString(),
            sourceSnapshotId: "s1",
          },
          durationMs: 1,
        },
      ],
      "2025-07-16"
    );
    expect(compact.verdict).toBe("NOT_YET");
    expect(compact.protectionChecks.some((c) => c.status === "FAIL")).toBe(true);
  });

  it("validateVerdict logs and corrects conflicts in dev", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateVerdict({
      verdict: "NOT_YET",
      safeToSpendToday: 5000,
      recommendedAmount: 50,
      canAffordCash: true,
      emergencyReserveAffected: false,
      nextBillsCovered: true,
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("maps recommendations to verdicts", () => {
    expect(recommendationToVerdict("PROCEED")).toBe("GO_AHEAD");
    expect(recommendationToVerdict("DELAY")).toBe("WAIT");
    expect(recommendationToVerdict("DECLINE")).toBe("NOT_YET");
  });
});
