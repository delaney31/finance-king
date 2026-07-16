import { describe, it, expect } from "vitest";
import { matchExistingAccount, scoreAccountMatch, transactionFingerprint } from "../match-account";
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
  {
    id: "sav-1",
    nickname: "PenFed Savings",
    institution: "PenFed",
    accountType: "SAVINGS",
    accountLastFour: "8832",
    designation: "PERSONAL",
    routingTag: "EMERGENCY",
    businessEntityId: null,
  },
  {
    id: "cc-1",
    nickname: "Amex",
    institution: "American Express",
    accountType: "CREDIT_CARD",
    accountLastFour: "1005",
    designation: "PERSONAL",
    routingTag: "PERSONAL",
    businessEntityId: null,
  },
];

describe("matchExistingAccount", () => {
  it("matches checking screenshot to checking account by last four", () => {
    const match = matchExistingAccount(
      { institution: "PenFed", accountLastFour: "4521", documentType: "DEPOSIT_ACCOUNT" },
      accounts
    );
    expect(match.accountId).toBe("chk-1");
    expect(match.score).toBeGreaterThanOrEqual(6);
    expect(match.requiresUserConfirmation).toBe(false);
  });

  it("matches savings screenshot to savings account, not checking", () => {
    const match = matchExistingAccount(
      { institution: "PenFed", accountLastFour: "8832", documentType: "DEPOSIT_ACCOUNT" },
      accounts
    );
    expect(match.accountId).toBe("sav-1");
    const top = match.candidates[0];
    expect(top?.accountType).toBe("SAVINGS");
  });

  it("matches credit card screenshot to credit card account", () => {
    const match = matchExistingAccount(
      { institution: "American Express", accountLastFour: "1005", documentType: "CREDIT_CARD" },
      accounts
    );
    expect(match.accountId).toBe("cc-1");
  });

  it("does not auto-match on institution alone when multiple accounts exist", () => {
    const match = matchExistingAccount(
      { institution: "PenFed", documentType: "DEPOSIT_ACCOUNT" },
      accounts
    );
    expect(match.accountId).toBeNull();
    expect(match.requiresUserConfirmation).toBe(true);
    expect(match.candidates.length).toBeGreaterThan(0);
  });

  it("penalizes account type mismatch", () => {
    const scored = scoreAccountMatch(
      { institution: "PenFed", accountLastFour: "4521", documentType: "CREDIT_CARD" },
      accounts[0]
    );
    expect(scored.reasons).toContain("account type mismatch");
    expect(scored.score).toBeLessThan(6);
  });

  it("creates deterministic transaction fingerprints", () => {
    const fp1 = transactionFingerprint({
      accountId: "chk-1",
      date: "2025-07-01",
      amount: -45.2,
      description: "Grocery Store",
    });
    const fp2 = transactionFingerprint({
      accountId: "chk-1",
      date: "2025-07-01",
      amount: -45.2,
      description: "Grocery Store",
    });
    const fp3 = transactionFingerprint({
      accountId: "chk-1",
      date: "2025-07-02",
      amount: -45.2,
      description: "Grocery Store",
    });
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });
});
