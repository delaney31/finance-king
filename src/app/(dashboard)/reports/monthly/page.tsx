import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { buildDashboardSnapshot } from "@/lib/engine";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default async function MonthlyReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const snapshot = await getEngineSnapshot(session.user.id);
  const dashboard = buildDashboardSnapshot(snapshot);
  const month = format(new Date(), "MMMM yyyy");

  const income = await prisma.incomeSource.findMany({ where: { userId: session.user.id } });
  const bills = await prisma.bill.findMany({ where: { userId: session.user.id } });

  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = bills.reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Monthly Report — {month}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Total Income</CardTitle></CardHeader>
          <CardContent><p className="font-mono-amount text-2xl text-fk-safe-green">{formatMoney(totalIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Total Expenses</CardTitle></CardHeader>
          <CardContent><p className="font-mono-amount text-2xl text-fk-risk-red">{formatMoney(totalExpenses)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Net Cash Flow</CardTitle></CardHeader>
          <CardContent><p className="font-mono-amount text-2xl">{formatMoney(totalIncome - totalExpenses)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Month Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>Beginning cash: {formatMoney(dashboard.totalLiquidCash)}</p>
          <p>Ending cash (projected): {formatMoney(dashboard.monthEndBuffer)}</p>
          <p>Emergency reserve: {formatMoney(dashboard.protectedEmergency)}</p>
          <p>Tax reserve: {formatMoney(dashboard.taxReserve)}</p>
          <p>Safe to spend: {formatMoney(dashboard.safeToSpend.thisMonth)}</p>
          <p>Remaining debt: {formatMoney(dashboard.totalDebt)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
