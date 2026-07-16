import {
  buildDashboardSnapshot,
  computeAllHorizons,
  computeOverdraftRisk,
  computeSafeToSpend,
  projectDailyBalances,
  simulatePurchaseImpact,
} from "@/lib/engine";
import {
  buildAvalanchePlan,
  buildSnowballPlan,
  computeUtilizationTargets,
  CREDIT_DISCLAIMER,
} from "@/lib/engine/credit";
import { computeLiquidCash, computeProtectedReserves } from "@/lib/engine/liquid-cash";
import type { EngineSnapshot } from "@/lib/engine/types";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import type { FinancialToolResult } from "../types";

function wrap<T>(
  snapshotId: string,
  data: T,
  warnings: string[] = [],
  assumptions: string[] = []
): FinancialToolResult<T> {
  return {
    data,
    warnings,
    assumptions,
    calculatedAt: new Date().toISOString(),
    sourceSnapshotId: snapshotId,
  };
}

export async function getCurrentFinancialState(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string
): Promise<FinancialToolResult<ReturnType<typeof buildDashboardSnapshot>>> {
  const dashboard = buildDashboardSnapshot(snapshot);
  const assumptions: string[] = [];
  if (dashboard.isProvisional) {
    assumptions.push("Some financial data is provisional or incomplete");
  }
  return wrap(snapshotId, dashboard, [], assumptions);
}

export async function calculateSafeToSpend(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  horizon: "today" | "week" | "month" | "payday" = "today"
): Promise<
  FinancialToolResult<{
    horizon: string;
    result: ReturnType<typeof computeSafeToSpend>;
    breakdown: Array<{ label: string; amount: number; description?: string }>;
  }>
> {
  const result = computeSafeToSpend(snapshot, horizon);
  const reserves = computeProtectedReserves(snapshot);
  const availableLiquid = computeLiquidCash(snapshot.accounts);

  const breakdown = [
    { label: "Cleared available cash", amount: availableLiquid },
    { label: "Protected emergency savings", amount: reserves.emergency, description: "Excluded from spending" },
    { label: "Tax reserves (shortfall)", amount: reserves.taxShortfall, description: "Reserved for taxes" },
    { label: "Required bills & debt payments", amount: result.committed - reserves.emergencyShortfall - reserves.taxShortfall - result.safetyMargin },
    { label: "Minimum account floors", amount: 0, description: "Included in committed total" },
    { label: "Committed debt payments", amount: 0, description: "Included in committed total" },
    { label: "Approved planned spending", amount: 0, description: "Included in committed total" },
    { label: "Safety margin", amount: result.safetyMargin },
    { label: "Final safe-to-spend", amount: result.today },
  ];

  const warnings: string[] = [];
  if (result.isProvisional) {
    warnings.push("Safe-to-spend is provisional due to missing or unconfirmed data");
  }

  return wrap(snapshotId, { horizon, result, breakdown }, warnings, result.missingFields);
}

export async function simulatePurchase(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  input: {
    name: string;
    amount: number;
    date: string;
    accountId?: string;
    isBusiness?: boolean;
  }
): Promise<
  FinancialToolResult<{
    impact: ReturnType<typeof simulatePurchaseImpact>;
    purchase: typeof input;
    recommendedAccount?: { id: string; nickname: string; lastFour?: string | null };
  }>
> {
  let accountId = input.accountId;
  if (!accountId) {
    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId,
        isLiquid: true,
        accountType: { notIn: ["CREDIT_CARD", "VEHICLE_LOAN", "MORTGAGE", "PERSONAL_LOAN"] },
        ...(input.isBusiness ? { designation: "BUSINESS" } : { designation: "PERSONAL" }),
      },
      orderBy: { currentBalance: "desc" },
    });
    accountId = accounts[0]?.id;
  }

  if (!accountId) {
    return wrap(
      snapshotId,
      {
        impact: {
          canAffordCash: false,
          recommendation: "decline" as const,
          affectedAccounts: [],
          monthEndBuffer: 0,
          yearEndBuffer: 0,
          protectedReservesIntact: true,
          billsRemainFunded: false,
          maxSafeBudget: 0,
          safeToSpendBefore: 0,
          safeToSpendAfter: 0,
          requiredCushion: 0,
          shortfall: 0,
          emergencyAmountUsed: 0,
          taxAmountUsed: 0,
          primaryReason: "OTHER" as const,
          warnings: ["No suitable payment account found"],
        },
        purchase: input,
      },
      ["No liquid account available for this purchase"]
    );
  }

  const account = snapshot.accounts.find((a) => a.id === accountId);
  const impact = simulatePurchaseImpact(snapshot, {
    name: input.name,
    amount: input.amount,
    date: input.date,
    accountId,
    isBusiness: input.isBusiness,
  });

  const dbAccount = await prisma.financialAccount.findUnique({
    where: { id: accountId },
    select: { nickname: true, accountLastFour: true },
  });

  return wrap(snapshotId, {
    impact,
    purchase: { ...input, accountId },
    recommendedAccount: dbAccount
      ? { id: accountId, nickname: dbAccount.nickname, lastFour: dbAccount.accountLastFour }
      : account
        ? { id: accountId, nickname: account.nickname }
        : undefined,
  }, impact.warnings);
}

export async function explainMetric(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  metricName: string
): Promise<
  FinancialToolResult<{
    metricName: string;
    lines: Array<{ label: string; amount?: number; description?: string }>;
    summary: string;
  }>
> {
  const dashboard = buildDashboardSnapshot(snapshot);
  const sts = computeAllHorizons(snapshot);
  const reserves = computeProtectedReserves(snapshot);
  const liquid = computeLiquidCash(snapshot.accounts);

  const lines: Array<{ label: string; amount?: number; description?: string }> = [];

  switch (metricName) {
    case "safe_to_spend":
      lines.push(
        { label: "Cleared liquid cash", amount: liquid },
        { label: "Protected emergency reserve", amount: reserves.emergency, description: "Untouchable" },
        { label: "Tax reserve shortfall", amount: reserves.taxShortfall },
        { label: "Committed obligations", amount: sts.committed },
        { label: "Safety margin", amount: sts.safetyMargin },
        { label: "Safe to spend today", amount: sts.today }
      );
      break;
    case "month_end_buffer":
      lines.push(
        { label: "Current liquid cash", amount: liquid },
        { label: "Month-end projected buffer", amount: dashboard.monthEndBuffer },
        { label: "Committed this month", amount: sts.committed }
      );
      break;
    case "year_end_buffer":
      lines.push(
        { label: "Base scenario year-end buffer", amount: dashboard.yearEndBuffer },
        { label: "With ESOP (Strong scenario)", amount: dashboard.yearEndBufferWithEsop }
      );
      break;
    case "credit_utilization":
      lines.push(
        { label: "Overall utilization", amount: dashboard.creditUtilization * 100, description: "Percent" },
        { label: "Total debt", amount: dashboard.totalDebt }
      );
      break;
    case "overdraft_risk":
      for (const risk of dashboard.overdraftRisks) {
        lines.push({
          label: risk.accountName,
          amount: risk.lowestBalance,
          description: `Risk ${risk.riskLevel} on ${risk.lowestBalanceDate}`,
        });
      }
      break;
    default:
      lines.push({ label: "Safe to spend today", amount: sts.today });
  }

  const summary =
    metricName === "safe_to_spend"
      ? `Safe-to-spend is $${sts.today.toFixed(2)} because $${liquid.toFixed(2)} cleared cash minus $${sts.committed.toFixed(2)} in commitments and reserves.`
      : `Breakdown for ${metricName.replace(/_/g, " ")}.`;

  await prisma.financialCalculationExplanation.create({
    data: {
      userId,
      metricName,
      snapshotId,
      breakdown: lines,
    },
  });

  return wrap(snapshotId, { metricName, lines, summary });
}

export async function calculateDebtPaymentOptions(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  debtName?: string
): Promise<FinancialToolResult<unknown>> {
  const cards = await prisma.creditCard.findMany({
    where: { userId },
    include: { account: true },
  });

  const cardStates = cards.map((c) => ({
    id: c.id,
    name: c.issuer,
    balance: Math.abs(Number(c.currentBalance)),
    limit: Number(c.creditLimit),
    apr: Number(c.apr ?? 0),
    minimumPayment: Number(c.minimumPayment ?? 0),
    dueDay: c.paymentDueDay,
  }));

  const target = debtName
    ? cardStates.find((c) => c.name.toLowerCase().includes(debtName.toLowerCase()))
    : cardStates[0];

  const utilization = computeUtilizationTargets(cardStates);
  const monthlyBudget = target ? Math.max(target.minimumPayment * 2, 5000) : 5000;
  const avalanche = buildAvalanchePlan(cardStates, monthlyBudget);
  const snowball = buildSnowballPlan(cardStates, monthlyBudget);
  const reserves = computeProtectedReserves(snapshot);

  return wrap(
    snapshotId,
    {
      targetCard: target,
      utilizationTargets: utilization,
      avalanche: { payoffDate: avalanche.payoffDate, totalInterest: avalanche.totalInterest },
      snowball: { payoffDate: snowball.payoffDate, totalInterest: snowball.totalInterest },
      minimumRequired: target?.minimumPayment ?? 0,
      emergencyReserveProtected: reserves.emergency,
      disclaimer: CREDIT_DISCLAIMER,
    },
    [],
    ["Never drain emergency savings solely to improve utilization", CREDIT_DISCLAIMER]
  );
}

export async function calculateCreditUtilization(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string
): Promise<FinancialToolResult<unknown>> {
  const cards = await prisma.creditCard.findMany({
    where: { userId },
    include: { account: true },
  });

  const cardStates = cards.map((c) => ({
    id: c.id,
    name: c.issuer,
    balance: Math.abs(Number(c.currentBalance)),
    limit: Number(c.creditLimit),
    apr: Number(c.apr ?? 0),
    minimumPayment: Number(c.minimumPayment ?? 0),
  }));

  const targets = computeUtilizationTargets(cardStates);
  const dashboard = buildDashboardSnapshot(snapshot);

  return wrap(snapshotId, {
    overall: dashboard.creditUtilization,
    byCard: cardStates.map((c) => ({
      name: c.name,
      balance: c.balance,
      limit: c.limit,
      utilization: c.limit > 0 ? c.balance / c.limit : 0,
    })),
    paymentTargets: targets,
    disclaimer: CREDIT_DISCLAIMER,
  });
}

export async function detectOverdraftRisk(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string
): Promise<FinancialToolResult<unknown>> {
  const risks = computeOverdraftRisk(snapshot, 30);
  const warnings = risks.filter((r) => r.riskLevel === "RED" || r.riskLevel === "ORANGE");

  return wrap(
    snapshotId,
    { risks, atRisk: warnings.length > 0 },
    warnings.length > 0 ? [`${warnings.length} account(s) at overdraft risk`] : [],
    ["Pending deposits are not treated as available money"]
  );
}

export async function simulateIncomeDelay(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  incomeName?: string,
  delayedDate?: string
): Promise<FinancialToolResult<unknown>> {
  const income = snapshot.income.find(
    (i) =>
      i.status === "SCHEDULED" &&
      (!incomeName || i.name.toLowerCase().includes(incomeName.toLowerCase()))
  );

  if (!income) {
    return wrap(snapshotId, { found: false }, ["No matching scheduled income found"]);
  }

  const delayDate = delayedDate ?? income.expectedDate ?? snapshot.asOfDate;
  const modified: EngineSnapshot = {
    ...snapshot,
    income: snapshot.income.map((i) =>
      i.id === income.id ? { ...i, expectedDate: delayDate } : i
    ),
  };

  const before = computeAllHorizons(snapshot);
  const after = computeAllHorizons(modified);
  const risksBefore = computeOverdraftRisk(snapshot, 30);
  const risksAfter = computeOverdraftRisk(modified, 30);

  return wrap(
    snapshotId,
    {
      income: { name: income.name, amount: income.amount, originalDate: income.expectedDate, delayedDate: delayDate },
      safeToSpendBefore: before.today,
      safeToSpendAfter: after.today,
      newRisks: risksAfter.filter((r) => !risksBefore.some((b) => b.accountId === r.accountId && b.riskLevel === r.riskLevel)),
      overdraftRisks: risksAfter,
    },
    after.today < before.today ? ["Delayed income reduces near-term safe-to-spend"] : [],
    ["Projected income is not guaranteed until received and cleared"]
  );
}

export async function forecastAccountBalances(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  days = 30
): Promise<FinancialToolResult<unknown>> {
  const projections = projectDailyBalances(snapshot, days);
  return wrap(snapshotId, { projections: projections.slice(0, 14) });
}

export async function getUpcomingObligations(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  count = 3
): Promise<FinancialToolResult<unknown>> {
  const obligations = [
    ...snapshot.bills.map((b) => ({
      name: b.name,
      amount: b.amount,
      date: b.nextDueDate,
      type: "bill" as const,
    })),
    ...snapshot.debtPayments.map((d) => ({
      name: d.name,
      amount: d.amount,
      date: d.dueDate,
      type: "debt" as const,
    })),
  ]
    .filter((o) => o.date)
    .sort((a, b) => (a.date! > b.date! ? 1 : -1))
    .slice(0, count);

  return wrap(snapshotId, { obligations });
}

export async function generateMonthlyFinancialReport(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  month?: string
): Promise<FinancialToolResult<unknown>> {
  const targetMonth = month ?? format(new Date(), "yyyy-MM");
  const dashboard = buildDashboardSnapshot(snapshot);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: new Date(`${targetMonth}-01`),
        lt: new Date(new Date(`${targetMonth}-01`).setMonth(new Date(`${targetMonth}-01`).getMonth() + 1)),
      },
      clearanceStatus: "CLEARED",
    },
  });

  const income = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  return wrap(
    snapshotId,
    {
      month: targetMonth,
      incomeReceived: income,
      expensesPaid: expenses,
      netChange: income - expenses,
      safeToSpend: dashboard.safeToSpend,
      creditUtilization: dashboard.creditUtilization,
      totalDebt: dashboard.totalDebt,
      upcomingRisks: dashboard.overdraftRisks.filter((r) => r.riskLevel !== "GREEN").length,
    },
    [],
    ["Summary uses confirmed cleared transactions only"]
  );
}

export async function getRecommendedAccountForExpense(
  userId: string,
  snapshot: EngineSnapshot,
  snapshotId: string,
  expense: { name?: string; amount?: number; isBusiness?: boolean; routingTag?: string }
): Promise<FinancialToolResult<unknown>> {
  const rules = await prisma.accountRoutingRule.findMany({
    where: { userId, isActive: true },
    include: { targetAccount: true, sourceAccount: true },
  });

  const tag = expense.routingTag ?? (expense.isBusiness ? "PACIFIC_LUXE" : "PERSONAL");
  const rule = rules.find(
    (r) =>
      r.incomeSourceKey?.toLowerCase().includes(expense.name?.toLowerCase() ?? "") ||
      r.name.toLowerCase().includes(expense.name?.toLowerCase() ?? "")
  );

  const candidates = snapshot.accounts.filter(
    (a) =>
      a.isLiquid &&
      !["CREDIT_CARD", "VEHICLE_LOAN", "MORTGAGE", "PERSONAL_LOAN"].includes(a.accountType) &&
      (expense.isBusiness ? a.routingTag !== "PERSONAL" : true)
  );

  const recommended = rule?.targetAccount
    ? {
        id: rule.targetAccount.id,
        nickname: rule.targetAccount.nickname,
        lastFour: rule.targetAccount.accountLastFour,
        balance: Number(rule.targetAccount.currentBalance),
      }
    : candidates.sort((a, b) => b.currentBalance - a.currentBalance)[0]
      ? {
          id: candidates[0].id,
          nickname: candidates[0].nickname,
          balance: candidates[0].currentBalance,
        }
      : null;

  return wrap(snapshotId, { recommended, routingTag: tag, expense });
}
