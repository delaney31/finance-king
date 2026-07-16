import { classifyFinancialDocument } from "./classify-document";
import { buildExtractedFinancialData } from "./extract-fields";
import { matchExistingAccount, type MatchableAccount } from "./match-account";
import type {
  AccountMatchResult,
  DocumentClassification,
  ExtractedFinancialData,
  ExtractedTransaction,
} from "./types";

function emptyClassification(): DocumentClassification {
  return {
    type: "UNKNOWN",
    confidence: 0,
    reasons: ["extraction incomplete — manual review required"],
    scores: {
      DEPOSIT_ACCOUNT: 0,
      CREDIT_CARD: 0,
      LOAN: 0,
      TRANSACTION_STATEMENT: 0,
      UNKNOWN: 0,
    },
  };
}

function normalizeClassification(value: unknown): DocumentClassification {
  if (!value || typeof value !== "object") return emptyClassification();
  const record = value as Partial<DocumentClassification>;
  const type = record.type ?? "UNKNOWN";
  return {
    type,
    confidence: typeof record.confidence === "number" ? record.confidence : 0,
    reasons: Array.isArray(record.reasons) ? record.reasons : ["manual review required"],
    scores: record.scores ?? {
      DEPOSIT_ACCOUNT: 0,
      CREDIT_CARD: 0,
      LOAN: 0,
      TRANSACTION_STATEMENT: 0,
      UNKNOWN: 0,
    },
  };
}

export function createEmptyExtracted(rawText?: string | null): ExtractedFinancialData {
  const classification = rawText ? classifyFinancialDocument(rawText) : emptyClassification();
  return {
    documentType: classification.type === "UNKNOWN" ? "UNKNOWN" : classification.type,
    classification,
    transactions: [],
    fieldConfidence: {},
    rawText: rawText ?? undefined,
  };
}

/** Coerce legacy or partial OCR payloads into the current shape. */
export function normalizeExtractedData(
  data: unknown,
  rawText?: string | null
): ExtractedFinancialData {
  if (!data || typeof data !== "object") {
    return rawText ? buildExtractedFromLegacyOrText(data, rawText) : createEmptyExtracted(rawText);
  }

  const record = data as Record<string, unknown>;
  const transactions = Array.isArray(record.transactions)
    ? (record.transactions as ExtractedTransaction[])
    : [];

  const classification = normalizeClassification(record.classification);

  const documentType =
    typeof record.documentType === "string"
      ? (record.documentType as ExtractedFinancialData["documentType"])
      : classification.type;

  const legacyBalance = record.balance as { value?: string | number } | undefined;
  const currentBalance =
    typeof record.currentBalance === "number"
      ? record.currentBalance
      : legacyBalance?.value != null
        ? Number(legacyBalance.value)
        : undefined;

  return {
    institution: typeof record.institution === "string" ? record.institution : undefined,
    accountLastFour:
      typeof record.accountLastFour === "string" ? record.accountLastFour : undefined,
    documentType,
    classification: normalizeClassification(classification),
    currentBalance: Number.isFinite(currentBalance) ? currentBalance : undefined,
    availableBalance:
      typeof record.availableBalance === "number" ? record.availableBalance : undefined,
    pendingBalance:
      typeof record.pendingBalance === "number" ? record.pendingBalance : undefined,
    statementBalance:
      typeof record.statementBalance === "number" ? record.statementBalance : undefined,
    creditLimit: typeof record.creditLimit === "number" ? record.creditLimit : undefined,
    availableCredit:
      typeof record.availableCredit === "number" ? record.availableCredit : undefined,
    minimumPayment:
      typeof record.minimumPayment === "number" ? record.minimumPayment : undefined,
    paymentDueDate:
      typeof record.paymentDueDate === "string" ? record.paymentDueDate : undefined,
    statementDate:
      typeof record.statementDate === "string" ? record.statementDate : undefined,
    statementCloseDate:
      typeof record.statementCloseDate === "string" ? record.statementCloseDate : undefined,
    apr: typeof record.apr === "number" ? record.apr : undefined,
    payoffAmount: typeof record.payoffAmount === "number" ? record.payoffAmount : undefined,
    transactions,
    fieldConfidence:
      record.fieldConfidence && typeof record.fieldConfidence === "object"
        ? (record.fieldConfidence as Record<string, number>)
        : {},
    rawText: typeof record.rawText === "string" ? record.rawText : rawText ?? undefined,
  };
}

function buildExtractedFromLegacyOrText(_data: unknown, rawText: string): ExtractedFinancialData {
  if (rawText.trim()) {
    return buildExtractedFinancialData(rawText);
  }
  return createEmptyExtracted(rawText);
}

export function normalizeMatchResult(
  stored: unknown,
  extracted: Pick<ExtractedFinancialData, "institution" | "accountLastFour" | "documentType">,
  accounts: MatchableAccount[]
): AccountMatchResult {
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as AccountMatchResult).candidates)
  ) {
    const match = stored as AccountMatchResult;
    return {
      accountId: match.accountId ?? null,
      score: match.score ?? 0,
      reasons: match.reasons ?? [],
      requiresUserConfirmation: match.requiresUserConfirmation ?? true,
      candidates: match.candidates,
    };
  }
  return matchExistingAccount(extracted, accounts);
}
