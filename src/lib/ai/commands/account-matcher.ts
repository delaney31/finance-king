import type { FinancialAccount, BusinessEntity } from "@prisma/client";
import type { AccountAlias } from "@/lib/accounts/types";
import {
  resolveAccountReference,
  formatClarificationQuestion,
  formatDisplayName,
} from "@/lib/accounts/resolution";
import { toResolutionAccount } from "@/lib/accounts/alias-service";

type AccountWithEntity = FinancialAccount & { businessEntity?: BusinessEntity | null };

export interface AccountMatchResult {
  account?: FinancialAccount;
  candidates?: FinancialAccount[];
  ambiguous: boolean;
  clarificationQuestion?: string;
  resolutionCandidates?: Array<{
    accountId: string;
    displayName: string;
    score: number;
  }>;
  matchedPhrase?: string;
}

export function matchAccount(
  accounts: AccountWithEntity[],
  query: {
    accountId?: string;
    accountName?: string;
    institution?: string;
    lastFour?: string;
  },
  aliases: AccountAlias[] = []
): AccountMatchResult {
  if (query.accountId) {
    const account = accounts.find((a) => a.id === query.accountId);
    return { account, ambiguous: false };
  }

  if (query.lastFour) {
    const matches = accounts.filter((a) => a.accountLastFour === query.lastFour);
    if (matches.length === 1) return { account: matches[0], ambiguous: false };
    if (matches.length > 1) {
      return {
        candidates: matches,
        ambiguous: true,
        clarificationQuestion: formatAmbiguityQuestion(matches),
      };
    }
  }

  const phrase = query.accountName ?? query.institution;
  if (!phrase) {
    return { ambiguous: false };
  }

  const resolutionAccounts = accounts.map((a) => toResolutionAccount(a));

  const result = resolveAccountReference(phrase, resolutionAccounts, aliases);

  if (result.resolvedAccountId && !result.requiresClarification) {
    const account = accounts.find((a) => a.id === result.resolvedAccountId);
    return {
      account,
      ambiguous: false,
      matchedPhrase: phrase,
    };
  }

  if (result.candidates.length > 0) {
    const candidateAccounts = result.candidates
      .map((c) => accounts.find((a) => a.id === c.accountId))
      .filter((a): a is FinancialAccount => !!a);

    return {
      candidates: candidateAccounts,
      ambiguous: true,
      clarificationQuestion:
        result.clarificationQuestion ?? formatClarificationQuestion(result.candidates),
      resolutionCandidates: result.candidates.map((c) => ({
        accountId: c.accountId,
        displayName: c.displayName,
        score: c.score,
      })),
      matchedPhrase: phrase,
    };
  }

  return { ambiguous: false };
}

export function formatAmbiguityQuestion(candidates: AccountWithEntity[]): string {
  const list = candidates.map((a) => formatDisplayName(toResolutionAccount(a))).join(" or ");
  return `Which account did you mean: ${list}?`;
}
