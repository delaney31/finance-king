import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCFODataCommand } from "@/lib/ai/commands/parser";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const accounts = await prisma.financialAccount.findMany({
    where: { userId: session.user.id },
  });

  const command = parseCFODataCommand(message, accounts);
  const needsConfirmation = command.intent !== "UNKNOWN" && command.missingFields.length === 0;

  return NextResponse.json({
    command,
    needsConfirmation,
    preview: needsConfirmation
      ? buildPreview(command)
      : command.clarificationQuestion
        ? { type: "clarification", question: command.clarificationQuestion }
        : null,
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
