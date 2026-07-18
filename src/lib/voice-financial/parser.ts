import type { FinancialAccount } from "@prisma/client";
import type { BusinessEntity } from "@prisma/client";
import type { AccountAlias } from "@/lib/accounts/types";
import { matchAccount } from "@/lib/ai/commands/account-matcher";
import { normalizeCfoMessage, stripPossessives } from "@/lib/nlp/normalize-message";
import { parseAmountFromText } from "@/lib/nlp/spoken-numbers";
import { parseSpokenDate } from "@/lib/nlp/spoken-dates";
import { matchPayeeFromList } from "./payee-service";
import type { VoiceFinancialCommand } from "./schemas";

type AccountWithEntity = FinancialAccount & { businessEntity?: BusinessEntity | null };

export type VoiceParseContext = {
  aliases?: AccountAlias[];
  timezone?: string;
  contextAccountId?: string;
  contextAccountName?: string;
  payees?: Array<{ id: string; canonicalName: string; aliases: string[]; defaultCategory?: string | null }>;
  selectedAccountId?: string;
  selectedAccountPhrase?: string;
};

const CONTEXT_ACCOUNT_BOOST = 50;

function extractFromAccount(text: string): string | undefined {
  const patterns = [
    /\bfrom\s+(?:my\s+)?(.+?)(?:\s+account)?(?:\s+for\b|\s+on\b|\s+yesterday|\s+last\b|\s+today|\.|$)/i,
    /\bfrom\s+(?:my\s+)?(.+?)$/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return stripPossessives(m[1].trim());
  }
  return undefined;
}

function extractToAccount(text: string): string | undefined {
  const patterns = [
    /\b(?:into|to|in)\s+(.+?)(?:\s+account)?(?:\s+for\b|\.|$)/i,
    /\btransfer\s+.+\s+to\s+(.+?)(?:\.|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const candidate = stripPossessives(m[1].trim());
      if (!/^\$?[\d,]+/.test(candidate) && !/^(google|state farm|victor|bridgecrest|nobu)/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

function extractPayee(text: string): string | undefined {
  const patterns = [
    /\bpaid\s+(?:the\s+)?(.+?)\s+\$[\d,]+/i,
    /\bpaid\s+(?:the\s+)?(.+?)\s+(?:from|for\b)/i,
    /\bpaid\s+\$?[\d,]+\s+to\s+(.+?)(?:\s+from|\s+for\b|\.|$)/i,
    /\bto\s+(.+?)\s+from\b/i,
    /\bto\s+(.+?)(?:\s+for\b|\.|$)/i,
    /\bat\s+(.+?)(?:\s+from|\s+yesterday|\.|$)/i,
    /\bcharged\s+(?:me\s+)?\$?[\d,]+\s+(?:at|from)\s+(.+?)(?:\.|$)/i,
    /\bspent\s+\$?[\d,]+\s+(?:at|on)\s+(.+?)(?:\s+from|\.|$)/i,
    /\bmark\s+(?:the\s+)?(.+?)\s+paid/i,
    /(.+?)\s+(?:took|charged)\s+(?:me\s+)?\$?[\d,]+/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      let name = stripPossessives(m[1].trim());
      name = name.replace(/\b(for|from|on|at)\b.*$/i, "").trim();
      if (name && !/^\$?[\d,]+$/.test(name) && name.length > 1) return name;
    }
  }
  return undefined;
}

function extractCategory(text: string): string | undefined {
  const m = text.match(/\bfor\s+(advertising|insurance|dining|maintenance|ads|gas|groceries)\b/i);
  if (m) {
    const map: Record<string, string> = {
      ads: "Advertising",
      advertising: "Advertising",
      insurance: "Insurance",
      dining: "Dining",
      maintenance: "Fleet maintenance",
    };
    return map[m[1].toLowerCase()] ?? m[1];
  }
  return undefined;
}

function detectStatus(text: string): "CLEARED" | "PENDING" | "SCHEDULED" {
  if (/\bpending\b/i.test(text)) return "PENDING";
  if (/\bschedul/i.test(text)) return "SCHEDULED";
  return "CLEARED";
}

function detectDate(text: string, timezone?: string): string {
  if (/\byesterday\b|\blast night\b/i.test(text)) {
    const d = parseSpokenDate("yesterday", timezone);
    if (d) return d;
  }
  if (/\btomorrow\b/i.test(text)) {
    const d = parseSpokenDate("tomorrow", timezone);
    if (d) return d;
  }
  const untilMatch = text.match(/\b(?:on|for)\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|\w+day)\b/i);
  if (untilMatch) {
    const d = parseSpokenDate(untilMatch[1], timezone);
    if (d) return d;
  }
  return new Date().toISOString().slice(0, 10);
}

function resolveAccount(
  accounts: AccountWithEntity[],
  phrase: string | undefined,
  aliases: AccountAlias[],
  context?: VoiceParseContext,
  field?: "source" | "destination"
): {
  accountId?: string;
  reference?: string;
  ambiguous?: boolean;
  clarificationQuestion?: string;
  candidates?: Array<{ accountId: string; displayName: string; score: number }>;
} {
  if (!phrase && context?.contextAccountId && field === "source") {
    return { accountId: context.contextAccountId, reference: context.contextAccountName };
  }
  if (!phrase) return {};

  const overrideId =
    context?.selectedAccountPhrase === phrase ? context.selectedAccountId : undefined;

  const match = matchAccount(
    accounts,
    { accountName: phrase, accountId: overrideId },
    aliases
  );

  if (match.ambiguous) {
    return {
      ambiguous: true,
      clarificationQuestion: match.clarificationQuestion,
      candidates: match.resolutionCandidates,
      reference: phrase,
    };
  }

  if (match.account) {
    let accountId = match.account.id;
    if (
      context?.contextAccountId &&
      context.contextAccountId !== accountId &&
      field === "source" &&
      phrase !== context.contextAccountName
    ) {
      // explicit override — caller adds warning
    }
    if (
      context?.contextAccountId &&
      !phrase &&
      field === "source"
    ) {
      accountId = context.contextAccountId;
    }
    return { accountId, reference: phrase };
  }

  if (context?.contextAccountId && field === "source") {
    return { accountId: context.contextAccountId, reference: context.contextAccountName };
  }

  return { reference: phrase };
}

export function parseVoiceFinancialCommand(
  transcript: string,
  accounts: AccountWithEntity[],
  context: VoiceParseContext = {}
): VoiceFinancialCommand {
  const normalized = normalizeCfoMessage(transcript, { timezone: context.timezone });
  const lower = normalized.toLowerCase();
  const amount = parseAmountFromText(normalized);
  const aliases = context.aliases ?? [];
  const payees = context.payees ?? [];
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const status = detectStatus(normalized);
  const transactionDate = detectDate(normalized, context.timezone);
  const category = extractCategory(normalized);

  const base: VoiceFinancialCommand = {
    intent: "UNKNOWN",
    confidence: 0,
    currency: "USD",
    missingFields,
    warnings,
    transcript,
    status,
    transactionDate,
    category,
  };

  // Transfer
  if (/\btransfer\b|\bmove\b|\bmoved\b/.test(lower) && (amount != null || /\$/.test(normalized))) {
    const transferMatch = normalized.match(
      /(?:transfer|move|moved)\s+\$?\s*([\d,]+(?:\.\d{2})?)?\s*(?:from\s+(.+?)\s+to\s+(.+?)(?:\.|$))?/i
    );
    const amt = transferMatch?.[1] ? Number(transferMatch[1].replace(/,/g, "")) : amount;
    const fromRef = transferMatch?.[2] ?? extractFromAccount(normalized);
    const toRef = transferMatch?.[3] ?? extractToAccount(normalized);

    const source = resolveAccount(accounts, fromRef, aliases, context, "source");
    const dest = resolveAccount(accounts, toRef, aliases, context, "destination");

    if (source.ambiguous) {
      return {
        ...base,
        intent: "RECORD_TRANSFER",
        confidence: 0.7,
        amount: amt,
        missingFields: ["sourceAccountId"],
        clarificationQuestion: source.clarificationQuestion,
      };
    }
    if (dest.ambiguous) {
      return {
        ...base,
        intent: "RECORD_TRANSFER",
        confidence: 0.7,
        amount: amt,
        sourceAccountId: source.accountId,
        missingFields: ["destinationAccountId"],
        clarificationQuestion: dest.clarificationQuestion,
      };
    }

    return {
      ...base,
      intent: "RECORD_TRANSFER",
      confidence: amt && source.accountId && dest.accountId ? 0.95 : 0.6,
      amount: amt,
      sourceAccountId: source.accountId,
      sourceAccountReference: source.reference,
      destinationAccountId: dest.accountId,
      destinationAccountReference: dest.reference,
      missingFields: [
        ...(amt == null ? ["amount"] : []),
        ...(!source.accountId ? ["sourceAccountId"] : []),
        ...(!dest.accountId ? ["destinationAccountId"] : []),
      ],
      warnings: ["Internal transfers are not counted as income or expense"],
    };
  }

  // Balance update
  if (
    !/\bpaid\b|\bspent\b|\bsent\b/.test(lower) &&
    (/\bbalance is now\b|\bupdate\b.+\bto\s+\$|\bmy\s+.+\s+balance\b/i.test(normalized) ||
      /^update\s+/i.test(normalized))
  ) {
    const isCredit = /\bamex\b|\bamerican express\b|\bcredit card\b/i.test(normalized);
    const accountRef =
      normalized.match(/update\s+(?:the\s+)?(.+?)\s+to\s+/i)?.[1] ??
      normalized.match(/(?:my\s+)?(.+?)\s+balance is now/i)?.[1] ??
      extractToAccount(normalized);

    const dest = resolveAccount(accounts, accountRef ? stripPossessives(accountRef) : undefined, aliases, context, "destination");

    if (dest.ambiguous) {
      return {
        ...base,
        intent: isCredit ? "UPDATE_CREDIT_CARD_BALANCE" : "UPDATE_ACCOUNT_BALANCE",
        confidence: 0.7,
        amount,
        missingFields: ["destinationAccountId"],
        clarificationQuestion: dest.clarificationQuestion,
      };
    }

    const acct = accounts.find((a) => a.id === dest.accountId);
    return {
      ...base,
      intent: isCredit ? "UPDATE_CREDIT_CARD_BALANCE" : "UPDATE_ACCOUNT_BALANCE",
      confidence: amount != null && dest.accountId ? 0.95 : 0.5,
      amount,
      destinationAccountId: dest.accountId ?? context.contextAccountId,
      destinationAccountReference: dest.reference,
      previousBalance: acct ? Number(acct.currentBalance) : undefined,
      projectedBalance: amount,
      missingFields: [
        ...(amount == null ? ["amount"] : []),
        ...(!dest.accountId && !context.contextAccountId ? ["destinationAccountId"] : []),
      ],
    };
  }

  // Mark bill paid
  if (/\bmark\b.+\bpaid\b|\bpaid the mortgage\b/i.test(lower)) {
    const payee = extractPayee(normalized) ?? "mortgage";
    return {
      ...base,
      intent: "MARK_BILL_PAID",
      confidence: 0.85,
      payeeName: payee,
      missingFields: [],
    };
  }

  // Income / deposit
  if (
    /\bcame in\b|\bdeposit\b|\bpaycheck\b|\bw-2\b|\btenant paid\b|\bpayment in\b|\bgot a\b.+\bpayment\b/i.test(
      lower
    )
  ) {
    const destRef = extractToAccount(normalized) ?? extractFromAccount(normalized);
    const dest = resolveAccount(accounts, destRef, aliases, context, "destination");
    const incomeName = /\bw-2\b|\bpaycheck\b/i.test(normalized) ? "W-2" : "Income";

    return {
      ...base,
      intent: "RECORD_INCOME",
      confidence: amount != null ? 0.9 : 0.6,
      amount,
      destinationAccountId: dest.accountId ?? context.contextAccountId,
      destinationAccountReference: dest.reference,
      description: incomeName,
      missingFields: [
        ...(amount == null ? ["amount"] : []),
        ...(!dest.accountId && !context.contextAccountId ? ["destinationAccountId"] : []),
      ],
    };
  }

  // Business expense (Pacific Luxe paid...)
  if (/\b(pacific luxe|rental business|jadessystems)\s+paid\b/i.test(lower)) {
    const payee = extractPayee(normalized);
    const payeeMatch = payee ? matchPayeeFromList(payee, payees) : null;
    const source = resolveAccount(
      accounts,
      normalized.match(/(pacific luxe|mercury|rental)/i)?.[0],
      aliases,
      context,
      "source"
    );

    return {
      ...base,
      intent: "RECORD_EXPENSE",
      confidence: 0.85,
      amount,
      sourceAccountId: source.accountId,
      payeeName: payeeMatch?.name ?? payee,
      category: category ?? payeeMatch?.category ?? "Advertising",
      ownershipScope: "BUSINESS",
      suggestedPayeeId: payeeMatch?.payeeId,
      isNewPayee: payeeMatch?.isNew,
      missingFields: [
        ...(amount == null ? ["amount"] : []),
        ...(!source.accountId ? ["sourceAccountId"] : []),
        ...(!payee ? ["payeeName"] : []),
      ],
    };
  }

  // Credit card charge
  if (/\bcharged\b.+\b(?:to\s+)?(?:amex|american express)\b/i.test(lower)) {
    const merchant = extractPayee(normalized);
    const dest = resolveAccount(accounts, "amex", aliases, context, "destination");
    return {
      ...base,
      intent: "RECORD_EXPENSE",
      confidence: 0.85,
      amount,
      destinationAccountId: dest.accountId,
      merchantName: merchant,
      category: category ?? "Uncategorized",
      missingFields: [...(amount == null ? ["amount"] : []), ...(!dest.accountId ? ["destinationAccountId"] : [])],
    };
  }

  // Credit card payment
  if (/\bpaid\b.+\b(?:toward|to)\s+(?:amex|american express)\b/i.test(lower)) {
    const sourceRef = extractFromAccount(normalized);
    const source = resolveAccount(accounts, sourceRef, aliases, context, "source");
    const dest = resolveAccount(accounts, "amex", aliases, context, "destination");
    return {
      ...base,
      intent: "RECORD_PAYMENT",
      confidence: 0.9,
      amount,
      sourceAccountId: source.accountId ?? context.contextAccountId,
      destinationAccountId: dest.accountId,
      payeeName: "American Express",
      category: "Credit card payment",
      missingFields: [
        ...(amount == null ? ["amount"] : []),
        ...(!source.accountId && !context.contextAccountId ? ["sourceAccountId"] : []),
        ...(!dest.accountId ? ["destinationAccountId"] : []),
      ],
    };
  }

  // Expense / payment — check before balance fallback
  if (
    /\bpaid\b|\bspent\b|\bsent\b|\btook\b|\bcharged\b/i.test(lower) ||
    (amount != null && /\bfrom\b/i.test(lower))
  ) {
    const payee = extractPayee(normalized);
    const payeeMatch = payee ? matchPayeeFromList(payee, payees) : null;
    const fromRef = extractFromAccount(normalized);
    const source = resolveAccount(accounts, fromRef, aliases, context, "source");

    let contextMismatch = false;
    if (
      context?.contextAccountId &&
      source.accountId &&
      source.accountId !== context.contextAccountId &&
      fromRef
    ) {
      contextMismatch = true;
      warnings.push(
        `You started from ${context.contextAccountName ?? "this account"}, but I heard "from ${fromRef}." Use ${fromRef} instead?`
      );
    }

    const acct = accounts.find(
      (a) => a.id === (source.accountId ?? context.contextAccountId)
    );

    return {
      ...base,
      intent: /\bmortgage\b/i.test(payee ?? "") ? "RECORD_PAYMENT" : "RECORD_EXPENSE",
      confidence: amount != null && (source.accountId || context.contextAccountId) ? 0.9 : 0.6,
      amount,
      sourceAccountId: source.accountId ?? context.contextAccountId,
      sourceAccountReference: source.reference ?? context.contextAccountName,
      payeeName: payeeMatch?.name ?? payee,
      merchantName: payeeMatch?.name ?? payee,
      category: category ?? payeeMatch?.category,
      suggestedPayeeId: payeeMatch?.payeeId,
      isNewPayee: payeeMatch?.isNew,
      previousBalance: acct ? Number(acct.currentBalance) : undefined,
      projectedBalance:
        acct && amount != null ? Number(acct.currentBalance) - amount : undefined,
      contextAccountMismatch: contextMismatch,
      missingFields: [
        ...(amount == null ? ["amount"] : []),
        ...(!source.accountId && !context.contextAccountId ? ["sourceAccountId"] : []),
        ...(source.ambiguous ? ["sourceAccountId"] : []),
      ],
      clarificationQuestion: source.clarificationQuestion,
    };
  }

  // Scheduled / pending
  if (/\bpending\b|\bschedul/i.test(lower)) {
    const payee = extractPayee(normalized);
    return {
      ...base,
      intent: "SCHEDULE_TRANSACTION",
      confidence: 0.7,
      amount,
      payeeName: payee,
      sourceAccountId: context.contextAccountId,
      status: "PENDING",
      missingFields: [...(amount == null ? ["amount"] : [])],
    };
  }

  // Fallback: only if still unknown
  if (amount != null && context.contextAccountId) {
    const acct = accounts.find((a) => a.id === context.contextAccountId);
    return {
      ...base,
      intent: "UPDATE_ACCOUNT_BALANCE",
      confidence: 0.5,
      amount,
      destinationAccountId: context.contextAccountId,
      previousBalance: acct ? Number(acct.currentBalance) : undefined,
      projectedBalance: amount,
      missingFields: [],
    };
  }

  return {
    ...base,
    intent: "UNKNOWN",
    confidence: 0,
    missingFields: ["intent"],
    warnings: ["Could not understand this financial activity. Try rephrasing."],
  };
}

export { CONTEXT_ACCOUNT_BOOST };
