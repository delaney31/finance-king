import type { FinancialAccount } from "@prisma/client";
import type { AccountAlias } from "@/lib/accounts/types";
import type { CFODataCommand } from "./schemas";
import { normalizeCfoMessage, stripPossessives } from "@/lib/nlp/normalize-message";
import { parseAmountFromText } from "@/lib/nlp/spoken-numbers";
import { parseSpokenDate } from "@/lib/nlp/spoken-dates";
import { matchAccount } from "./account-matcher";

export type ParseContext = {
  aliases?: AccountAlias[];
  timezone?: string;
  overrideAccountId?: string;
  overrideAccountPhrase?: string;
};

function parseAmount(text: string): number | undefined {
  return parseAmountFromText(text);
}

function extractAccountName(text: string): string | undefined {
  const patterns = [
    /update\s+(?:my\s+)?(.+?)\s+to\s+/i,
    /update\s+(?:the\s+)?(.+?)\s+to\s+/i,
    /update\s+(.+?)\s+balance/i,
    /(?:my|the)\s+(.+?)\s+(?:account\s+)?(?:has|balance)/i,
    /set\s+(.+?)\s+protected/i,
    /from\s+(.+?)\s+to\s+/i,
    /(?:move|transfer).+?\s+from\s+(.+?)\s+to\s+/i,
    /account:\s*(.+?)(?:\s|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return stripPossessives(m[1].trim());
  }
  return undefined;
}

function applyAccountMatch(
  command: CFODataCommand,
  match: ReturnType<typeof matchAccount>,
  field: "account" | "source" | "destination" = "account"
): CFODataCommand {
  if (match.ambiguous && match.candidates) {
    return {
      ...command,
      missingFields: [...new Set([...command.missingFields, field === "source" ? "sourceAccountId" : field === "destination" ? "destinationAccountId" : "accountId"])],
      clarificationQuestion: match.clarificationQuestion,
    };
  }
  return command;
}

export function parseCFODataCommand(
  message: string,
  accounts: FinancialAccount[],
  context: ParseContext = {}
): CFODataCommand {
  const normalized = normalizeCfoMessage(message, { timezone: context.timezone });
  const lower = normalized.toLowerCase().trim();
  const aliases = context.aliases ?? [];
  const amount = parseAmount(normalized);

  if (/transfer|move\s+\$?[\d,]+|move\s+\$/.test(lower)) {
    const transferMatch = normalized.match(
      /(?:transfer|move)\s+\$?\s*([\d,]+(?:\.\d{2})?)\s+(?:from\s+(.+?)\s+to\s+(.+?)(?:\.|$)|to\s+(.+?)\s+from\s+(.+?)(?:\.|$))/i
    );
    const amt = transferMatch ? Number(transferMatch[1].replace(/,/g, "")) : amount;
    const fromName = transferMatch?.[2] ?? transferMatch?.[5];
    const toName = transferMatch?.[3] ?? transferMatch?.[4];
    const sourceMatch = fromName
      ? matchAccount(accounts, { accountName: fromName, accountId: context.overrideAccountPhrase === fromName ? context.overrideAccountId : undefined }, aliases)
      : { ambiguous: false as const };
    const destMatch = toName
      ? matchAccount(accounts, { accountName: toName, accountId: context.overrideAccountPhrase === toName ? context.overrideAccountId : undefined }, aliases)
      : { ambiguous: false as const };

    if (sourceMatch.ambiguous) {
      return applyAccountMatch({
        intent: "TRANSFER_BETWEEN_ACCOUNTS",
        confidence: 0.7,
        summary: "Transfer between accounts",
        amount: amt,
        warnings: [],
        missingFields: ["sourceAccountId"],
      }, sourceMatch, "source");
    }
    if (destMatch.ambiguous) {
      return applyAccountMatch({
        intent: "TRANSFER_BETWEEN_ACCOUNTS",
        confidence: 0.7,
        summary: "Transfer between accounts",
        amount: amt,
        warnings: [],
        missingFields: ["destinationAccountId"],
      }, destMatch, "destination");
    }

    return {
      intent: "TRANSFER_BETWEEN_ACCOUNTS",
      confidence: fromName && toName && amt ? 0.9 : 0.5,
      summary: `Transfer ${amt ? `$${amt.toLocaleString()}` : "funds"} between accounts`,
      amount: amt,
      sourceAccountId: sourceMatch.account?.id,
      destinationAccountId: destMatch.account?.id,
      sourceAccountName: sourceMatch.account?.nickname ?? fromName,
      destinationAccountName: destMatch.account?.nickname ?? toName,
      warnings: ["Internal transfers are not counted as income or expense"],
      missingFields: !amt ? ["amount"] : !sourceMatch.account ? ["sourceAccountId"] : !destMatch.account ? ["destinationAccountId"] : [],
    };
  }

  if (/mark.*mortgage.*paid|mark.*bill.*paid|paid.*mortgage|mark the mortgage/i.test(lower)) {
    const billName = normalized.match(/mark\s+(?:the\s+)?(.+?)\s+paid/i)?.[1] ?? "mortgage";
    return {
      intent: "MARK_BILL_PAID",
      confidence: 0.85,
      summary: `Mark ${billName} as paid`,
      billName: billName.trim(),
      warnings: [],
      missingFields: [],
    };
  }

  if (/deposit arrived|income received|w-2|came in|record.*deposit|paycheck/i.test(lower)) {
    const incomeName = /w-2/i.test(normalized) ? "W-2" : "Income";
    const incomeAmount = amount ?? parseAmountFromText(normalized);
    const acctMatch = matchAccount(accounts, { accountName: "penfed checking" }, aliases);
    if (acctMatch.ambiguous && acctMatch.candidates) {
      return applyAccountMatch({
        intent: "MARK_INCOME_RECEIVED",
        confidence: 0.8,
        summary: "Record income deposit",
        amount: incomeAmount,
        incomeName,
        warnings: [],
        missingFields: ["accountId"],
      }, acctMatch);
    }
    return {
      intent: "MARK_INCOME_RECEIVED",
      confidence: incomeAmount ? 0.9 : 0.6,
      summary: `Record ${incomeName} deposit${incomeAmount ? ` of $${incomeAmount.toLocaleString()}` : ""}`,
      amount: incomeAmount,
      incomeName,
      accountId: acctMatch.account?.id,
      accountName: acctMatch.account?.nickname,
      transactionDate: new Date().toISOString().slice(0, 10),
      category: "Income",
      warnings: [],
      missingFields: incomeAmount ? [] : ["amount"],
    };
  }

  if (/protected amount|protected balance/i.test(lower)) {
    const accountName = extractAccountName(normalized);
    const match = accountName ? matchAccount(accounts, { accountName }, aliases) : { ambiguous: false as const };
    if (match.ambiguous) {
      return applyAccountMatch({
        intent: "UPDATE_PROTECTED_AMOUNT",
        confidence: 0.7,
        summary: "Update protected amount",
        protectedAmount: amount,
        warnings: [],
        missingFields: ["accountId"],
      }, match);
    }
    return {
      intent: "UPDATE_PROTECTED_AMOUNT",
      confidence: amount ? 0.9 : 0.5,
      summary: `Set protected amount${amount ? ` to $${amount.toLocaleString()}` : ""}`,
      accountId: match.account?.id,
      accountName: match.account?.nickname ?? accountName,
      protectedAmount: amount,
      warnings: [],
      missingFields: !amount ? ["protectedAmount"] : !match.account ? ["accountId"] : [],
    };
  }

  if (/update|balance is now|set.*to\s+\$|checking to|savings to|has\s+\$|account has/i.test(lower)) {
    const accountName =
      extractAccountName(normalized) ??
      normalized.match(/(penfed|wells|mercury|amex|truist|pacific luxe|rental)[^\d]*/i)?.[0];
    const match = accountName
      ? matchAccount(
          accounts,
          {
            accountName,
            accountId: context.overrideAccountId,
          },
          aliases
        )
      : { ambiguous: false as const };

    if (match.ambiguous) {
      return applyAccountMatch({
        intent: "UPDATE_ACCOUNT_BALANCE",
        confidence: 0.7,
        summary: "Update account balance",
        amount,
        warnings: [],
        missingFields: ["accountId"],
      }, match);
    }

    const acct = match.account;
    return {
      intent: "UPDATE_ACCOUNT_BALANCE",
      confidence: acct && amount != null ? 0.95 : 0.5,
      summary: acct
        ? `Update ${acct.nickname} to ${amount != null ? `$${amount.toLocaleString()}` : "new balance"}`
        : "Update account balance",
      accountId: acct?.id,
      accountName: acct?.nickname ?? accountName,
      amount,
      previousAmount: acct ? Number(acct.currentBalance) : undefined,
      warnings: [],
      missingFields: [
        ...(amount == null ? ["amount"] : []),
        ...(!acct ? ["accountId"] : []),
      ],
    };
  }

  if (/add.*credit card|new.*credit card/i.test(lower)) {
    const limit = normalized.match(/limit\s*(?:of\s*)?\$?\s*([\d,]+)/i);
    const balance = normalized.match(/balance\s*(?:of\s*)?\$?\s*([\d,]+)/i);
    return {
      intent: "CREATE_CREDIT_CARD",
      confidence: 0.7,
      summary: "Add new credit card",
      accountName: extractAccountName(normalized),
      creditLimit: limit ? Number(limit[1].replace(/,/g, "")) : undefined,
      statementBalance: balance ? Number(balance[1].replace(/,/g, "")) : amount,
      warnings: [],
      missingFields: [],
    };
  }

  if (/due date|payment due/i.test(lower)) {
    const dateMatch = normalized.match(/(\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})/i);
    return {
      intent: "UPDATE_BILL",
      confidence: 0.75,
      summary: "Update bill due date",
      billName: extractAccountName(normalized),
      dueDate: dateMatch?.[1],
      warnings: [],
      missingFields: dateMatch ? [] : ["dueDate"],
    };
  }

  if (/delayed until|income.*delayed|payment is delayed/i.test(lower)) {
    const dateMatch = normalized.match(/until\s+(.+?)(?:\.|$)/i);
    const dueDate = dateMatch?.[1] ? parseSpokenDate(dateMatch[1], context.timezone ?? undefined) ?? dateMatch[1] : undefined;
    return {
      intent: "UPDATE_INCOME_DATE",
      confidence: 0.8,
      summary: "Update income date",
      incomeName: /contract/i.test(normalized) ? "Contract" : extractAccountName(normalized),
      dueDate,
      warnings: ["Projected income is not spendable until cleared"],
      missingFields: dueDate ? [] : ["dueDate"],
    };
  }

  return {
    intent: "UNKNOWN",
    confidence: 0,
    summary: "Could not parse a financial update from this message",
    warnings: [],
    missingFields: ["intent"],
  };
}

export function isUpdateIntent(command: CFODataCommand): boolean {
  return command.intent !== "UNKNOWN" && command.missingFields.length === 0;
}
