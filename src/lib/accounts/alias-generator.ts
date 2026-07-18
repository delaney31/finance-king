import type { ResolutionAccount } from "./types";
import { normalizeAlias } from "./normalize";

const INSTITUTION_NICKNAMES: Record<string, string[]> = {
  penfed: ["penfed", "pen fed", "pentagon federal"],
  wells: ["wells", "wells fargo"],
  truist: ["truist"],
  mercury: ["mercury"],
  amex: ["amex", "american express"],
  jadessystems: ["jadessystems", "jade systems", "jade", "contract account"],
  pacificluxe: ["pacific luxe", "pacific luxe rentals", "rental account", "rental business", "fleet account"],
};

const TYPE_ALIASES: Record<string, string[]> = {
  CHECKING: ["checking"],
  SAVINGS: ["savings", "emergency savings", "emergency account"],
  BUSINESS_CHECKING: ["business checking", "operating account"],
  CREDIT_CARD: ["credit card", "card"],
  MORTGAGE: ["mortgage", "mortgage account"],
};

const ROUTING_ALIASES: Record<string, string[]> = {
  EMERGENCY: ["emergency savings", "emergency account", "emergency"],
  PERSONAL: ["main checking", "personal checking", "my checking"],
  NY_PROPERTY: ["joint account", "wells joint", "ny mortgage"],
  PACIFIC_LUXE: ["pacific luxe", "rental account", "rental business", "fleet account"],
  JADE_SYSTEMS: ["jadessystems", "jade account", "contract account"],
};

function accountTypeLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export function generateSystemAliases(account: ResolutionAccount): string[] {
  const aliases = new Set<string>();

  aliases.add(account.nickname);
  aliases.add(account.institution);
  aliases.add(`${account.institution} ${accountTypeLabel(account.accountType)}`);
  aliases.add(accountTypeLabel(account.accountType));

  if (account.accountLastFour) {
    aliases.add(`ending ${account.accountLastFour}`);
    aliases.add(`${account.institution} ending ${account.accountLastFour}`);
    aliases.add(`checking ending ${account.accountLastFour}`);
  }

  if (account.businessEntityName) {
    aliases.add(account.businessEntityName);
    aliases.add(`${account.businessEntityName} account`);
    aliases.add(`${account.businessEntityName} checking`);
  }

  const instKey = normalizeAlias(account.institution).replace(/\s/g, "");
  for (const [key, names] of Object.entries(INSTITUTION_NICKNAMES)) {
    if (instKey.includes(key) || normalizeAlias(account.nickname).includes(key)) {
      names.forEach((n) => aliases.add(n));
    }
  }

  const types = TYPE_ALIASES[account.accountType] ?? [];
  types.forEach((t) => aliases.add(t));

  const routing = ROUTING_ALIASES[account.routingTag] ?? [];
  routing.forEach((t) => aliases.add(t));

  if (account.designation === "BUSINESS") {
    aliases.add("business checking");
  }

  if (account.accountType === "MORTGAGE") {
    aliases.add("mortgage");
    aliases.add("mortgage account");
  }

  return [...aliases].filter((a) => a.length > 1);
}

export function buildAliasRecords(
  userId: string,
  account: ResolutionAccount
): Array<{ alias: string; normalizedAlias: string; financialAccountId: string }> {
  return generateSystemAliases(account).map((alias) => ({
    alias,
    normalizedAlias: normalizeAlias(alias),
    financialAccountId: account.id,
  }));
}
