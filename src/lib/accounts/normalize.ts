export function normalizeAlias(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\b(my|our|the|a|an)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

export function fuzzyScore(a: string, b: string): number {
  const na = normalizeAlias(a);
  const nb = normalizeAlias(b);
  if (!na || !nb) return 0;
  if (na === nb) return 50;
  if (na.includes(nb) || nb.includes(na)) return 40;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  const similarity = 1 - dist / maxLen;
  return Math.round(similarity * 35);
}
