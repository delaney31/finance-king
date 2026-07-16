import { describe, it, expect } from "vitest";
import {
  buildDashboardSnapshot,
  computeCreditUtilization,
  computeLiquidCash,
  spendableBalance,
} from "@/lib/engine";
import type { EngineSnapshot } from "@/lib/engine/types";
import { buildExtractedFinancialData } from "../extract-fields";
import { matchExistingAccount } from "../match-account";
import { buildImportSummaryMessage } from "../import-summary";
import type { ImportSummary } from "../types";

const baseSnapshot: EngineSnapshot = {
  asOfDate: "2025-07-16",
  accounts: [
    {
      id: "1",
      nickname: "PenFed Checking",
      institution: "PenFed",
      accountType: "CHECKING",
      routingTag: "PERSONAL",
      currentBalance: 24032.25,
      availableBalance: 23800,
      pendingBalance: 232.25,
      minimumTargetBalance: 10000,
      protectedBalance: 0,
      isLiquid: true,
    },
    {
      id: "4",
      nickname: "Amex",
      institution: "Amex",
      accountType: "CREDIT_CARD",
      routingTag: "PERSONAL",
      currentBalance: -30000,
      minimumTargetBalance: 0,
      protectedBalance: 0,
      creditLimit: 35000,
      isLiquid: false,
    },
  ],
  income: [],
  bills: [],
  debtPayments: [],
  plannedPurchases: [],
  goals: [],
  preferences: { safetyMarginFlat: 0, safetyMarginPercent: 0 },
  provisionalFields: [],
};

describe("upload pipeline integration", () => {
  it("checking screenshot routes to checking account type", () => {
    const text = "PenFed Checking Current Balance: $24,032.25 Account ending 4521";
    const extracted = buildExtractedFinancialData(text);
    expect(extracted.documentType).toBe("DEPOSIT_ACCOUNT");

    const match = matchExistingAccount(extracted, [
      {
        id: "chk",
        nickname: "PenFed Checking",
        institution: "PenFed",
        accountType: "CHECKING",
        accountLastFour: "4521",
        designation: "PERSONAL",
        routingTag: "PERSONAL",
        businessEntityId: null,
      },
      {
        id: "sav",
        nickname: "PenFed Savings",
        institution: "PenFed",
        accountType: "SAVINGS",
        accountLastFour: "8832",
        designation: "PERSONAL",
        routingTag: "EMERGENCY",
        businessEntityId: null,
      },
    ]);
    expect(match.accountId).toBe("chk");
  });

  it("savings screenshot prefers savings account when last four matches", () => {
    const text = "PenFed Savings Current Balance: $40,000.01 Account ending 8832";
    const extracted = buildExtractedFinancialData(text);
    const match = matchExistingAccount(extracted, [
      {
        id: "chk",
        nickname: "PenFed Checking",
        institution: "PenFed",
        accountType: "CHECKING",
        accountLastFour: "4521",
        designation: "PERSONAL",
        routingTag: "PERSONAL",
        businessEntityId: null,
      },
      {
        id: "sav",
        nickname: "PenFed Savings",
        institution: "PenFed",
        accountType: "SAVINGS",
        accountLastFour: "8832",
        designation: "PERSONAL",
        routingTag: "EMERGENCY",
        businessEntityId: null,
      },
    ]);
    expect(match.accountId).toBe("sav");
  });

  it("credit card screenshot routes to credit card account", () => {
    const text =
      "American Express Credit Card Current Balance: $30,000 Credit Limit: $35,000 ending 1005";
    const extracted = buildExtractedFinancialData(text);
    expect(extracted.documentType).toBe("CREDIT_CARD");

    const match = matchExistingAccount(extracted, [
      {
        id: "cc",
        nickname: "Amex",
        institution: "American Express",
        accountType: "CREDIT_CARD",
        accountLastFour: "1005",
        designation: "PERSONAL",
        routingTag: "PERSONAL",
        businessEntityId: null,
      },
    ]);
    expect(match.accountId).toBe("cc");
  });

  it("pending deposits do not increase safe-to-spend via available balance", () => {
    const withPending = baseSnapshot.accounts[0];
    expect(spendableBalance(withPending)).toBe(23800);
    expect(withPending.currentBalance).toBe(24032.25);
    expect(computeLiquidCash(baseSnapshot.accounts)).toBe(23800);
  });

  it("credit utilization recalculates from account balances", () => {
    const util = computeCreditUtilization(baseSnapshot.accounts);
    expect(util.overall).toBeCloseTo(30000 / 35000, 4);

    const updated = baseSnapshot.accounts.map((a) =>
      a.accountType === "CREDIT_CARD" ? { ...a, currentBalance: -17500 } : a
    );
    const utilAfter = computeCreditUtilization(updated);
    expect(utilAfter.overall).toBeCloseTo(17500 / 35000, 4);
  });

  it("safe-to-spend and month-end forecast recalculate after balance change", () => {
    const before = buildDashboardSnapshot(baseSnapshot);
    const afterSnapshot: EngineSnapshot = {
      ...baseSnapshot,
      accounts: baseSnapshot.accounts.map((a) =>
        a.id === "1" ? { ...a, currentBalance: 28410.17, availableBalance: 28100 } : a
      ),
    };
    const after = buildDashboardSnapshot(afterSnapshot);
    expect(after.totalLiquidCash).toBeGreaterThan(before.totalLiquidCash);
    expect(after.safeToSpend.today).toBeGreaterThanOrEqual(before.safeToSpend.today);
    expect(after.monthEndBuffer).toBeGreaterThanOrEqual(before.monthEndBuffer);
  });

  it("builds human-readable import summary", () => {
    const summary: ImportSummary = {
      documentId: "doc-1",
      accountId: "1",
      accountNickname: "PenFed Checking",
      action: "UPDATED",
      previousBalance: 24032.25,
      newBalance: 28410.17,
      transactionsImported: 12,
      duplicatesSkipped: 2,
      recurringDetected: 0,
      safeToSpendBefore: 5000,
      safeToSpendAfter: 6240,
      monthEndBufferBefore: 8000,
      monthEndBufferAfter: 9200,
      creditUtilizationBefore: 0.85,
      creditUtilizationAfter: 0.85,
      warnings: [],
      message: "",
    };
    const message = buildImportSummaryMessage(summary);
    expect(message).toContain("PenFed Checking");
    expect(message).toContain("12 transaction");
    expect(message).toContain("2 duplicate");
    expect(message).toContain("increased");
  });

  it("low-confidence OCR classification requires manual confirmation path", () => {
    const data = buildExtractedFinancialData("balance $100");
    expect(data.classification.confidence).toBeLessThan(0.7);
    expect(data.documentType).toBe("UNKNOWN");
  });

  it("new account suggested when no match exists", () => {
    const extracted = buildExtractedFinancialData(
      "Chase Checking Current Balance: $5,000.00 Account ending 9999"
    );
    const match = matchExistingAccount(extracted, [
      {
        id: "chk",
        nickname: "PenFed Checking",
        institution: "PenFed",
        accountType: "CHECKING",
        accountLastFour: "4521",
        designation: "PERSONAL",
        routingTag: "PERSONAL",
        businessEntityId: null,
      },
    ]);
    expect(match.accountId).toBeNull();
    expect(match.candidates.length).toBe(0);
  });
});
