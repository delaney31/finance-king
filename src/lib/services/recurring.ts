interface TransactionInput {
  description: string;
  amount: number;
  date: string;
}

interface DetectedPattern {
  name: string;
  typicalAmount: number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "IRREGULAR";
  confidence: number;
  classification: "NECESSARY" | "DISCRETIONARY" | "POTENTIALLY_REDUCIBLE";
}

export function detectRecurringPatterns(transactions: TransactionInput[]): DetectedPattern[] {
  const groups = new Map<string, TransactionInput[]>();

  for (const t of transactions) {
    const key = t.description.toUpperCase().trim();
    const existing = groups.get(key) ?? [];
    existing.push(t);
    groups.set(key, existing);
  }

  const patterns: DetectedPattern[] = [];

  for (const [name, txns] of groups) {
    if (txns.length < 2) continue;

    const amounts = txns.map((t) => Math.abs(t.amount));
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance =
      amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length;
    const variability = avgAmount > 0 ? Math.sqrt(variance) / avgAmount : 1;

    const dates = txns.map((t) => new Date(t.date).getTime()).sort();
    const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / (1000 * 60 * 60 * 24));
    const avgGap = gaps.reduce((s, g) => s + g, 0) / (gaps.length || 1);

    let frequency: DetectedPattern["frequency"] = "IRREGULAR";
    if (avgGap >= 25 && avgGap <= 35) frequency = "MONTHLY";
    else if (avgGap >= 12 && avgGap <= 16) frequency = "BIWEEKLY";
    else if (avgGap >= 6 && avgGap <= 8) frequency = "WEEKLY";

    const confidence = Math.min(0.99, 0.5 + txns.length * 0.15 + (variability < 0.1 ? 0.2 : 0));

    let classification: DetectedPattern["classification"] = "DISCRETIONARY";
    if (/mortgage|rent|insurance|tax|401|loan|payment/i.test(name)) {
      classification = "NECESSARY";
    } else if (/netflix|spotify|subscription|dining|entertainment/i.test(name)) {
      classification = "POTENTIALLY_REDUCIBLE";
    }

    patterns.push({
      name,
      typicalAmount: Math.round(avgAmount * 100) / 100,
      frequency,
      confidence,
      classification,
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}
