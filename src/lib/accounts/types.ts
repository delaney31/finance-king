export type AliasSource = "SYSTEM" | "USER" | "AI_LEARNED";

export type AccountAlias = {
  id: string;
  userId: string;
  financialAccountId: string;
  alias: string;
  normalizedAlias: string;
  source: AliasSource;
  confidence: number;
};

export type AccountResolutionCandidate = {
  accountId: string;
  displayName: string;
  score: number;
  matchedAliases: string[];
  reasons: string[];
};

export type AccountResolutionResult = {
  resolvedAccountId?: string;
  confidence: number;
  candidates: AccountResolutionCandidate[];
  requiresClarification: boolean;
  clarificationQuestion?: string;
};

export type ResolutionAccount = {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
  designation: string;
  routingTag: string;
  accountLastFour?: string | null;
  businessEntityName?: string | null;
};
