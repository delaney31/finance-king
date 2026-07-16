import { createHash } from "crypto";
import type { AccountMatchCandidate, AccountMatchResult, ExtractedFinancialData } from "./types";
import { accountTypeForDocument } from "./classify-document";

export interface MatchableAccount {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
  accountLastFour: string | null;
  designation: string;
  routingTag: string;
  businessEntityId: string | null;
}

const DEPOSIT_TYPES = new Set([
  "CHECKING",
  "SAVINGS",
  "MONEY_MARKET",
  "BUSINESS_CHECKING",
  "BUSINESS_SAVINGS",
  "JOINT_CHECKING",
  "JOINT_SAVINGS",
]);

const CREDIT_TYPES = new Set(["CREDIT_CARD"]);
const LOAN_TYPES = new Set(["VEHICLE_LOAN", "MORTGAGE", "PERSONAL_LOAN"]);

function normalizeInstitution(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function typesCompatible(documentType: ExtractedFinancialData["documentType"], accountType: string): boolean {
  if (documentType === "DEPOSIT_ACCOUNT") return DEPOSIT_TYPES.has(accountType);
  if (documentType === "CREDIT_CARD") return CREDIT_TYPES.has(accountType);
  if (documentType === "LOAN") return LOAN_TYPES.has(accountType);
  if (documentType === "TRANSACTION_STATEMENT") return true;
  return false;
}

export function scoreAccountMatch(
  extracted: Pick<ExtractedFinancialData, "institution" | "accountLastFour" | "documentType">,
  account: MatchableAccount
): AccountMatchCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (extracted.institution) {
    const instA = normalizeInstitution(extracted.institution);
    const instB = normalizeInstitution(account.institution);
    if (instA && instB && (instA.includes(instB) || instB.includes(instA))) {
      score += 2;
      reasons.push("institution match");
    }
  }

  if (typesCompatible(extracted.documentType, account.accountType)) {
    score += 3;
    reasons.push("account type compatible");
  } else if (extracted.documentType !== "TRANSACTION_STATEMENT" && extracted.documentType !== "UNKNOWN") {
    score -= 4;
    reasons.push("account type mismatch");
  }

  if (extracted.accountLastFour && account.accountLastFour) {
    if (extracted.accountLastFour === account.accountLastFour) {
      score += 5;
      reasons.push("last four digits match");
    } else {
      score -= 5;
      reasons.push("last four digits conflict");
    }
  }

  const expectedType = accountTypeForDocument(extracted.documentType);
  if (expectedType && account.accountType === expectedType) {
    score += 1;
    reasons.push("primary account type match");
  }

  return {
    accountId: account.id,
    nickname: account.nickname,
    institution: account.institution,
    accountType: account.accountType,
    accountLastFour: account.accountLastFour,
    score,
    reasons,
  };
}

export function matchExistingAccount(
  extracted: Pick<ExtractedFinancialData, "institution" | "accountLastFour" | "documentType">,
  accounts: MatchableAccount[]
): AccountMatchResult {
  const candidates = accounts
    .map((account) => scoreAccountMatch(extracted, account))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const institutionMatches = extracted.institution
    ? accounts.filter((a) => {
        const instA = normalizeInstitution(extracted.institution!);
        const instB = normalizeInstitution(a.institution);
        return instA.includes(instB) || instB.includes(instA);
      })
    : [];

  const top = candidates[0] ?? null;
  const requiresUserConfirmation =
    !top ||
    top.score < 6 ||
    (institutionMatches.length > 1 && !extracted.accountLastFour) ||
    (top.score - (candidates[1]?.score ?? 0)) < 2;

  return {
    accountId: top && top.score >= 6 && !requiresUserConfirmation ? top.accountId : null,
    score: top?.score ?? 0,
    reasons: top?.reasons ?? ["no confident account match"],
    requiresUserConfirmation,
    candidates: candidates.slice(0, 5),
  };
}

export function transactionFingerprint(input: {
  accountId: string;
  date?: string;
  amount: number;
  description: string;
}): string {
  const raw = `${input.accountId}|${input.date ?? ""}|${input.amount.toFixed(2)}|${input.description.trim().toLowerCase()}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function uploadContentHash(userId: string, fileHash: string): string {
  return createHash("sha256").update(`${userId}:${fileHash}`).digest("hex");
}
