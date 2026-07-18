const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const MULTIPLIERS: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  grand: 1000,
  k: 1000,
};

const NON_NUMBER_WORDS =
  /\b(account|wells|fargo|mortgage|rental|business|checking|savings|from|to|my|the|can|spend|on|ads|advertising)\b/i;

export type SpokenAmountParse = {
  value: number;
  ambiguous?: boolean;
  raw: string;
};

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^\w\s.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function parseSpokenNumberPhrase(phrase: string): number | null {
  const tokens = tokenizeWords(phrase);
  if (tokens.length === 0) return null;

  if (tokens.includes("grand") || tokens.includes("k")) {
    const withoutGrand = tokens.filter((t) => t !== "grand" && t !== "k");
    const base = parseSpokenNumberPhrase(withoutGrand.join(" "));
    return base != null ? base * 1000 : 1000;
  }

  let total = 0;
  let current = 0;
  let seenNumber = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "a" || t === "and") continue;

    if (ONES[t] != null) {
      current += ONES[t];
      seenNumber = true;
      continue;
    }

    if (TENS[t] != null) {
      current += TENS[t];
      seenNumber = true;
      continue;
    }

    if (MULTIPLIERS[t] != null) {
      const mult = MULTIPLIERS[t];
      if (mult === 100) {
        current = (current || 1) * 100;
      } else if (mult === 1000) {
        current = (current || 1) * 1000;
        total += current;
        current = 0;
      }
      seenNumber = true;
      continue;
    }

    if (/^\d+(\.\d+)?$/.test(t)) {
      current += Number(t);
      seenNumber = true;
    }
  }

  total += current;
  return seenNumber ? total : null;
}

function stripLeadingArticles(phrase: string): string {
  return phrase.replace(/^(?:the|a|an)\s+/i, "").trim();
}

function isLikelyNumberPhrase(phrase: string): boolean {
  const cleaned = stripLeadingArticles(phrase);
  if (!cleaned || NON_NUMBER_WORDS.test(cleaned)) return false;
  return parseSpokenNumberPhrase(cleaned) != null;
}

function formatAmount(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function replaceSpokenAmounts(text: string): { text: string; amounts: SpokenAmountParse[] } {
  const amounts: SpokenAmountParse[] = [];
  let result = text;

  result = result.replace(
    /\b([\w\s-]*?)(\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|\d+)(?:[\w\s-]*?))\s+(dollars?|bucks?)\b/gi,
    (match, prefix, numberPart) => {
      const phrase = numberPart.trim();
      if (!isLikelyNumberPhrase(phrase)) return match;
      const value = parseSpokenNumberPhrase(phrase)!;
      amounts.push({ value, raw: phrase });
      return `${prefix}${formatAmount(value)}`;
    }
  );

  result = result.replace(/\b([\w\s-]+?)\s+grand\b/gi, (match, group) => {
    const base = parseSpokenNumberPhrase(group.trim()) ?? 1;
    const value = base * 1000;
    amounts.push({ value, raw: match });
    return formatAmount(value);
  });

  result = result.replace(
    /\b(to|has|have|is|was|move|transfer|update|spend|afford)\s+([\w\s-]+?)(?=\s+(?:from|to|on|in|for|until|\.|$))/gi,
    (match, verb, phrase) => {
      if (/\$|\d/.test(phrase)) return match;
      if (!isLikelyNumberPhrase(phrase.trim())) return match;
      const value = parseSpokenNumberPhrase(phrase.trim())!;
      amounts.push({ value, raw: phrase });
      return `${verb} ${formatAmount(value)}`;
    }
  );

  result = result.replace(
    /\b(spend|afford)\s+([\w\s-]+?)(?=\s+on\b)/gi,
    (match, verb, phrase) => {
      if (/\$|\d/.test(phrase)) return match;
      if (!isLikelyNumberPhrase(phrase.trim())) return match;
      const value = parseSpokenNumberPhrase(phrase.trim())!;
      amounts.push({ value, raw: phrase });
      return `${verb} ${formatAmount(value)}`;
    }
  );

  result = result.replace(
    /\bto\s+([a-z0-9\s-]+?)(?:\s*$|\.)/gi,
    (match, phrase) => {
      const clean = phrase.trim();
      if (!isLikelyNumberPhrase(clean)) return match;
      const value = parseSpokenNumberPhrase(clean)!;
      amounts.push({ value, raw: clean });
      return `to ${formatAmount(value)}`;
    }
  );

  return { text: result, amounts };
}

export function parseAmountFromText(text: string): number | undefined {
  const normalized = replaceSpokenAmounts(text).text;
  const dollarMatches = [...normalized.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)];
  if (dollarMatches.length > 0) {
    const values = dollarMatches.map((m) => Number(m[1].replace(/,/g, "")));
    return Math.max(...values);
  }
  const m = normalized.replace(/\bw[\s-]?2\b/gi, "").match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (m) return Number(m[1].replace(/,/g, ""));

  const trailingSpoken = normalized.match(
    /\b(?:paid|spent|sent|transfer|move)\b.+?\b((?:\w+\s+){0,6}(?:hundred|thousand|grand))\b/i
  );
  if (trailingSpoken) {
    const v = parseSpokenNumberPhrase(trailingSpoken[1]);
    if (v != null) return v;
  }

  const digitMatch = normalized.match(/\b([\d,]+(?:\.\d{1,2})?)\b/);
  if (!digitMatch) return undefined;
  return Number(digitMatch[1].replace(/,/g, ""));
}
