import { describe, it, expect } from "vitest";
import { parseVoiceFinancialCommand } from "@/lib/voice-financial/parser";
import { generateSystemAliases } from "@/lib/accounts/alias-generator";
import { normalizeAlias } from "@/lib/accounts/normalize";
import type { AccountAlias } from "@/lib/accounts/types";
import { normalizeCfoMessage } from "@/lib/nlp/normalize-message";
import { matchPayeeFromList } from "@/lib/voice-financial/payee-service";

type TestAccount = {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
  designation: string;
  routingTag: string;
  currentBalance: number;
  accountLastFour?: string | null;
  businessEntity?: { name: string } | null;
};

const penfed: TestAccount = {
  id: "1",
  nickname: "PenFed Free Checking",
  institution: "PenFed",
  accountType: "CHECKING",
  designation: "PERSONAL",
  routingTag: "PERSONAL",
  currentBalance: 24032,
  accountLastFour: "0022",
};

const wells: TestAccount = {
  ...penfed,
  id: "3",
  nickname: "Wells Fargo Joint",
  institution: "Wells Fargo",
  routingTag: "NY_PROPERTY",
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
  rows.push({
    id: "main",
    userId: "u1",
    financialAccountId: "1",
    alias: "main checking",
    normalizedAlias: "main checking",
    source: "USER",
    confidence: 1,
  });
  return rows;
}

const accounts = [penfed, wells, pacificLuxe];
const aliases = buildAliases(accounts);

describe("voice financial parser", () => {
  it("parses expense with context account preselected", () => {
    const msg = normalizeCfoMessage("I paid State Farm twelve hundred dollars");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, {
      aliases,
      contextAccountId: "1",
      contextAccountName: "PenFed Free Checking",
    });
    expect(cmd.intent).toBe("RECORD_EXPENSE");
    expect(cmd.amount).toBe(1200);
    expect(cmd.sourceAccountId).toBe("1");
    expect(cmd.payeeName?.toLowerCase() ?? "").toContain("state farm");
  });

  it("parses I paid $500 to Victor from PenFed", () => {
    const msg = normalizeCfoMessage("I paid $500 to Victor from PenFed checking");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, { aliases });
    expect(cmd.intent).toBe("RECORD_EXPENSE");
    expect(cmd.amount).toBe(500);
    expect(cmd.sourceAccountId).toBe("1");
  });

  it("parses income deposit into PenFed", () => {
    const msg = normalizeCfoMessage("The $5,000 paycheck came into PenFed");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, { aliases });
    expect(cmd.intent).toBe("RECORD_INCOME");
    expect(cmd.amount).toBe(5000);
    expect(cmd.destinationAccountId).toBe("1");
  });

  it("parses transfer from PenFed to Wells", () => {
    const msg = normalizeCfoMessage("Transfer $2,900 from PenFed to Wells Fargo");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, { aliases });
    expect(cmd.intent).toBe("RECORD_TRANSFER");
    expect(cmd.amount).toBe(2900);
    expect(cmd.sourceAccountId).toBe("1");
    expect(cmd.destinationAccountId).toBe("3");
  });

  it("parses Pacific Luxe business expense", () => {
    const msg = normalizeCfoMessage("Pacific Luxe paid $500 to Google for advertising");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, { aliases });
    expect(cmd.intent).toBe("RECORD_EXPENSE");
    expect(cmd.amount).toBe(500);
    expect(cmd.ownershipScope).toBe("BUSINESS");
  });

  it("parses balance update for Mercury", () => {
    const msg = normalizeCfoMessage("Update Mercury to $5,200");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, { aliases });
    expect(cmd.intent).toBe("UPDATE_ACCOUNT_BALANCE");
    expect(cmd.amount).toBe(5200);
    expect(cmd.destinationAccountId).toBe("4");
  });

  it("marks mortgage paid", () => {
    const msg = normalizeCfoMessage("Mark the mortgage paid");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, { aliases });
    expect(cmd.intent).toBe("MARK_BILL_PAID");
  });

  it("requires confirmation — missingFields empty when complete", () => {
    const msg = normalizeCfoMessage("I paid $1,200 to State Farm from my main checking");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, { aliases });
    expect(cmd.missingFields).toHaveLength(0);
    expect(cmd.intent).toBe("RECORD_EXPENSE");
  });

  it("matches payee State Farm to Insurance category", () => {
    const match = matchPayeeFromList("State Farm", []);
    expect(match?.category).toBe("Insurance");
    expect(match?.isNew).toBe(true);
  });
});

describe("voice financial command schema", () => {
  it("voice commands never auto-execute without missingFields check", () => {
    const msg = normalizeCfoMessage("I paid Victor five hundred");
    const cmd = parseVoiceFinancialCommand(msg, accounts as never, {
      aliases,
      contextAccountId: "1",
    });
    expect(cmd.amount).toBe(500);
    expect(cmd.sourceAccountId).toBe("1");
    expect(cmd.missingFields).not.toContain("amount");
  });
});
