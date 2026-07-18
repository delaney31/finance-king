import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { PageVoiceActions } from "@/components/voice/page-voice-actions";

export default async function BillsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const bills = await prisma.bill.findMany({
    where: { userId: session.user.id },
    orderBy: { nextDueDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bills & Obligations</h1>
        <PageVoiceActions label="Record payment by voice" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {bills.map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{b.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono-amount text-xl font-semibold">{formatMoney(Number(b.amount))}</p>
              <p className="text-sm text-fk-muted">
                {b.nextDueDate ? `Due ${format(b.nextDueDate, "MMM d, yyyy")}` : `Due day ${b.dueDay}`}
                {" · "}{b.frequency}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
