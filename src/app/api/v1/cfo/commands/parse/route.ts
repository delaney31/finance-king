import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCFODataCommand } from "@/lib/ai/commands/parser";
import { ensureSystemAliases } from "@/lib/accounts/alias-service";
import { learnAlias } from "@/lib/accounts/alias-service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const message = body.message;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const preference = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  const accounts = await prisma.financialAccount.findMany({
    where: { userId: session.user.id },
    include: { businessEntity: true },
  });

  const aliases = await ensureSystemAliases(session.user.id);

  if (body.learnAlias && body.accountPhrase && body.selectedAccountId) {
    await learnAlias(session.user.id, body.accountPhrase, body.selectedAccountId);
  }

  const command = parseCFODataCommand(message, accounts, {
    aliases,
    timezone: preference?.timezone ?? "America/New_York",
    overrideAccountId: body.selectedAccountId,
    overrideAccountPhrase: body.accountPhrase,
  });

  const needsConfirmation = command.intent !== "UNKNOWN" && command.missingFields.length === 0;

  const { matchAccount } = await import("@/lib/ai/commands/account-matcher");
  const accountName = body.accountPhrase ?? message;
  const matchResult = matchAccount(accounts, { accountName }, aliases);

  return NextResponse.json({
    command,
    needsConfirmation,
    preview: needsConfirmation
      ? buildPreview(command)
      : command.clarificationQuestion
        ? { type: "clarification", question: command.clarificationQuestion }
        : null,
    candidates: matchResult.resolutionCandidates ?? [],
    accountPhrase: matchResult.matchedPhrase,
  });
}

function buildPreview(command: ReturnType<typeof parseCFODataCommand>) {
  switch (command.intent) {
    case "UPDATE_ACCOUNT_BALANCE":
      return {
        type: "balance_update",
        title: `Update ${command.accountName}?`,
        lines: [
          { label: "Current balance", value: command.previousAmount },
          { label: "New balance", value: command.amount },
          {
            label: "Change",
            value:
              command.amount != null && command.previousAmount != null
                ? command.amount - command.previousAmount
                : undefined,
          },
        ],
        recalculates: [
          "Total liquid cash",
          "Personal operating cash",
          "Safe to spend",
          "Month-end buffer",
          "Year-end buffer",
          "Overdraft risk",
        ],
      };
    case "TRANSFER_BETWEEN_ACCOUNTS":
      return {
        type: "transfer",
        title: "Transfer between accounts?",
        lines: [
          { label: "From", value: command.sourceAccountName },
          { label: "To", value: command.destinationAccountName },
          { label: "Amount", value: command.amount },
        ],
        note: "Internal transfer — not counted as income or expense",
      };
    case "MARK_INCOME_RECEIVED":
      return {
        type: "income",
        title: `Record ${command.incomeName ?? "income"} deposit?`,
        lines: [
          { label: "Account", value: command.accountName },
          { label: "Amount", value: command.amount },
          { label: "Status", value: "Cleared" },
        ],
      };
    default:
      return {
        type: "generic",
        title: command.summary,
        lines: [],
      };
  }
}
