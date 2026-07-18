import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountsGrid } from "@/components/accounts/accounts-grid";
import { VoiceCoachMark } from "@/components/voice/voice-coach-mark";

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

  const accountCards = accounts.map((a) => ({
    id: a.id,
    nickname: a.nickname,
    institution: a.institution,
    accountType: a.accountType,
    routingTag: a.routingTag,
    currentBalance: Number(a.currentBalance),
    protectedBalance: Number(a.protectedBalance),
    minimumTargetBalance: Number(a.minimumTargetBalance),
    accountLastFour: a.accountLastFour,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Accounts</h1>
      <VoiceCoachMark />
      <AccountsGrid accounts={accountCards} />

      <Card>
        <CardHeader>
          <CardTitle>Account Routing Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {routingRules.map((r) => (
            <div key={r.id} className="flex justify-between text-sm">
              <span>{r.name}</span>
              <span className="text-fk-muted">
                {Number(r.allocationPercent)}% → {r.targetAccount.nickname}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
