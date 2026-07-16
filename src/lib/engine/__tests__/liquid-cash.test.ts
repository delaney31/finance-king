import { describe, it, expect } from "vitest";
import { computeLiquidCash, spendableBalance } from "../liquid-cash";
import type { EngineAccount } from "../types";

describe("spendableBalance", () => {
  const checking: EngineAccount = {
    id: "1",
    nickname: "Checking",
    institution: "Bank",
    accountType: "CHECKING",
    routingTag: "PERSONAL",
    currentBalance: 1000,
    availableBalance: 800,
    pendingBalance: 200,
    minimumTargetBalance: 0,
    protectedBalance: 0,
    isLiquid: true,
  };

  it("uses available balance instead of current when pending deposits exist", () => {
    expect(spendableBalance(checking)).toBe(800);
    expect(computeLiquidCash([checking])).toBe(800);
  });

  it("falls back to current balance when available is not set", () => {
    const noAvailable = { ...checking, availableBalance: null };
    expect(spendableBalance(noAvailable)).toBe(1000);
  });
});
