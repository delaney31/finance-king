import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountActivityTimeline } from "@/components/accounts/account-activity-timeline";
import { AccountDetailVoiceHeader } from "@/components/accounts/account-detail-voice-header";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const account = await prisma.financialAccount.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!account) notFound();

  const accountData = {
    accountId: account.id,
    nickname: account.nickname,
    institution: account.institution,
    accountType: account.accountType,
    accountLastFour: account.accountLastFour,
    currentBalance: Number(account.currentBalance),
  };

  return (
    <div className="space-y-6">
      <AccountDetailVoiceHeader account={accountData} />

      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono-amount text-3xl font-semibold">
            {formatMoney(Number(account.currentBalance))}
          </p>
          <p className="mt-1 text-sm text-fk-muted">
            {account.institution}
            {account.accountLastFour ? ` ••••${account.accountLastFour}` : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountActivityTimeline accountId={account.id} />
        </CardContent>
      </Card>
    </div>
  );
}
