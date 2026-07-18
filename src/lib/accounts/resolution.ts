import type {
  AccountAlias,
  AccountResolutionCandidate,
  AccountResolutionResult,
  ResolutionAccount,
} from "./types";
import { fuzzyScore, normalizeAlias } from "./normalize";
import { stripPossessives } from "@/lib/nlp/normalize-message";

const SCORE = {
  EXACT_ALIAS: 100,
  INSTITUTION_TYPE: 80,
  BUSINESS_ENTITY: 75,
  NICKNAME: 70,
  LAST_FOUR: 70,
  OWNERSHIP: 30,
  RECENT: 10,
} as const;

const CLARIFICATION_THRESHOLD = 60;
const CLOSE_SCORE_GAP = 15;

function accountTypeWords(type: string): string[] {
  return type.toLowerCase().replace(/_/g, " ").split(/\s+/);
}

function isIncompatibleAccountType(query: string, accountType: string): boolean {
  const q = normalizeAlias(query);
  if (/\bchecking\b/.test(q) && accountType === "CREDIT_CARD") return true;
  if (/\bsavings\b/.test(q) && accountType === "CREDIT_CARD") return true;
  if (/\bmortgage\b/.test(q) && !["MORTGAGE", "PERSONAL_LOAN"].includes(accountType)) {
    return !q.includes("account");
  }
  return false;
}

function scoreAccount(
  account: ResolutionAccount,
  query: string,
  aliases: AccountAlias[],
  recentAccountIds: string[]
): AccountResolutionCandidate {
  const q = normalizeAlias(stripPossessives(query));
  const reasons: string[] = [];
  const matchedAliases: string[] = [];
  let score = 0;

  if (!q) {
    return { accountId: account.id, displayName: account.nickname, score: 0, matchedAliases, reasons };
  }

  const accountAliases = aliases.filter((a) => a.financialAccountId === account.id);

  for (const alias of accountAliases) {
    if (alias.normalizedAlias === q) {
      let aliasScore = SCORE.EXACT_ALIAS;
      if (alias.source === "USER") aliasScore += 25;
      else if (alias.source === "AI_LEARNED") aliasScore += 15;
      score = Math.max(score, aliasScore);
      matchedAliases.push(alias.alias);
      reasons.push(`Exact alias: ${alias.alias} (${alias.source})`);
    } else {
      const fuzzy = fuzzyScore(alias.normalizedAlias, q);
      if (fuzzy >= 30) {
        score = Math.max(score, fuzzy);
        matchedAliases.push(alias.alias);
        reasons.push(`Fuzzy alias: ${alias.alias}`);
      }
    }
  }

  const nick = normalizeAlias(account.nickname);
  const inst = normalizeAlias(account.institution);

  if (nick === q || q === nick) {
    score = Math.max(score, SCORE.NICKNAME);
    reasons.push("Exact nickname");
  } else if (nick.includes(q) || q.includes(nick)) {
    score = Math.max(score, SCORE.NICKNAME - 10);
    reasons.push("Nickname match");
  }

  if (inst.includes(q) || q.includes(inst)) {
    const typeWords = accountTypeWords(account.accountType);
    const hasType = typeWords.some((t) => q.includes(t));
    if (hasType) {
      score = Math.max(score, SCORE.INSTITUTION_TYPE);
      reasons.push("Institution + account type");
    } else {
      score = Math.max(score, 45);
      reasons.push("Institution match");
    }
  }

  if (account.businessEntityName) {
    const entity = normalizeAlias(account.businessEntityName);
    if (q.includes(entity) || entity.includes(q)) {
      score = Math.max(score, SCORE.BUSINESS_ENTITY);
      reasons.push(`Business entity: ${account.businessEntityName}`);
    }
  }

  const lastFourMatch = q.match(/\b(\d{4})\b/);
  if (lastFourMatch && account.accountLastFour === lastFourMatch[1]) {
    score = Math.max(score, SCORE.LAST_FOUR);
    reasons.push(`Last four: ${account.accountLastFour}`);
  }

  if (account.designation === "BUSINESS" && /\bbusiness\b/.test(q)) {
    score += SCORE.OWNERSHIP;
    reasons.push("Business designation");
  }
  if (account.routingTag === "EMERGENCY" && /emergency/.test(q)) {
    score += SCORE.OWNERSHIP;
    reasons.push("Emergency routing");
  }

  if (recentAccountIds.includes(account.id)) {
    score += SCORE.RECENT;
    reasons.push("Recently used");
  }

  const fuzzyNick = fuzzyScore(nick, q);
  if (fuzzyNick > 20) {
    score = Math.max(score, fuzzyNick);
  }

  return {
    accountId: account.id,
    displayName: formatDisplayName(account),
    score,
    matchedAliases,
    reasons,
  };
}

export function formatDisplayName(account: ResolutionAccount): string {
  const suffix = account.accountLastFour ? ` ending ${account.accountLastFour}` : "";
  return `${account.nickname}${suffix}`;
}

export function resolveAccountReference(
  query: string,
  accounts: ResolutionAccount[],
  aliases: AccountAlias[],
  options?: { recentAccountIds?: string[]; minScore?: number }
): AccountResolutionResult {
  const recentAccountIds = options?.recentAccountIds ?? [];
  const minScore = options?.minScore ?? CLARIFICATION_THRESHOLD;

  const q = stripPossessives(query).trim();
  if (!q) {
    return { confidence: 0, candidates: [], requiresClarification: true };
  }

  const qNorm = normalizeAlias(q);

  const institutionOnly = accounts.filter((a) => {
    const inst = normalizeAlias(a.institution);
    return inst === qNorm || inst.includes(qNorm) || qNorm.includes(inst);
  });
  if (institutionOnly.length === 1 && qNorm.length >= 4) {
    const account = institutionOnly[0];
    return {
      resolvedAccountId: account.id,
      confidence: 0.85,
      candidates: [
        {
          accountId: account.id,
          displayName: formatDisplayName(account),
          score: 85,
          matchedAliases: [],
          reasons: ["Unique institution match"],
        },
      ],
      requiresClarification: false,
    };
  }

  const candidates = accounts
    .filter((a) => !isIncompatibleAccountType(q, a.accountType))
    .map((a) => scoreAccount(a, q, aliases, recentAccountIds))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      confidence: 0,
      candidates: [],
      requiresClarification: true,
      clarificationQuestion: `I couldn't find an account matching "${query}". Choose one below or try a different name.`,
    };
  }

  const top = candidates[0];
  const second = candidates[1];
  const closeRace =
    second != null && top.score - second.score < CLOSE_SCORE_GAP && second.score >= minScore - 20;

  if (top.score >= minScore && !closeRace) {
    return {
      resolvedAccountId: top.accountId,
      confidence: Math.min(top.score / 100, 1),
      candidates,
      requiresClarification: false,
    };
  }

  const clarificationQuestion =
    candidates.length === 1
      ? `I found ${top.displayName}. Is that the account you mean?`
      : `You have ${candidates.length} matching accounts. Did you mean ${candidates
          .slice(0, 3)
          .map((c) => c.displayName)
          .join(" or ")}?`;

  return {
    confidence: top.score / 100,
    candidates: candidates.slice(0, 5),
    requiresClarification: true,
    clarificationQuestion,
  };
}

export function formatClarificationQuestion(candidates: AccountResolutionCandidate[]): string {
  if (candidates.length === 1) {
    return `I found ${candidates[0].displayName}. Is that the account you mean?`;
  }
  const list = candidates.map((c) => c.displayName).join(" or ");
  return `Which account did you mean: ${list}?`;
}
