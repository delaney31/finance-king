import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { buildDashboardSnapshot, computeAllHorizons } from "@/lib/engine";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question } = await req.json();
  const snapshot = await getEngineSnapshot(session.user.id);
  const dashboard = buildDashboardSnapshot(snapshot);
  const sts = computeAllHorizons(snapshot);

  const bills = await prisma.bill.findMany({
    where: { userId: session.user.id },
    orderBy: { nextDueDate: "asc" },
    take: 3,
  });

  const answer = generateAnswer(question ?? "", dashboard, sts, bills);

  return NextResponse.json({
    answer,
    assumptions: [
      "Calculations based on current account balances and scheduled income/expenses",
      "Provisional income flagged separately",
      "ESOP shown only in Strong scenario",
    ],
    safeToSpendToday: sts.today,
    safeToSpendWeek: sts.thisWeek,
    safeToSpendMonth: sts.thisMonth,
    nextObligations: bills.map((b) => ({ name: b.name, amount: Number(b.amount), due: b.nextDueDate })),
    recommendedAction: dashboard.healthScore.score < 60
      ? "Review upcoming bills and reduce discretionary spending"
      : "Continue current plan; monitor Amex payoff schedule",
  });
}

function generateAnswer(
  question: string,
  dashboard: ReturnType<typeof buildDashboardSnapshot>,
  sts: ReturnType<typeof computeAllHorizons>,
  bills: { name: string; amount: unknown }[]
): string {
  const q = question.toLowerCase();

  if (q.includes("safely spend") || q.includes("safe to spend")) {
    return `Based on your current balances and commitments, you can safely spend ${sts.today.toFixed(2)} today, ${sts.thisWeek.toFixed(2)} this week, and ${sts.thisMonth.toFixed(2)} this month. This excludes your $${dashboard.protectedEmergency.toFixed(2)} protected emergency reserve.`;
  }

  if (q.includes("disneyland")) {
    return `Disneyland target budget is $600 with a hard ceiling of $700. Your current safe-to-spend today is $${sts.today.toFixed(2)}. Proceed only if this purchase does not jeopardize the Amex payment or emergency reserve.`;
  }

  if (q.includes("esop")) {
    return `Year-end buffer without ESOP: $${dashboard.yearEndBuffer.toFixed(2)}. With ESOP upside ($90k-$120k range): $${(dashboard.yearEndBufferWithEsop ?? dashboard.yearEndBuffer).toFixed(2)}. ESOP is not counted as available until received.`;
  }

  if (q.includes("credit card") || q.includes("pay first")) {
    return `Focus on Amex payoff per your plan: $15,000 before August, then $5,000/month through October. Current utilization is ${(dashboard.creditUtilization * 100).toFixed(1)}%. Avalanche strategy recommended to minimize interest.`;
  }

  return `Your total liquid cash is $${dashboard.totalLiquidCash.toFixed(2)} with $${dashboard.protectedEmergency.toFixed(2)} in protected emergency savings. Safe to spend today: $${sts.today.toFixed(2)}. Top obligations: ${bills.map((b) => b.name).join(", ")}.`;
}
