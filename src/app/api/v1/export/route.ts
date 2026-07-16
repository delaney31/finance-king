import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [accounts, transactions, bills, goals, income] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId }, take: 1000 }),
    prisma.bill.findMany({ where: { userId } }),
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.incomeSource.findMany({ where: { userId } }),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    bills,
    goals,
    income,
  });
}
