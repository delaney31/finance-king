import { prisma } from "@/lib/db";
import { normalizeAlias } from "@/lib/accounts/normalize";

const DEFAULT_PAYEE_CATEGORIES: Record<string, string> = {
  "state farm": "Insurance",
  bridgecrest: "Vehicle loan",
  amex: "Credit card payment",
  "american express": "Credit card payment",
  google: "Advertising",
  "google ads": "Advertising",
  disneyland: "Family entertainment",
  "porsche south bay": "Fleet maintenance",
  nobu: "Dining",
  victor: "Uncategorized",
};

export async function loadPayees(userId: string) {
  return prisma.payee.findMany({ where: { userId }, orderBy: { transactionCount: "desc" } });
}

export function matchPayeeFromList(
  phrase: string,
  payees: Array<{ id: string; canonicalName: string; aliases: string[]; defaultCategory?: string | null }>
): { payeeId?: string; name: string; category?: string; isNew: boolean } | null {
  if (!phrase?.trim()) return null;
  const q = normalizeAlias(phrase);

  for (const p of payees) {
    const names = [p.canonicalName, ...p.aliases].map(normalizeAlias);
    if (names.some((n) => n === q || q.includes(n) || n.includes(q))) {
      return {
        payeeId: p.id,
        name: p.canonicalName,
        category: p.defaultCategory ?? undefined,
        isNew: false,
      };
    }
  }

  const defaultCat = DEFAULT_PAYEE_CATEGORIES[q];
  return { name: phrase.trim(), category: defaultCat, isNew: true };
}

export async function upsertPayeeUsage(
  userId: string,
  name: string,
  options?: { category?: string; accountId?: string }
) {
  const canonical = name.trim();
  const existing = await prisma.payee.findUnique({
    where: { userId_canonicalName: { userId, canonicalName: canonical } },
  });

  if (existing) {
    return prisma.payee.update({
      where: { id: existing.id },
      data: {
        transactionCount: { increment: 1 },
        lastUsedAt: new Date(),
        ...(options?.category ? { defaultCategory: options.category } : {}),
        ...(options?.accountId ? { defaultAccountId: options.accountId } : {}),
      },
    });
  }

  return prisma.payee.create({
    data: {
      userId,
      canonicalName: canonical,
      aliases: [],
      defaultCategory: options?.category,
      defaultAccountId: options?.accountId,
      transactionCount: 1,
      lastUsedAt: new Date(),
    },
  });
}
