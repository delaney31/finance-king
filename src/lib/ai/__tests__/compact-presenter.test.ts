import { describe, it, expect, vi } from "vitest";
import {
  buildCompactAnswer,
  validateVerdict,
  recommendationToVerdict,
} from "../compact-presenter";
import { buildReasonDetail, extractPurchaseContext } from "../reason-detail";
import type { CFOAssistantResponse } from "../types";
import type { EngineSnapshot } from "@/lib/engine/types";
import { simulatePurchaseImpact, computeAllHorizons } from "@/lib/engine";

const snapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    { id: "1", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING", routingTag: "PERSONAL", currentBalance: 24032.25, minimumTargetBalance: 10000, protectedBalance: 0, isLiquid: true },
    { id: "2", nickname: "Emergency", institution: "PenFed", accountType: "SAVINGS", routingTag: "EMERGENCY", currentBalance: 40000, minimumTargetBalance: 40000, protectedBalance: 40000, isLiquid: true },
  ],
  income: [
    { id: "i1", name: "W-2", amount: 5000, status: "SCHEDULED", expectedDate: "2025-08-01" },
  ],
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

function purchaseToolResult(impact: ReturnType<typeof simulatePurchaseImpact>, purchase: { name: string; amount: number }) {
  return {
    toolName: "simulatePurchase",
    arguments: {},
    result: {
      data: { impact, purchase },
      warnings: impact.warnings,
      assumptions: [],
      calculatedAt: new Date().toISOString(),
      sourceSnapshotId: "s1",
    },
    durationMs: 1,
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

    const compact = buildCompactAnswer(
      "Can I afford dinner tonight?",
      response,
      "CAN_I_AFFORD",
      [purchaseToolResult(impact, { name: "Dinner tonight", amount: 75 })],
      "2025-07-16",
      snapshot
    );

    expect(compact.verdict).toBe("GO_AHEAD");
    expect(compact.headline).toMatch(/GO AHEAD/i);
    expect(compact.primaryMetrics).toHaveLength(3);
    expect(compact.reasonDetail).toBeDefined();
    expect(compact.reasonDetail.explanation).toBeTruthy();
    expect(compact.advice).toMatch(/under \$75|clear to spend/i);
  });

  it("after purchase metric equals safe-to-spend minus purchase cost", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Disneyland",
      amount: 650,
      date: "2025-07-16",
      accountId: "1",
    });
    const sts = computeAllHorizons(snapshot);
    const response = baseResponse({
      recommendation: "DECLINE",
      safeToSpendToday: sts.today,
      recommendedAmount: 650,
      nextBillsCovered: impact.billsRemainFunded,
    });

    const compact = buildCompactAnswer(
      "Can I afford Disneyland?",
      response,
      "CAN_I_AFFORD",
      [purchaseToolResult(impact, { name: "Disneyland", amount: 650 })],
      "2025-07-16",
      snapshot
    );

    const afterMetric = compact.primaryMetrics.find((m) => /after/i.test(m.label));
    expect(afterMetric).toBeDefined();
    expect(impact.safeToSpendAfter).toBe(Math.max(0, sts.today - 650));
    expect(afterMetric!.value).toBe(`$${Math.round(impact.safeToSpendAfter).toLocaleString()}`);
    expect(afterMetric!.value).not.toBe("$40,000");
  });

  it("negative verdict includes exact primary reason and shortfall", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Yacht",
      amount: 500000,
      date: "2025-07-16",
      accountId: "1",
    });
    const compact = buildCompactAnswer(
      "Can I afford a yacht?",
      baseResponse({
        recommendation: "DECLINE",
        nextBillsCovered: false,
        emergencyReserveAffected: true,
      }),
      "CAN_I_AFFORD",
      [purchaseToolResult(impact, { name: "Yacht", amount: 500000 })],
      "2025-07-16",
      snapshot
    );

    expect(["NOT_YET", "WAIT", "REDUCE_BUDGET"]).toContain(compact.verdict);
    expect(compact.reasonDetail.primaryReason).toBeTruthy();
    expect(compact.reasonDetail.primaryReason).not.toBe("OTHER");
    if (impact.shortfall > 0) {
      expect(compact.reasonDetail.shortfallAmount).toBeGreaterThan(0);
    }
    expect(compact.reasonDetail.explanation).not.toMatch(/strain your cash cushion/i);
    expect(compact.advice).not.toMatch(/strain your cash cushion/i);
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
      "2025-07-16",
      snapshot
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
      "2025-07-16",
      snapshot
    );
    expect(compact.verdict).toBe("NEED_MORE_INFORMATION");
    expect(compact.advice).toMatch(/detail|amount/i);
  });

  it("warns when bills not covered with underfunded amount", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Yacht",
      amount: 500000,
      date: "2025-07-16",
      accountId: "1",
    });
    const compact = buildCompactAnswer(
      "Can I afford a yacht?",
      baseResponse({
        recommendation: "DECLINE",
        nextBillsCovered: false,
        emergencyReserveAffected: true,
      }),
      "CAN_I_AFFORD",
      [purchaseToolResult(impact, { name: "Yacht", amount: 500000 })],
      "2025-07-16",
      snapshot
    );
    expect(compact.verdict).toBe("NOT_YET");
    expect(compact.protectionChecks.some((c) => c.status === "FAIL")).toBe(true);
    expect(compact.protectionChecks.some((c) => /underfunded/i.test(c.label))).toBe(true);
  });

  it("shows maximum safe amount for unaffordable purchase", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Disneyland",
      amount: 650,
      date: "2025-07-16",
      accountId: "1",
    });
    const compact = buildCompactAnswer(
      "Can I afford Disneyland?",
      baseResponse({ recommendation: "DELAY", recommendedAmount: 650 }),
      "CAN_I_AFFORD",
      [purchaseToolResult(impact, { name: "Disneyland", amount: 650 })],
      "2025-07-16",
      snapshot
    );

    if (!impact.canAffordCash) {
      expect(compact.affordableNow).toMatch(/up to/i);
      expect(compact.reasonDetail.maximumSafeAmount).toBe(impact.maxSafeBudget);
    }
  });

  it("shows affordability trigger when income would unlock purchase", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Disneyland",
      amount: 999999,
      date: "2025-07-16",
      accountId: "1",
    });
    const reason = buildReasonDetail("NOT_YET", {
      name: "Disneyland",
      amount: 999999,
      impact,
      accountNickname: "PenFed Checking",
    }, snapshot);

    if (impact.affordabilityAfterIncome) {
      expect(reason.affordabilityTrigger?.type).toBe("INCOME_CLEARS");
    }
  });

  it("blocks emergency reserve spending with exact amount", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Test",
      amount: 100,
      date: "2025-07-20",
      accountId: "2",
    });
    const compact = buildCompactAnswer(
      "Can I afford this from emergency?",
      baseResponse({ recommendation: "DECLINE", emergencyReserveAffected: true }),
      "CAN_I_AFFORD",
      [purchaseToolResult(impact, { name: "Test", amount: 100 })],
      "2025-07-16",
      snapshot
    );

    expect(impact.primaryReason).toBe("EMERGENCY_RESERVE_TOUCHED");
    expect(compact.reasonDetail.primaryReason).toBe("EMERGENCY_RESERVE_TOUCHED");
    expect(compact.protectionChecks[0].status).toBe("FAIL");
  });

  it("identifies underfunded bill in reason detail", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Big trip",
      amount: 500000,
      date: "2025-07-16",
      accountId: "1",
    });
    const ctx = extractPurchaseContext("Can I afford a big trip?", [
      purchaseToolResult(impact, { name: "Big trip", amount: 500000 }),
    ]);
    const reason = buildReasonDetail("NOT_YET", ctx, snapshot);

    if (impact.underfundedObligation) {
      expect(reason.affectedObligation).toBe(impact.underfundedObligation.name);
    }
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

  it("contradictory GO_AHEAD when unaffordable is corrected", () => {
    const corrected = validateVerdict({
      verdict: "GO_AHEAD",
      safeToSpendToday: 100,
      recommendedAmount: 500,
      canAffordCash: false,
      emergencyReserveAffected: false,
      nextBillsCovered: true,
    });
    expect(corrected).toBe("WAIT");
  });

  it("maps recommendations to verdicts", () => {
    expect(recommendationToVerdict("PROCEED")).toBe("GO_AHEAD");
    expect(recommendationToVerdict("DELAY")).toBe("WAIT");
    expect(recommendationToVerdict("DECLINE")).toBe("NOT_YET");
  });

  it("every negative verdict has breakdown rows visible in default view", () => {
    const impact = simulatePurchaseImpact(snapshot, {
      name: "Yacht",
      amount: 500000,
      date: "2025-07-16",
      accountId: "1",
    });
    const compact = buildCompactAnswer(
      "Can I afford a yacht?",
      baseResponse({ recommendation: "DECLINE", nextBillsCovered: false }),
      "CAN_I_AFFORD",
      [purchaseToolResult(impact, { name: "Yacht", amount: 500000 })],
      "2025-07-16",
      snapshot
    );

    expect(compact.reasonDetail.breakdown.length).toBeGreaterThanOrEqual(2);
    expect(compact.reason).toBeTruthy();
  });
});
