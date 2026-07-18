import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { PageVoiceActions } from "@/components/voice/page-voice-actions";

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    include: { account: true, category: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <PageVoiceActions label="Add transaction by voice" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-fk-muted">No transactions yet. Upload statements or add manually.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-fk-border py-2 text-sm">
                  <div>
                    <p>{t.description}</p>
                    <p className="text-xs text-fk-muted">
                      {format(t.date, "MMM d, yyyy")} · {t.account.nickname}
                      {t.isTransfer && <Badge className="ml-2" variant="outline">Transfer</Badge>}
                    </p>
                  </div>
                  <span className={`font-mono-amount ${Number(t.amount) < 0 ? "text-fk-risk-red" : "text-fk-safe-green"}`}>
                    {formatMoney(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
