import type {
  DocumentClassification,
  ExtractedFinancialData,
  ExtractedTransaction,
  TransactionClearanceStatus,
  UploadedFinancialDocumentType,
} from "./types";
import { classifyFinancialDocument } from "./classify-document";

function parseMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/[$,]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function field(value: string | undefined, confidence: number): { value: number; confidence: number } | undefined {
  if (!value) return undefined;
  const parsed = parseMoney(value);
  if (parsed === undefined) return undefined;
  return { value: parsed, confidence };
}

function extractLabelAmount(text: string, labels: RegExp[]): { value: number; confidence: number } | undefined {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label.source}[:\\s]*\\$?([\\d,]+\\.\\d{2})`, "i"));
    if (match) return { value: parseMoney(match[1])!, confidence: 0.78 };
  }
  return undefined;
}

function extractDate(text: string, labels: RegExp[]): string | undefined {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label.source}[:\\s]*(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\w+ \\d{1,2},? \\d{4})`, "i")
    );
    if (match) return match[1];
  }
  return undefined;
}

function extractInstitution(text: string): string | undefined {
  const patterns: [RegExp, string][] = [
    [/penfed|pentagon federal/i, "PenFed"],
    [/wells fargo/i, "Wells Fargo"],
    [/truist/i, "Truist"],
    [/mercury/i, "Mercury"],
    [/american express|amex/i, "American Express"],
    [/current/i, "Current"],
    [/chase/i, "Chase"],
    [/bank of america/i, "Bank of America"],
  ];
  for (const [pattern, name] of patterns) {
    if (pattern.test(text)) return name;
  }
  return undefined;
}

function extractLastFour(text: string): string | undefined {
  const patterns = [
    /(?:account|card|ending|•{4})\s*(?:in\s*)?(?:\*{4}\s*)?(\d{4})/i,
    /\*{4}\s*(\d{4})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

function inferTransactionStatus(line: string): TransactionClearanceStatus {
  if (/\bpending\b/i.test(line)) return "PENDING";
  if (/\bprojected\b/i.test(line)) return "PROJECTED";
  if (/\bcancel(?:led|ed)\b/i.test(line)) return "CANCELLED";
  return "CLEARED";
}

function extractTransactions(text: string): ExtractedTransaction[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions: ExtractedTransaction[] = [];

  for (const line of lines) {
    const amountMatch = line.match(/([+-]?\$?[\d,]+\.\d{2})/);
    if (!amountMatch) continue;
    const amount = parseMoney(amountMatch[1]);
    if (amount === undefined || Math.abs(amount) < 0.01) continue;

    const dateMatch = line.match(/(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/);
    const description = line
      .replace(amountMatch[0], "")
      .replace(dateMatch?.[0] ?? "", "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    if (!description || description.length < 3) continue;

    transactions.push({
      date: dateMatch?.[1],
      description,
      amount,
      status: inferTransactionStatus(line),
      confidence: 0.62,
    });
  }

  return transactions.slice(0, 50);
}

export function buildExtractedFinancialData(rawText: string): ExtractedFinancialData {
  const classification: DocumentClassification = classifyFinancialDocument(rawText);
  const institution = extractInstitution(rawText);
  const accountLastFour = extractLastFour(rawText);

  const currentBalance = extractLabelAmount(rawText, [
    /current balance/,
    /account balance/,
    /balance as of/,
  ]);
  const availableBalance = extractLabelAmount(rawText, [/available balance/, /available funds/]);
  const pendingBalance = extractLabelAmount(rawText, [/pending balance/, /pending transactions/]);
  const statementBalance = extractLabelAmount(rawText, [/statement balance/]);
  const creditLimit = extractLabelAmount(rawText, [/credit limit/]);
  const availableCredit = extractLabelAmount(rawText, [/available credit/]);
  const minimumPayment = extractLabelAmount(rawText, [/minimum payment/, /payment due/]);
  const payoffAmount = extractLabelAmount(rawText, [/payoff amount/, /principal balance/, /loan balance/]);
  const aprMatch = rawText.match(/(?:apr|annual percentage rate)[:\s]*([\d.]+)\s*%/i);

  const fieldConfidence: Record<string, number> = {};
  if (institution) fieldConfidence.institution = 0.8;
  if (accountLastFour) fieldConfidence.accountLastFour = 0.8;
  if (currentBalance) fieldConfidence.currentBalance = currentBalance.confidence;
  if (availableBalance) fieldConfidence.availableBalance = availableBalance.confidence;
  if (pendingBalance) fieldConfidence.pendingBalance = pendingBalance.confidence;
  if (statementBalance) fieldConfidence.statementBalance = statementBalance.confidence;
  if (creditLimit) fieldConfidence.creditLimit = creditLimit.confidence;
  if (minimumPayment) fieldConfidence.minimumPayment = minimumPayment.confidence;

  let documentType: UploadedFinancialDocumentType = classification.type;
  if (documentType === "UNKNOWN" && statementBalance && creditLimit) {
    documentType = "CREDIT_CARD";
  } else if (documentType === "UNKNOWN" && availableBalance) {
    documentType = "CHECKING";
  }

  const transactions = extractTransactions(rawText);

  return {
    institution,
    accountLastFour,
    documentType,
    classification,
    currentBalance: currentBalance?.value ?? statementBalance?.value,
    availableBalance: availableBalance?.value,
    pendingBalance: pendingBalance?.value,
    statementBalance: statementBalance?.value,
    creditLimit: creditLimit?.value,
    availableCredit: availableCredit?.value,
    minimumPayment: minimumPayment?.value,
    paymentDueDate: extractDate(rawText, [/payment due/, /due date/]),
    statementDate: extractDate(rawText, [/statement date/, /statement period/]),
    statementCloseDate: extractDate(rawText, [/statement closing/, /closing date/]),
    apr: aprMatch ? Number.parseFloat(aprMatch[1]) : undefined,
    payoffAmount: payoffAmount?.value,
    transactions,
    fieldConfidence,
    rawText,
  };
}
