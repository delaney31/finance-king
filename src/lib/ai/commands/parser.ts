import type { FinancialAccount } from "@prisma/client";
import type { CFODataCommand } from "./schemas";
import { formatAmbiguityQuestion, matchAccount } from "./account-matcher";

function parseAmount(text: string): number | undefined {
  const m = text.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
  if (!m) return undefined;
  return Number(m[1].replace(/,/g, ""));
}

function extractAccountName(text: string): string | undefined {
  const patterns = [
    /update\s+(.+?)\s+to\s+/i,
    /update\s+(.+?)\s+balance/i,
    /my\s+(.+?)\s+balance/i,
    /set\s+(.+?)\s+protected/i,
    /from\s+(.+?)\s+to\s+/i,
    /account:\s*(.+?)(?:\s|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return undefined;
}

export function parseCFODataCommand(
  message: string,
  accounts: FinancialAccount[]
): CFODataCommand {
  const lower = message.toLowerCase().trim();
  const amount = parseAmount(message);

  if (/transfer|move\s+\$?[\d,]+/.test(lower)) {
    const transferMatch = message.match(
      /(?:transfer|move)\s+\$?\s*([\d,]+(?:\.\d{2})?)\s+(?:from\s+(.+?)\s+to\s+(.+?)(?:\.|$)|to\s+(.+?)\s+from\s+(.+?)(?:\.|$))/i
    );
    const amt = transferMatch ? Number(transferMatch[1].replace(/,/g, "")) : amount;
    const fromName = transferMatch?.[2] ?? transferMatch?.[5];
    const toName = transferMatch?.[3] ?? transferMatch?.[4];
    const sourceMatch = fromName ? matchAccount(accounts, { accountName: fromName }) : { ambiguous: false };
    const destMatch = toName ? matchAccount(accounts, { accountName: toName }) : { ambiguous: false };

    if (sourceMatch.ambiguous && sourceMatch.candidates) {
      return {
        intent: "TRANSFER_BETWEEN_ACCOUNTS",
        confidence: 0.7,
        summary: "Transfer between accounts",
        amount: amt,
        warnings: [],
        missingFields: ["sourceAccountId"],
        clarificationQuestion: formatAmbiguityQuestion(sourceMatch.candidates),
      };
    }
    if (destMatch.ambiguous && destMatch.candidates) {
      return {
        intent: "TRANSFER_BETWEEN_ACCOUNTS",
        confidence: 0.7,
        summary: "Transfer between accounts",
        amount: amt,
        warnings: [],
        missingFields: ["destinationAccountId"],
        clarificationQuestion: formatAmbiguityQuestion(destMatch.candidates),
      };
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

  if (/mark.*mortgage.*paid|mark.*bill.*paid|paid.*mortgage/i.test(lower)) {
    const billName = message.match(/mark\s+(?:the\s+)?(.+?)\s+paid/i)?.[1] ?? "mortgage";
    return {
      intent: "MARK_BILL_PAID",
      confidence: 0.85,
      summary: `Mark ${billName} as paid`,
      billName,
      warnings: [],
      missingFields: [],
    };
  }

  if (/deposit arrived|income received|w-2.*cleared|record.*deposit/i.test(lower)) {
    const incomeName = /w-2/i.test(message) ? "W-2" : extractAccountName(message) ?? "Income";
    const accountName = extractAccountName(message);
    const acctMatch = accountName ? matchAccount(accounts, { accountName }) : matchAccount(accounts, { accountName: "checking" });
    if (acctMatch.ambiguous && acctMatch.candidates) {
      return {
        intent: "MARK_INCOME_RECEIVED",
        confidence: 0.8,
        summary: "Record income deposit",
        amount,
        warnings: [],
        missingFields: ["accountId"],
        clarificationQuestion: formatAmbiguityQuestion(acctMatch.candidates),
      };
    }
    return {
      intent: "MARK_INCOME_RECEIVED",
      confidence: amount ? 0.9 : 0.6,
      summary: `Record ${incomeName} deposit${amount ? ` of $${amount.toLocaleString()}` : ""}`,
      amount,
      incomeName,
      accountId: acctMatch.account?.id,
      accountName: acctMatch.account?.nickname,
      transactionDate: new Date().toISOString().slice(0, 10),
      category: "Income",
      warnings: [],
      missingFields: amount ? [] : ["amount"],
    };
  }

  if (/protected amount|protected balance/i.test(lower)) {
    const accountName = extractAccountName(message);
    const match = accountName ? matchAccount(accounts, { accountName }) : { ambiguous: false };
    if (match.ambiguous && match.candidates) {
      return {
        intent: "UPDATE_PROTECTED_AMOUNT",
        confidence: 0.7,
        summary: "Update protected amount",
        protectedAmount: amount,
        warnings: [],
        missingFields: ["accountId"],
        clarificationQuestion: formatAmbiguityQuestion(match.candidates),
      };
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

  if (/update|balance is now|set.*to\s+\$|checking to|savings to/i.test(lower)) {
    const accountName = extractAccountName(message) ?? message.match(/(penfed|wells|mercury|amex|truist)[^\d]*/i)?.[0];
    const match = accountName ? matchAccount(accounts, { accountName }) : { ambiguous: false };

    if (match.ambiguous && match.candidates) {
      return {
        intent: "UPDATE_ACCOUNT_BALANCE",
        confidence: 0.7,
        summary: "Update account balance",
        amount,
        warnings: [],
        missingFields: ["accountId"],
        clarificationQuestion: formatAmbiguityQuestion(match.candidates),
      };
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
    const limit = message.match(/limit\s*(?:of\s*)?\$?\s*([\d,]+)/i);
    const balance = message.match(/balance\s*(?:of\s*)?\$?\s*([\d,]+)/i);
    return {
      intent: "CREATE_CREDIT_CARD",
      confidence: 0.7,
      summary: "Add new credit card",
      accountName: extractAccountName(message),
      creditLimit: limit ? Number(limit[1].replace(/,/g, "")) : undefined,
      statementBalance: balance ? Number(balance[1].replace(/,/g, "")) : amount,
      warnings: [],
      missingFields: [],
    };
  }

  if (/due date|payment due/i.test(lower)) {
    const dateMatch = message.match(/(\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})/i);
    return {
      intent: "UPDATE_BILL",
      confidence: 0.75,
      summary: "Update bill due date",
      billName: extractAccountName(message),
      dueDate: dateMatch?.[1],
      warnings: [],
      missingFields: dateMatch ? [] : ["dueDate"],
    };
  }

  if (/delayed until|income.*delayed/i.test(lower)) {
    const dateMatch = message.match(/until\s+(.+?)(?:\.|$)/i);
    return {
      intent: "UPDATE_INCOME_DATE",
      confidence: 0.8,
      summary: "Update income date",
      incomeName: extractAccountName(message),
      dueDate: dateMatch?.[1],
      warnings: ["Projected income is not spendable until cleared"],
      missingFields: dateMatch ? [] : ["dueDate"],
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
