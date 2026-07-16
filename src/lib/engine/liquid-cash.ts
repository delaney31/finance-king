import { decimalToNumber, sumMoney, toDecimal } from "@/lib/utils/money";
import type { EngineAccount, EngineSnapshot } from "./types";

export function isCreditAccount(accountType: string): boolean {
  return ["CREDIT_CARD", "VEHICLE_LOAN", "MORTGAGE", "PERSONAL_LOAN"].includes(accountType);
}

/** Spendable cash uses available balance when set (excludes pending deposits). */
export function spendableBalance(account: EngineAccount): number {
  if (!account.isLiquid || isCreditAccount(account.accountType)) {
    return account.currentBalance;
  }
  if (account.availableBalance != null) {
    return account.availableBalance;
  }
  return account.currentBalance;
}

export function computeLiquidCash(accounts: EngineAccount[]): number {
  const liquid = accounts
    .filter((a) => a.isLiquid && !isCreditAccount(a.accountType))
    .map((a) => spendableBalance(a));
  return decimalToNumber(sumMoney(liquid));
}

export function computeTotalDebt(accounts: EngineAccount[]): number {
  const debt = accounts
    .filter((a) => isCreditAccount(a.accountType))
    .map((a) => Math.abs(a.currentBalance));
  return decimalToNumber(sumMoney(debt));
}

export function computeCreditUtilization(accounts: EngineAccount[]): {
  overall: number;
  byCard: { id: string; name: string; utilization: number; balance: number; limit: number }[];
} {
  const cards = accounts.filter((a) => a.accountType === "CREDIT_CARD" && a.creditLimit);
  const byCard = cards.map((c) => {
    const balance = Math.abs(c.currentBalance);
    const limit = c.creditLimit ?? 1;
    return {
      id: c.id,
      name: c.nickname,
      balance,
      limit,
      utilization: limit > 0 ? balance / limit : 0,
    };
  });
  const totalBalance = byCard.reduce((s, c) => s + c.balance, 0);
  const totalLimit = byCard.reduce((s, c) => s + c.limit, 0);
  return {
    overall: totalLimit > 0 ? totalBalance / totalLimit : 0,
    byCard,
  };
}

export function computeOperatingCash(
  accounts: EngineAccount[],
  routingTags: string[]
): number {
  const filtered = accounts.filter(
    (a) => a.isLiquid && routingTags.includes(a.routingTag) && !isCreditAccount(a.accountType)
  );
  return decimalToNumber(sumMoney(filtered.map((a) => spendableBalance(a))));
}

export function getAccountByTag(accounts: EngineAccount[], tag: string): EngineAccount[] {
  return accounts.filter((a) => a.routingTag === tag);
}

export function computeProtectedReserves(snapshot: EngineSnapshot): {
  emergency: number;
  emergencyShortfall: number;
  taxReserve: number;
  taxShortfall: number;
  totalProtected: number;
} {
  const emergencyGoal = snapshot.goals.find(
    (g) => g.type === "EMERGENCY_FUND" || g.name.toLowerCase().includes("emergency")
  );
  const taxGoal = snapshot.goals.find(
    (g) => g.type === "TAX_RESERVE" || g.name.toLowerCase().includes("tax")
  );

  const emergencyAccount = snapshot.accounts.find((a) => a.routingTag === "EMERGENCY");
  const taxAccount = snapshot.accounts.find((a) => a.routingTag === "TAX_RESERVE");

  const emergencyActual =
    emergencyGoal?.currentAmount ??
    (emergencyAccount
      ? Math.min(emergencyAccount.currentBalance, emergencyAccount.protectedBalance || emergencyAccount.currentBalance)
      : 0);

  const emergencyTarget = emergencyGoal?.targetAmount ?? emergencyAccount?.protectedBalance ?? 0;
  const taxActual = taxGoal?.currentAmount ?? taxAccount?.currentBalance ?? 0;
  const taxTarget = taxGoal?.targetAmount ?? 0;

  const emergencyShortfall = Math.max(0, emergencyTarget - emergencyActual);
  const taxShortfall = Math.max(0, taxTarget - taxActual);

  return {
    emergency: emergencyActual,
    emergencyShortfall,
    taxReserve: taxActual,
    taxShortfall,
    totalProtected: emergencyActual + taxActual,
  };
}
