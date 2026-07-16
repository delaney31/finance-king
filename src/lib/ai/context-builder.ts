import type { EngineSnapshot } from "@/lib/engine/types";
import type { ToolExecutionRecord } from "./types";

const SENSITIVE_PATTERNS = [
  /\b\d{9,17}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
];

export function maskSensitiveText(text: string): string {
  return text
    .replace(SENSITIVE_PATTERNS[0], "****")
    .replace(SENSITIVE_PATTERNS[1], "***-**-****");
}

export interface SafeContext {
  asOfDate: string;
  accounts: Array<{
    id: string;
    nickname: string;
    lastFour?: string;
    routingTag: string;
    clearedBalance: number;
    minimumFloor: number;
    protectedAmount: number;
  }>;
  upcomingBills: Array<{ name: string; amount: number; dueDate?: string | null }>;
  expectedIncome: Array<{ name: string; amount: number; date?: string | null; provisional: boolean }>;
  goals: Array<{ name: string; type: string; target: number; current: number }>;
  toolResults: ToolExecutionRecord[];
  preferences: { safetyMarginFlat: number };
}

export function buildSafeContext(
  snapshot: EngineSnapshot,
  toolResults: ToolExecutionRecord[]
): SafeContext {
  const relevantAccountIds = new Set<string>();
  for (const tr of toolResults) {
    const data = tr.result.data as Record<string, unknown>;
    if (data.recommendedAccount && typeof data.recommendedAccount === "object") {
      const acc = data.recommendedAccount as { id?: string };
      if (acc.id) relevantAccountIds.add(acc.id);
    }
    if (Array.isArray(data.risks)) {
      for (const r of data.risks as { accountId?: string }[]) {
        if (r.accountId) relevantAccountIds.add(r.accountId);
      }
    }
  }

  const accountsToInclude =
    relevantAccountIds.size > 0
      ? snapshot.accounts.filter((a) => relevantAccountIds.has(a.id) || a.isLiquid)
      : snapshot.accounts.filter((a) => a.isLiquid);

  return {
    asOfDate: snapshot.asOfDate,
    accounts: accountsToInclude.map((a) => ({
      id: a.id,
      nickname: maskSensitiveText(a.nickname),
      lastFour: undefined,
      routingTag: a.routingTag,
      clearedBalance: a.availableBalance ?? a.currentBalance,
      minimumFloor: a.minimumTargetBalance,
      protectedAmount: a.protectedBalance,
    })),
    upcomingBills: snapshot.bills.slice(0, 8).map((b) => ({
      name: b.name,
      amount: b.amount,
      dueDate: b.nextDueDate,
    })),
    expectedIncome: snapshot.income
      .filter((i) => i.status === "SCHEDULED")
      .slice(0, 5)
      .map((i) => ({
        name: i.name,
        amount: i.amount,
        date: i.expectedDate,
        provisional: !!i.isProvisional,
      })),
    goals: snapshot.goals.map((g) => ({
      name: g.name,
      type: g.type,
      target: g.targetAmount,
      current: g.currentAmount,
    })),
    toolResults: toolResults.map((tr) => ({
      ...tr,
      result: {
        ...tr.result,
        data: sanitizeToolData(tr.result.data),
      },
    })),
    preferences: { safetyMarginFlat: snapshot.preferences.safetyMarginFlat },
  };
}

function sanitizeToolData(data: unknown): unknown {
  if (data == null) return data;
  const str = JSON.stringify(data);
  const masked = maskSensitiveText(str);
  try {
    return JSON.parse(masked);
  } catch {
    return data;
  }
}

export function contextContainsFullAccountNumbers(context: SafeContext): boolean {
  const str = JSON.stringify(context);
  return /\b\d{12,}\b/.test(str);
}
