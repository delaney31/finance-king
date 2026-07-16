import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { EngineSnapshot } from "@/lib/engine/types";
import { format } from "date-fns";

export async function getEngineSnapshot(userId: string): Promise<EngineSnapshot> {
  const [
    accounts,
    income,
    bills,
    debts,
    creditCards,
    plannedPurchases,
    goals,
    preference,
    user,
  ] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId } }),
    prisma.incomeSource.findMany({ where: { userId } }),
    prisma.bill.findMany({ where: { userId } }),
    prisma.debt.findMany({ where: { userId }, include: { account: true } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.plannedPurchase.findMany({ where: { userId } }),
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const provisionalFields: string[] = [];
  if (income.some((i) => i.isProvisional)) provisionalFields.push("provisional_income");

  const debtPayments = [
    ...debts.map((d) => ({
      id: d.id,
      name: d.name,
      amount: Number(d.minimumPayment ?? 0),
      dueDate: d.targetPayoffDate
        ? format(d.targetPayoffDate, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      accountId: d.accountId,
    })),
    ...creditCards.map((c) => ({
      id: c.id,
      name: c.issuer,
      amount: Number(c.minimumPayment ?? 0),
      dueDate: c.paymentDueDay
        ? format(
            new Date(new Date().getFullYear(), new Date().getMonth(), c.paymentDueDay),
            "yyyy-MM-dd"
          )
        : format(new Date(), "yyyy-MM-dd"),
      accountId: c.accountId,
    })),
  ];

  return {
    asOfDate: format(new Date(), "yyyy-MM-dd"),
    accounts: accounts.map((a) => ({
      id: a.id,
      nickname: a.nickname,
      institution: a.institution,
      accountType: a.accountType,
      routingTag: a.routingTag,
      currentBalance: Number(a.currentBalance),
      availableBalance: a.availableBalance != null ? Number(a.availableBalance) : null,
      pendingBalance: a.pendingBalance != null ? Number(a.pendingBalance) : null,
      minimumTargetBalance: Number(a.minimumTargetBalance),
      protectedBalance: Number(a.protectedBalance),
      creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
      isLiquid: a.isLiquid,
    })),
    income: income.map((i) => ({
      id: i.id,
      name: i.name,
      amount: Number(i.amount),
      status: i.status,
      expectedDate: i.expectedDate ? format(i.expectedDate, "yyyy-MM-dd") : null,
      receivedDate: i.receivedDate ? format(i.receivedDate, "yyyy-MM-dd") : null,
      isProvisional: i.isProvisional,
    })),
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      amount: Number(b.amount),
      nextDueDate: b.nextDueDate ? format(b.nextDueDate, "yyyy-MM-dd") : null,
      dueDay: b.dueDay,
      frequency: b.frequency,
      isRequired: b.isRequired,
      accountId: b.accountId,
    })),
    debtPayments,
    plannedPurchases: plannedPurchases.map((p) => ({
      id: p.id,
      name: p.name,
      maxAmount: Number(p.maxAmount),
      plannedDate: p.plannedDate ? format(p.plannedDate, "yyyy-MM-dd") : null,
      isCommitted: p.isCommitted,
      accountId: p.accountId,
    })),
    goals: goals.map((g) => ({
      id: g.id,
      type: g.type,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount),
      isProtected: g.isProtected,
      accountId: g.accountId,
    })),
    preferences: {
      safetyMarginFlat: Number(preference?.safetyMarginFlat ?? 500),
      safetyMarginPercent: Number(preference?.safetyMarginPercent ?? 0),
    },
    provisionalFields,
  };
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}
