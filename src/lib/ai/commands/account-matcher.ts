import type { FinancialAccount } from "@prisma/client";

export interface AccountMatchResult {
  account?: FinancialAccount;
  candidates?: FinancialAccount[];
  ambiguous: boolean;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchAccount(
  accounts: FinancialAccount[],
  query: {
    accountId?: string;
    accountName?: string;
    institution?: string;
    lastFour?: string;
  }
): AccountMatchResult {
  if (query.accountId) {
    const account = accounts.find((a) => a.id === query.accountId);
    return { account, ambiguous: false };
  }

  const name = query.accountName ? normalize(query.accountName) : "";
  const inst = query.institution ? normalize(query.institution) : "";

  let candidates = accounts.filter((a) => {
    const nick = normalize(a.nickname);
    const institution = normalize(a.institution);
    if (name && (nick.includes(name) || name.includes(nick))) return true;
    if (inst && institution.includes(inst)) return true;
    if (query.lastFour && a.accountLastFour === query.lastFour) return true;
    return false;
  });

  if (name) {
    const exact = accounts.filter((a) => normalize(a.nickname) === name);
    if (exact.length === 1) return { account: exact[0], ambiguous: false };
    if (exact.length > 1) return { candidates: exact, ambiguous: true };
  }

  if (candidates.length === 1) return { account: candidates[0], ambiguous: false };
  if (candidates.length > 1) return { candidates, ambiguous: true };
  return { ambiguous: false };
}

export function formatAmbiguityQuestion(candidates: FinancialAccount[]): string {
  const list = candidates
    .map((a) => `${a.nickname}${a.accountLastFour ? ` ending ${a.accountLastFour}` : ""}`)
    .join(" or ");
  return `You have ${candidates.length} matching accounts. Which one should I update: ${list}?`;
}
