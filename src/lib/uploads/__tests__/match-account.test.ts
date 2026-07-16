import { describe, it, expect } from "vitest";
import { matchExistingAccount } from "../match-account";

const accounts = [
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
  it("matches checking screenshot to checking account", () => {
    const match = matchExistingAccount(
      { institution: "PenFed", accountLastFour: "4521", documentType: "CHECKING" },
      accounts
    );
    expect(match.accountId).toBe("chk-1");
  });

  it("matches credit card screenshot to credit card only", () => {
    const match = matchExistingAccount(
      { institution: "American Express", accountLastFour: "1005", documentType: "CREDIT_CARD" },
      accounts
    );
    expect(match.accountId).toBe("cc-1");
    expect(match.candidates.every((c) => c.accountType === "CREDIT_CARD")).toBe(true);
  });

  it("excludes checking accounts from credit card match list", () => {
    const match = matchExistingAccount(
      { institution: "PenFed", documentType: "CREDIT_CARD" },
      accounts
    );
    expect(match.candidates.every((c) => c.accountType === "CREDIT_CARD")).toBe(true);
  });
});
