import { describe, it, expect } from "vitest";
import { parseCFODataCommand } from "@/lib/ai/commands/parser";

type TestAccount = {
  id: string;
  userId: string;
  nickname: string;
  institution: string;
  accountType: string;
  designation: string;
  routingTag: string;
  currentBalance: number;
  availableBalance: number | null;
  pendingBalance: number | null;
  minimumTargetBalance: number;
  protectedBalance: number;
  isLiquid: boolean;
  accountLastFour?: string | null;
};

const accounts: TestAccount[] = [
  {
    id: "1",
    userId: "u1",
    nickname: "PenFed Checking",
    institution: "PenFed",
    accountType: "CHECKING",
    designation: "PERSONAL",
    routingTag: "PERSONAL",
    currentBalance: 24032.25,
    availableBalance: null,
    pendingBalance: null,
    minimumTargetBalance: 10000,
    protectedBalance: 0,
    isLiquid: true,
  },
  {
    id: "2",
    userId: "u1",
    nickname: "PenFed Savings",
    institution: "PenFed",
    accountType: "SAVINGS",
    designation: "PERSONAL",
    routingTag: "EMERGENCY",
    currentBalance: 40000,
    availableBalance: null,
    pendingBalance: null,
    minimumTargetBalance: 40000,
    protectedBalance: 40000,
    isLiquid: true,
  },
] ;

function asAccounts(list: TestAccount[]) {
  return list as unknown as Parameters<typeof parseCFODataCommand>[1];
}

describe("CFO data commands", () => {
  it("parses update account balance", () => {
    const cmd = parseCFODataCommand("Update PenFed checking to $26,450", asAccounts(accounts));
    expect(cmd.intent).toBe("UPDATE_ACCOUNT_BALANCE");
    expect(cmd.accountId).toBe("1");
    expect(cmd.amount).toBe(26450);
    expect(cmd.previousAmount).toBe(24032.25);
    expect(cmd.missingFields).toHaveLength(0);
  });

  it("parses transfer between accounts", () => {
    const cmd = parseCFODataCommand("Transfer $2,900 from PenFed checking to Wells Fargo", asAccounts([
      ...accounts,
      {
        ...accounts[0],
        id: "3",
        nickname: "Wells Fargo Joint",
        routingTag: "NY_PROPERTY",
      } as TestAccount,
    ]));
    expect(cmd.intent).toBe("TRANSFER_BETWEEN_ACCOUNTS");
    expect(cmd.amount).toBe(2900);
  });

  it("returns unknown for unrelated text", () => {
    const cmd = parseCFODataCommand("What is the weather?", asAccounts(accounts));
    expect(cmd.intent).toBe("UNKNOWN");
  });

  it("requires clarification for ambiguous accounts", () => {
    const cmd = parseCFODataCommand("Update checking to $5,000", asAccounts([
      accounts[0],
      { ...accounts[0], id: "x", nickname: "Truist Checking", accountLastFour: "1284" },
      { ...accounts[0], id: "y", nickname: "Truist Checking", accountLastFour: "1809" },
    ]));
    expect(cmd.missingFields).toContain("accountId");
    expect(cmd.clarificationQuestion).toBeTruthy();
  });
});
