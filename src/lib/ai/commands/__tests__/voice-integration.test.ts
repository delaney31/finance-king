import { describe, it, expect } from "vitest";
import { parseCFODataCommand } from "@/lib/ai/commands/parser";
import { normalizeCfoMessage } from "@/lib/nlp/normalize-message";
import { generateSystemAliases } from "@/lib/accounts/alias-generator";
import type { AccountAlias } from "@/lib/accounts/types";
import { normalizeAlias } from "@/lib/accounts/normalize";

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
  businessEntity?: { name: string } | null;
};

const penfed: TestAccount = {
  id: "1",
  userId: "u1",
  nickname: "PenFed Free Checking",
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
  accountLastFour: "0022",
};

const wells: TestAccount = {
  ...penfed,
  id: "3",
  nickname: "Wells Fargo Joint",
  institution: "Wells Fargo",
  routingTag: "NY_PROPERTY",
  currentBalance: 1300,
  accountLastFour: "9912",
};

const pacificLuxe: TestAccount = {
  ...penfed,
  id: "4",
  nickname: "Mercury Pacific Luxe Rentals checking",
  institution: "Mercury",
  accountType: "BUSINESS_CHECKING",
  designation: "BUSINESS",
  routingTag: "PACIFIC_LUXE",
  businessEntity: { name: "Pacific Luxe" },
};

function buildAliases(accounts: TestAccount[]): AccountAlias[] {
  const rows: AccountAlias[] = [];
  for (const a of accounts) {
    for (const alias of generateSystemAliases({
      id: a.id,
      nickname: a.nickname,
      institution: a.institution,
      accountType: a.accountType,
      designation: a.designation,
      routingTag: a.routingTag,
      accountLastFour: a.accountLastFour,
      businessEntityName: a.businessEntity?.name ?? null,
    })) {
      rows.push({
        id: `${a.id}-${alias}`,
        userId: "u1",
        financialAccountId: a.id,
        alias,
        normalizedAlias: normalizeAlias(alias),
        source: "SYSTEM",
        confidence: 1,
      });
    }
  }
  if (accounts.some((a) => a.id === "1")) {
    rows.push({
      id: "main-checking",
      userId: "u1",
      financialAccountId: "1",
      alias: "main checking",
      normalizedAlias: normalizeAlias("main checking"),
      source: "USER",
      confidence: 1,
    });
  }
  return rows;
}

function asAccounts(list: TestAccount[]) {
  return list as unknown as Parameters<typeof parseCFODataCommand>[1];
}

describe("voice integration parsing", () => {
  const accounts = [penfed, wells, pacificLuxe];
  const aliases = buildAliases(accounts);

  it("Update my PenFed checking to twenty-six thousand four hundred fifty", () => {
    const msg = normalizeCfoMessage("Update my PenFed checking to twenty-six thousand four hundred fifty");
    const cmd = parseCFODataCommand(msg, asAccounts(accounts), { aliases });
    expect(cmd.intent).toBe("UPDATE_ACCOUNT_BALANCE");
    expect(cmd.accountId).toBe("1");
    expect(cmd.amount).toBe(26450);
  });

  it("My Wells account has thirteen hundred", () => {
    const msg = normalizeCfoMessage("My Wells Fargo account has thirteen hundred dollars now");
    const cmd = parseCFODataCommand(msg, asAccounts(accounts), { aliases });
    expect(cmd.intent).toBe("UPDATE_ACCOUNT_BALANCE");
    expect(cmd.accountId).toBe("3");
    expect(cmd.amount).toBe(1300);
  });

  it("Mark the mortgage paid", () => {
    const msg = normalizeCfoMessage("Mark the mortgage paid");
    const cmd = parseCFODataCommand(msg, asAccounts(accounts), { aliases });
    expect(cmd.intent).toBe("MARK_BILL_PAID");
  });

  it("The five-thousand-dollar W-2 came in", () => {
    const msg = normalizeCfoMessage("The five thousand dollar W-2 deposit came in");
    const cmd = parseCFODataCommand(msg, asAccounts(accounts), { aliases });
    expect(cmd.intent).toBe("MARK_INCOME_RECEIVED");
    expect(cmd.amount).toBe(5000);
  });

  it("Move twenty-nine hundred from PenFed to Wells", () => {
    const msg = normalizeCfoMessage("Move twenty nine hundred from PenFed to Wells Fargo");
    const cmd = parseCFODataCommand(msg, asAccounts(accounts), { aliases });
    expect(cmd.intent).toBe("TRANSFER_BETWEEN_ACCOUNTS");
    expect(cmd.amount).toBe(2900);
    expect(cmd.sourceAccountId).toBe("1");
    expect(cmd.destinationAccountId).toBe("3");
  });

  it("Update the rental account to fifty-two hundred", () => {
    const msg = normalizeCfoMessage("Update the rental account to fifty two hundred");
    const cmd = parseCFODataCommand(msg, asAccounts(accounts), { aliases });
    expect(cmd.intent).toBe("UPDATE_ACCOUNT_BALANCE");
    expect(cmd.accountId).toBe("4");
    expect(cmd.amount).toBe(5200);
  });

  it("does not auto-execute — parsed command still needs UI confirmation", () => {
    const msg = normalizeCfoMessage("Update my main checking to twenty six thousand");
    const cmd = parseCFODataCommand(msg, asAccounts(accounts), { aliases });
    expect(cmd.intent).toBe("UPDATE_ACCOUNT_BALANCE");
    expect(cmd.amount).toBe(26000);
    expect(cmd.accountId).toBeTruthy();
  });
});
