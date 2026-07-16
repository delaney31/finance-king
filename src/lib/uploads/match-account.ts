import { createHash } from "crypto";
import type { AccountMatchCandidate, AccountMatchResult, ExtractedFinancialData } from "./types";
import { accountTypeForDocument } from "./classify-document";
import { isAccountCompatibleWithDocument } from "./document-types";

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

function normalizeInstitution(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function scoreAccountMatch(
  extracted: Pick<ExtractedFinancialData, "institution" | "accountLastFour" | "documentType">,
  account: MatchableAccount
): AccountMatchCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (extracted.documentType !== "UNKNOWN" && extracted.documentType !== "TRANSACTION_STATEMENT") {
    if (!isAccountCompatibleWithDocument(extracted.documentType, account.accountType)) {
      return {
        accountId: account.id,
        nickname: account.nickname,
        institution: account.institution,
        accountType: account.accountType,
        accountLastFour: account.accountLastFour,
        score: -10,
        reasons: ["account type incompatible"],
      };
    }
  }

  if (extracted.institution) {
    const instA = normalizeInstitution(extracted.institution);
    const instB = normalizeInstitution(account.institution);
    if (instA && instB && (instA.includes(instB) || instB.includes(instA))) {
      score += 2;
      reasons.push("institution match");
    }
  }

  if (
    extracted.documentType === "UNKNOWN" ||
    isAccountCompatibleWithDocument(extracted.documentType, account.accountType) ||
    extracted.documentType === "TRANSACTION_STATEMENT"
  ) {
    score += 3;
    reasons.push("account type compatible");
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
  const eligibleAccounts =
    extracted.documentType === "UNKNOWN"
      ? accounts
      : accounts.filter((a) => isAccountCompatibleWithDocument(extracted.documentType, a.accountType));

  const candidates = eligibleAccounts
    .map((account) => scoreAccountMatch(extracted, account))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const institutionMatches = extracted.institution
    ? eligibleAccounts.filter((a) => {
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
    top.score - (candidates[1]?.score ?? 0) < 2;

  return {
    accountId: top && top.score >= 6 && !requiresUserConfirmation ? top.accountId : null,
    score: top?.score ?? 0,
    reasons: top?.reasons ?? ["no confident account match"],
    requiresUserConfirmation,
    candidates: candidates.slice(0, 8),
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
