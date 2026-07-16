import { describe, it, expect } from "vitest";
import { normalizeExtractedData, normalizeMatchResult, createEmptyExtracted } from "../normalize-extracted";
import type { MatchableAccount } from "../match-account";

const accounts: MatchableAccount[] = [
  {
    id: "chk-1",
    nickname: "PenFed Checking",
    institution: "PenFed",
    accountType: "CHECKING",
    accountLastFour: "4521",
    designation: "PERSONAL",
    routingTag: "PERSONAL",
    businessEntityId: null,
  },
];

describe("normalizeExtractedData", () => {
  it("normalizes legacy balance shape", () => {
    const normalized = normalizeExtractedData({
      balance: { value: "24032.25" },
      institution: "PenFed",
    });
    expect(normalized.currentBalance).toBe(24032.25);
    expect(normalized.institution).toBe("PenFed");
    expect(normalized.transactions).toEqual([]);
  });

  it("returns empty extractable shape for null data", () => {
    const normalized = createEmptyExtracted();
    expect(normalized.documentType).toBe("UNKNOWN");
    expect(normalized.transactions).toEqual([]);
  });

  it("recomputes match when stored match is invalid", () => {
    const extracted = normalizeExtractedData({
      documentType: "DEPOSIT_ACCOUNT",
      institution: "PenFed",
      accountLastFour: "4521",
      classification: {
        type: "DEPOSIT_ACCOUNT",
        confidence: 0.8,
        reasons: [],
        scores: {
          DEPOSIT_ACCOUNT: 5,
          CREDIT_CARD: 0,
          LOAN: 0,
          TRANSACTION_STATEMENT: 0,
          UNKNOWN: 0,
        },
      },
      transactions: [],
      fieldConfidence: {},
    });
    const match = normalizeMatchResult({}, extracted, accounts);
    expect(match.accountId).toBe("chk-1");
    expect(match.candidates.length).toBeGreaterThan(0);
  });
});
