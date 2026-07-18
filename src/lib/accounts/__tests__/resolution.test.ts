import { describe, it, expect } from "vitest";
import { resolveAccountReference } from "../resolution";
import type { AccountAlias, ResolutionAccount } from "../types";
import { generateSystemAliases } from "../alias-generator";
import { normalizeAlias } from "../normalize";

const penfedChecking: ResolutionAccount = {
  id: "1",
  nickname: "PenFed Free Checking",
  institution: "PenFed",
  accountType: "CHECKING",
  designation: "PERSONAL",
  routingTag: "PERSONAL",
  accountLastFour: "0022",
};

const penfedSavings: ResolutionAccount = {
  id: "2",
  nickname: "Premium Online Savings",
  institution: "PenFed",
  accountType: "SAVINGS",
  designation: "PERSONAL",
  routingTag: "EMERGENCY",
  accountLastFour: "4411",
};

const pacificLuxe: ResolutionAccount = {
  id: "3",
  nickname: "Mercury Pacific Luxe Rentals checking",
  institution: "Mercury",
  accountType: "BUSINESS_CHECKING",
  designation: "BUSINESS",
  routingTag: "PACIFIC_LUXE",
  businessEntityName: "Pacific Luxe",
};

function aliasesFor(account: ResolutionAccount): AccountAlias[] {
  return generateSystemAliases(account).map((aliasText, i) => ({
    id: `a${i}`,
    userId: "u1",
    financialAccountId: account.id,
    alias: aliasText,
    normalizedAlias: normalizeAlias(aliasText),
    source: "SYSTEM" as const,
    confidence: 1,
  }));
}

describe("account resolution", () => {
  it("exact alias match for main checking", () => {
    const aliases = [...aliasesFor(penfedChecking), ...aliasesFor(penfedSavings)];
    const result = resolveAccountReference("main checking", [penfedChecking, penfedSavings], aliases);
    expect(result.resolvedAccountId).toBe("1");
    expect(result.requiresClarification).toBe(false);
  });

  it("resolves PenFed checking", () => {
    const aliases = aliasesFor(penfedChecking);
    const result = resolveAccountReference("PenFed checking", [penfedChecking], aliases);
    expect(result.resolvedAccountId).toBe("1");
  });

  it("resolves rental account to Pacific Luxe", () => {
    const aliases = aliasesFor(pacificLuxe);
    const result = resolveAccountReference("rental account", [pacificLuxe], aliases);
    expect(result.resolvedAccountId).toBe("3");
  });

  it("requires clarification for ambiguous Truist accounts", () => {
    const truist1: ResolutionAccount = {
      ...penfedChecking,
      id: "t1",
      nickname: "JadeSystems checking",
      institution: "Truist",
      accountLastFour: "1284",
      routingTag: "JADE_SYSTEMS",
      businessEntityName: "JadeSystems",
    };
    const truist2: ResolutionAccount = {
      ...truist1,
      id: "t2",
      accountLastFour: "1809",
    };
    const aliases = [...aliasesFor(truist1), ...aliasesFor(truist2)];
    const result = resolveAccountReference("Truist", [truist1, truist2], aliases);
    expect(result.requiresClarification).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(1);
  });
});

describe("alias generation", () => {
  it("generates PenFed aliases", () => {
    const aliases = generateSystemAliases(penfedChecking);
    expect(aliases).toContain("PenFed");
    expect(aliases).toContain("PenFed checking");
    expect(aliases.some((a) => a.includes("0022"))).toBe(true);
  });

  it("generates Pacific Luxe aliases", () => {
    const aliases = generateSystemAliases(pacificLuxe);
    expect(aliases.some((a) => /pacific luxe/i.test(a))).toBe(true);
    expect(aliases).toContain("rental account");
  });
});
