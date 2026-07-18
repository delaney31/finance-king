import { replaceSpokenAmounts, parseSpokenNumberPhrase } from "./spoken-numbers";
import { replaceSpokenDates } from "./spoken-dates";

const FILLER = /\b(um|uh|like|please|hey|okay|ok|so|well|actually|basically)\b/gi;
const POSSESSIVE = /\b(my|our|the)\s+/gi;

const INSTITUTION_ALIASES: Record<string, string> = {
  amex: "american express",
  "american express": "american express",
  wells: "wells fargo",
  penfed: "penfed",
  "pen fed": "penfed",
  truist: "truist",
  mercury: "mercury",
  jade: "jadessystems",
  jadesystems: "jadessystems",
  "jade systems": "jadessystems",
  "pacific luxe": "pacific luxe",
  "rental business": "pacific luxe",
  "rental account": "pacific luxe",
  "fleet account": "pacific luxe",
};

const BUSINESS_PHRASES: Record<string, string> = {
  "the rental business": "pacific luxe",
  "rental business": "pacific luxe",
  "the rental account": "pacific luxe",
  "rental account": "pacific luxe",
  "contract account": "jadessystems",
  "contract payment": "contract",
};

export function normalizeInstitution(text: string): string {
  let result = text.toLowerCase();
  for (const [alias, canonical] of Object.entries(INSTITUTION_ALIASES)) {
    result = result.replace(new RegExp(`\\b${alias}\\b`, "gi"), canonical);
  }
  return result;
}

export function normalizeCfoMessage(
  message: string,
  options?: { timezone?: string }
): string {
  let text = message.trim().replace(/\s+/g, " ");
  text = text.replace(FILLER, " ");
  text = text.replace(/(\w)-(\w)/g, "$1 $2");

  const { text: withAmounts } = replaceSpokenAmounts(text);
  text = withAmounts;

  text = text.replace(
    /\bhas\s+([a-z\s]+?)\s+dollars?\b/gi,
    (_m, phrase: string) => {
      const v = parseSpokenNumberPhrase(phrase.trim());
      return v ? `has $${v.toLocaleString("en-US")}` : _m;
    }
  );

  text = replaceSpokenDates(text, options?.timezone);

  for (const [phrase, replacement] of Object.entries(BUSINESS_PHRASES)) {
    text = text.replace(new RegExp(phrase, "gi"), replacement);
  }

  text = normalizeInstitution(text);

  text = text.replace(
    /\b(?:my|the)\s+(.+?)\s+account\s+has\s+(\$[\d,]+(?:\.\d{2})?)/gi,
    "update $1 to $2"
  );
  text = text.replace(/\bhas\s+(\$[\d,]+)\s+now\b/gi, "to $1");

  // ads → advertising
  text = text.replace(/\bads\b/gi, "advertising");
  text = text.replace(/\bpaycheck\b/gi, "W-2 deposit");
  text = text.replace(/\bw-2\b/gi, "W-2");

  return text.replace(/\s+/g, " ").trim();
}

export function stripPossessives(phrase: string): string {
  return phrase.replace(POSSESSIVE, "").trim();
}
