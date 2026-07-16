import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const goals = await prisma.savingsGoal.findMany({ where: { userId: session.user.id } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financial Goals</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((g) => {
          const pct = Number(g.targetAmount) > 0 ? (Number(g.currentAmount) / Number(g.targetAmount)) * 100 : 0;
          return (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="text-base">{g.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono-amount text-xl">
                  {formatMoney(Number(g.currentAmount))} / {formatMoney(Number(g.targetAmount))}
                </p>
                <Progress value={Math.min(100, pct)} className="mt-2" />
                {g.isProtected && <p className="mt-1 text-xs text-fk-gold">Protected reserve</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
