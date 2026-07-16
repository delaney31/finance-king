import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { buildAvalanchePlan, buildSnowballPlan, computeUtilizationTargets, CREDIT_DISCLAIMER } from "@/lib/engine";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function CreditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const creditCards = await prisma.creditCard.findMany({
    where: { userId: session.user.id },
    include: { account: true },
  });

  const cards = creditCards.map((c) => ({
    id: c.id,
    name: c.issuer,
    balance: Number(c.currentBalance),
    limit: Number(c.creditLimit),
    apr: Number(c.apr ?? 0),
    minimumPayment: Number(c.minimumPayment ?? 0),
    dueDay: c.paymentDueDay,
  }));

  const utilization = computeUtilizationTargets(cards);
  const totalBalance = cards.reduce((s, c) => s + c.balance, 0);
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  const overallUtil = totalLimit > 0 ? totalBalance / totalLimit : 0;

  const avalanche = cards.length > 0 ? buildAvalanchePlan(cards, 5000) : null;
  const snowball = cards.length > 0 ? buildSnowballPlan(cards, 5000) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Credit Cards & Payoff Planner</h1>

      <Alert>
        <AlertTitle>Educational estimates only</AlertTitle>
        <AlertDescription>{CREDIT_DISCLAIMER}</AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {creditCards.map((c) => {
          const util = Number(c.creditLimit) > 0 ? Number(c.currentBalance) / Number(c.creditLimit) : 0;
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.issuer}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono-amount text-xl">{formatMoney(Number(c.currentBalance))}</p>
                <p className="text-sm text-fk-muted">Limit: {formatMoney(Number(c.creditLimit))}</p>
                <Progress value={util * 100} className="mt-2" />
                <p className="mt-1 text-xs text-fk-muted">
                  Min payment: {formatMoney(Number(c.minimumPayment ?? 0))} · Due day {c.paymentDueDay}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilization Targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Overall utilization: {Math.round(overallUtil * 100)}%</p>
          {utilization.map((t) => (
            <div key={t.threshold} className="flex justify-between text-sm">
              <span>Below {(t.threshold * 100).toFixed(0)}%</span>
              <span className="font-mono-amount">Pay {formatMoney(t.paymentNeeded)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {avalanche && snowball && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Avalanche Strategy</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Payoff: {avalanche.payoffDate}</p>
              <p>Interest saved est.: {formatMoney(avalanche.totalInterest)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Snowball Strategy</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Payoff: {snowball.payoffDate}</p>
              <p>Interest est.: {formatMoney(snowball.totalInterest)}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
