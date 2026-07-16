import type { DocumentClassification, UploadedFinancialDocumentType } from "./types";

type Signal = { pattern: RegExp; weight: number; reason: string };

const CHECKING_SIGNALS: Signal[] = [
  { pattern: /\bchecking\b/i, weight: 4, reason: "checking label" },
  { pattern: /\bavailable balance\b/i, weight: 2, reason: "available balance" },
  { pattern: /\bcurrent balance\b/i, weight: 2, reason: "current balance" },
  { pattern: /\bpending (?:transactions|deposits|withdrawals)\b/i, weight: 2, reason: "pending activity" },
  { pattern: /\baccount ending\b/i, weight: 2, reason: "account ending" },
  { pattern: /\brouting\b/i, weight: 1, reason: "routing info" },
];

const SAVINGS_SIGNALS: Signal[] = [
  { pattern: /\bsavings\b/i, weight: 4, reason: "savings label" },
  { pattern: /\b(?:deposit|withdrawal)s?\b/i, weight: 1, reason: "deposit/withdrawal" },
  { pattern: /\bcurrent balance\b/i, weight: 2, reason: "current balance" },
];

const MONEY_MARKET_SIGNALS: Signal[] = [
  { pattern: /\bmoney market\b/i, weight: 5, reason: "money market label" },
  { pattern: /\bcurrent balance\b/i, weight: 2, reason: "current balance" },
];

const CREDIT_SIGNALS: Signal[] = [
  { pattern: /\bcredit card\b/i, weight: 4, reason: "credit card label" },
  { pattern: /\bstatement balance\b/i, weight: 3, reason: "statement balance" },
  { pattern: /\bavailable credit\b/i, weight: 3, reason: "available credit" },
  { pattern: /\bcredit limit\b/i, weight: 3, reason: "credit limit" },
  { pattern: /\bminimum payment\b/i, weight: 2, reason: "minimum payment" },
  { pattern: /\bpayment due\b/i, weight: 2, reason: "payment due" },
  { pattern: /\bstatement closing\b/i, weight: 2, reason: "statement closing" },
  { pattern: /\b(?:apr|annual percentage rate)\b/i, weight: 2, reason: "APR" },
  { pattern: /\b(?:recent|pending) charges?\b/i, weight: 2, reason: "charges" },
];

const LOAN_SIGNALS: Signal[] = [
  { pattern: /\bloan balance\b/i, weight: 4, reason: "loan balance" },
  { pattern: /\bprincipal balance\b/i, weight: 3, reason: "principal balance" },
  { pattern: /\bmonthly payment\b/i, weight: 2, reason: "monthly payment" },
  { pattern: /\binterest rate\b/i, weight: 2, reason: "interest rate" },
  { pattern: /\bpayoff amount\b/i, weight: 3, reason: "payoff amount" },
  { pattern: /\bmaturity date\b/i, weight: 2, reason: "maturity date" },
  { pattern: /\bmortgage\b/i, weight: 3, reason: "mortgage" },
  { pattern: /\bauto loan\b/i, weight: 3, reason: "auto loan" },
];

const STATEMENT_SIGNALS: Signal[] = [
  { pattern: /\btransaction(?:s)?\b/i, weight: 2, reason: "transactions list" },
  { pattern: /\bstatement period\b/i, weight: 3, reason: "statement period" },
  { pattern: /\bactivity summary\b/i, weight: 2, reason: "activity summary" },
  { pattern: /\bposted date\b/i, weight: 1, reason: "posted date" },
];

function scoreSignals(text: string, signals: Signal[]): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  for (const signal of signals) {
    if (signal.pattern.test(text)) {
      score += signal.weight;
      reasons.push(signal.reason);
    }
  }
  return { score, reasons };
}

const ALL_TYPES: UploadedFinancialDocumentType[] = [
  "CHECKING",
  "SAVINGS",
  "MONEY_MARKET",
  "CREDIT_CARD",
  "LOAN",
  "TRANSACTION_STATEMENT",
  "UNKNOWN",
];

export function classifyFinancialDocument(rawText: string): DocumentClassification {
  const checking = scoreSignals(rawText, CHECKING_SIGNALS);
  const savings = scoreSignals(rawText, SAVINGS_SIGNALS);
  const moneyMarket = scoreSignals(rawText, MONEY_MARKET_SIGNALS);
  const credit = scoreSignals(rawText, CREDIT_SIGNALS);
  const loan = scoreSignals(rawText, LOAN_SIGNALS);
  const statement = scoreSignals(rawText, STATEMENT_SIGNALS);

  const scores: Record<UploadedFinancialDocumentType, number> = {
    CHECKING: checking.score,
    SAVINGS: savings.score,
    MONEY_MARKET: moneyMarket.score,
    CREDIT_CARD: credit.score,
    LOAN: loan.score,
    TRANSACTION_STATEMENT: statement.score,
    UNKNOWN: 0,
  };

  const ranked = (Object.entries(scores) as [UploadedFinancialDocumentType, number][])
    .filter(([type]) => type !== "UNKNOWN")
    .sort((a, b) => b[1] - a[1]);

  const [topType, topScore] = ranked[0] ?? ["UNKNOWN", 0];
  const [, secondScore] = ranked[1] ?? ["UNKNOWN", 0];

  let type: UploadedFinancialDocumentType = topScore >= 2 ? topType : "UNKNOWN";
  let reasons: string[] = [];

  if (type === "CHECKING") reasons = checking.reasons;
  if (type === "SAVINGS") reasons = savings.reasons;
  if (type === "MONEY_MARKET") reasons = moneyMarket.reasons;
  if (type === "CREDIT_CARD") reasons = credit.reasons;
  if (type === "LOAN") reasons = loan.reasons;
  if (type === "TRANSACTION_STATEMENT") reasons = statement.reasons;

  if (topScore > 0 && topScore === secondScore) {
    type = "UNKNOWN";
    reasons = ["ambiguous classification — multiple document types scored equally"];
  }

  const confidence = topScore === 0 ? 0 : Math.min(0.95, 0.45 + topScore * 0.08);

  return { type, confidence, reasons, scores };
}

export function accountTypeForDocument(documentType: UploadedFinancialDocumentType): string | null {
  switch (documentType) {
    case "CHECKING":
      return "CHECKING";
    case "SAVINGS":
      return "SAVINGS";
    case "MONEY_MARKET":
      return "MONEY_MARKET";
    case "CREDIT_CARD":
      return "CREDIT_CARD";
    case "LOAN":
      return "PERSONAL_LOAN";
    case "TRANSACTION_STATEMENT":
      return null;
    default:
      return null;
  }
}

export { ALL_TYPES as DOCUMENT_CLASSIFICATION_TYPES };
