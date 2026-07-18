import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: accountId } = await params;
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all";
  const search = url.searchParams.get("q")?.toLowerCase();

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const eventTypeFilter: Record<string, string[]> = {
    income: ["INCOME_RECORDED", "TRANSFER_RECEIVED"],
    spending: ["EXPENSE_RECORDED", "PAYMENT_RECORDED"],
    transfers: ["TRANSFER_SENT", "TRANSFER_RECEIVED"],
    balance: ["BALANCE_UPDATED"],
    voice: ["EXPENSE_RECORDED", "INCOME_RECORDED", "PAYMENT_RECORDED", "TRANSFER_SENT", "TRANSFER_RECEIVED", "BALANCE_UPDATED", "VOICE_COMMAND_APPLIED"],
    imports: ["SCREENSHOT_IMPORTED"],
    system: ["ACCOUNT_DETAILS_CHANGED", "PROTECTED_AMOUNT_CHANGED", "MINIMUM_FLOOR_CHANGED"],
  };

  let events = await prisma.accountActivityEvent.findMany({
    where: {
      accountId,
      userId: session.user.id,
      ...(filter !== "all" && eventTypeFilter[filter]
        ? { eventType: { in: eventTypeFilter[filter] as never[] } }
        : {}),
      ...(filter === "voice" ? { source: "VOICE" as const } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  if (search) {
    events = events.filter(
      (e) =>
        e.description.toLowerCase().includes(search) ||
        e.payee?.toLowerCase().includes(search) ||
        e.category?.toLowerCase().includes(search) ||
        String(e.amount).includes(search)
    );
  }

  return NextResponse.json({ events, account: { id: account.id, nickname: account.nickname } });
}
