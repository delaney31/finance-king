import type { RiskLevel } from "@prisma/client";
import { eachDayUntil, parseDate, toDateString } from "./dates";
import { computeSafeToSpend } from "./safe-to-spend";
import type { DailyProjection, EngineSnapshot, OverdraftRisk } from "./types";

function riskFromBalance(balance: number, floor: number): RiskLevel {
  if (balance < 0) return "RED";
  if (balance < floor) return "ORANGE";
  if (balance < floor * 1.5) return "YELLOW";
  return "GREEN";
}

export function projectDailyBalances(
  snapshot: EngineSnapshot,
  days = 90
): DailyProjection[] {
  const start = parseDate(snapshot.asOfDate);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  const projections: DailyProjection[] = [];
  const accountBalances: Record<string, number> = {};
  for (const a of snapshot.accounts.filter((x) => x.isLiquid)) {
    accountBalances[a.id] = a.currentBalance;
  }

  for (const day of eachDayUntil(start, end)) {
    const dateStr = toDateString(day);
    const startingBalance = Object.values(accountBalances).reduce((s, v) => s + v, 0);

    const scheduledIncome = snapshot.income
      .filter(
        (i) =>
          i.status === "SCHEDULED" &&
          i.expectedDate &&
          i.expectedDate === dateStr
      )
      .reduce((s, i) => s + i.amount, 0);

    const scheduledExpenses = [
      ...snapshot.bills.filter((b) => b.nextDueDate === dateStr),
      ...snapshot.debtPayments.filter((p) => p.dueDate === dateStr),
      ...snapshot.plannedPurchases.filter(
        (p) => p.isCommitted && p.plannedDate === dateStr
      ),
    ].reduce((s, item) => s + ("amount" in item ? item.amount : item.maxAmount), 0);

    for (const inc of snapshot.income.filter(
      (i) => i.status === "SCHEDULED" && i.expectedDate === dateStr
    )) {
      const liquidAccounts = snapshot.accounts.filter((a) => a.isLiquid);
      if (liquidAccounts[0]) {
        accountBalances[liquidAccounts[0].id] =
          (accountBalances[liquidAccounts[0].id] ?? 0) + inc.amount;
      }
    }

    for (const bill of snapshot.bills.filter((b) => b.nextDueDate === dateStr)) {
      const acct = bill.accountId ?? snapshot.accounts.find((a) => a.isLiquid)?.id;
      if (acct) accountBalances[acct] = (accountBalances[acct] ?? 0) - bill.amount;
    }

    for (const payment of snapshot.debtPayments.filter((p) => p.dueDate === dateStr)) {
      const acct = payment.accountId ?? snapshot.accounts.find((a) => a.isLiquid)?.id;
      if (acct) accountBalances[acct] = (accountBalances[acct] ?? 0) - payment.amount;
    }

    const endingBalance = Object.values(accountBalances).reduce((s, v) => s + v, 0);
    const daySnapshot = { ...snapshot, asOfDate: dateStr };
    const sts = computeSafeToSpend(daySnapshot, "today");

    const minFloor = Math.min(
      ...snapshot.accounts
        .filter((a) => a.isLiquid)
        .map((a) => a.minimumTargetBalance)
    );

    projections.push({
      date: dateStr,
      startingBalance,
      scheduledIncome,
      scheduledExpenses,
      actualSpending: 0,
      endingBalance,
      safeToSpend: sts.today,
      riskLevel: riskFromBalance(endingBalance, minFloor || 0),
      byAccount: { ...accountBalances },
    });
  }

  return projections;
}

export function computeOverdraftRisk(
  snapshot: EngineSnapshot,
  days = 90
): OverdraftRisk[] {
  const projections = projectDailyBalances(snapshot, days);
  const risks: OverdraftRisk[] = [];

  for (const account of snapshot.accounts.filter((a) => a.isLiquid)) {
    let lowest = account.currentBalance;
    let lowestDate = snapshot.asOfDate;
    let worstRisk: RiskLevel = "GREEN";

    for (const day of projections) {
      const bal = day.byAccount[account.id] ?? 0;
      if (bal < lowest) {
        lowest = bal;
        lowestDate = day.date;
      }
      const dayRisk = riskFromBalance(bal, account.minimumTargetBalance);
      if (dayRisk === "RED" || (dayRisk === "ORANGE" && worstRisk !== "RED")) {
        worstRisk = dayRisk;
      } else if (dayRisk === "YELLOW" && worstRisk === "GREEN") {
        worstRisk = dayRisk;
      }
    }

    if (worstRisk !== "GREEN") {
      const emergency = snapshot.accounts.find((a) => a.routingTag === "EMERGENCY");
      const donor = snapshot.accounts.find(
        (a) =>
          a.isLiquid &&
          a.routingTag !== "EMERGENCY" &&
          a.id !== account.id &&
          a.currentBalance > account.minimumTargetBalance + 1000
      );

      risks.push({
        accountId: account.id,
        accountName: account.nickname,
        riskLevel: worstRisk,
        lowestBalance: lowest,
        lowestBalanceDate: lowestDate,
        suggestedTransfer:
          donor && lowest < account.minimumTargetBalance
            ? {
                fromAccountId: donor.id,
                toAccountId: account.id,
                amount: Math.ceil(account.minimumTargetBalance - lowest),
                reason: `Prevent overdraft on ${account.nickname}`,
              }
            : undefined,
      });
    }
  }

  return risks;
}

export function getSevenDayRiskReport(snapshot: EngineSnapshot): {
  date: string;
  riskLevel: RiskLevel;
  endingBalance: number;
  safeToSpend: number;
}[] {
  return projectDailyBalances(snapshot, 7).map((d) => ({
    date: d.date,
    riskLevel: d.riskLevel,
    endingBalance: d.endingBalance,
    safeToSpend: d.safeToSpend,
  }));
}
