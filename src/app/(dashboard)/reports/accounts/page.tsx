import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accounts = await prisma.financialAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { nickname: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Account-Level Report</h1>
      <Card>
        <CardHeader><CardTitle>Recommended vs Actual Balances</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accounts.map((a) => (
              <div key={a.id} className="grid grid-cols-3 gap-4 border-b border-fk-border py-2 text-sm">
                <span>{a.nickname}</span>
                <span className="font-mono-amount">{formatMoney(Number(a.currentBalance))}</span>
                <span className="text-fk-muted">
                  Floor: {formatMoney(Number(a.minimumTargetBalance))}
                  {Number(a.protectedBalance) > 0 && ` · Protected: ${formatMoney(Number(a.protectedBalance))}`}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
