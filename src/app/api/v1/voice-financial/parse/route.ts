import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSystemAliases } from "@/lib/accounts/alias-service";
import { parseVoiceFinancialCommand } from "@/lib/voice-financial/parser";
import { buildVoicePreview } from "@/lib/voice-financial/preview";
import { loadPayees } from "@/lib/voice-financial/payee-service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const transcript = body.transcript;
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "Transcript required" }, { status: 400 });
  }

  const preference = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  const accounts = await prisma.financialAccount.findMany({
    where: { userId: session.user.id },
    include: { businessEntity: true },
  });

  const aliases = await ensureSystemAliases(session.user.id);
  const payees = await loadPayees(session.user.id);

  let contextAccountName: string | undefined;
  if (body.contextAccountId) {
    const ctx = accounts.find((a) => a.id === body.contextAccountId);
    contextAccountName = ctx?.nickname;
  }

  const command = parseVoiceFinancialCommand(transcript, accounts, {
    aliases,
    timezone: preference?.timezone ?? "America/New_York",
    contextAccountId: body.contextAccountId,
    contextAccountName,
    payees,
    selectedAccountId: body.selectedAccountId,
    selectedAccountPhrase: body.selectedAccountPhrase,
  });

  const needsConfirmation =
    command.intent !== "UNKNOWN" && command.missingFields.length === 0;

  return NextResponse.json({
    command,
    needsConfirmation,
    preview: needsConfirmation ? buildVoicePreview(command, accounts) : null,
    clarificationQuestion: command.clarificationQuestion,
  });
}
