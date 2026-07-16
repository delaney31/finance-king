import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accounts = await prisma.financialAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { institution: "asc" },
  });

  const routingRules = await prisma.accountRoutingRule.findMany({
    where: { userId: session.user.id },
    include: { targetAccount: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Accounts</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{a.nickname}</CardTitle>
                <Badge variant="outline">{a.routingTag}</Badge>
              </div>
              <p className="text-sm text-fk-muted">{a.institution} · {a.accountType}</p>
            </CardHeader>
            <CardContent>
              <p className="font-mono-amount text-2xl font-semibold">{formatMoney(Number(a.currentBalance))}</p>
              {Number(a.protectedBalance) > 0 && (
                <p className="mt-1 text-xs text-fk-gold">Protected: {formatMoney(Number(a.protectedBalance))}</p>
              )}
              {Number(a.minimumTargetBalance) > 0 && (
                <p className="text-xs text-fk-muted">Floor: {formatMoney(Number(a.minimumTargetBalance))}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Routing Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {routingRules.map((r) => (
            <div key={r.id} className="flex justify-between text-sm">
              <span>{r.name}</span>
              <span className="text-fk-muted">{Number(r.allocationPercent)}% → {r.targetAccount.nickname}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
