import { prisma } from "@/lib/db";
import type { FinancialAccount, BusinessEntity, AccountAlias as PrismaAlias } from "@prisma/client";
import { buildAliasRecords } from "./alias-generator";
import type { AccountAlias, ResolutionAccount } from "./types";
import { normalizeAlias } from "./normalize";

export function toResolutionAccount(
  account: FinancialAccount & { businessEntity?: BusinessEntity | null }
): ResolutionAccount {
  return {
    id: account.id,
    nickname: account.nickname,
    institution: account.institution,
    accountType: account.accountType,
    designation: account.designation,
    routingTag: account.routingTag,
    accountLastFour: account.accountLastFour,
    businessEntityName: account.businessEntity?.name ?? null,
  };
}

export function toAccountAlias(row: PrismaAlias): AccountAlias {
  return {
    id: row.id,
    userId: row.userId,
    financialAccountId: row.financialAccountId,
    alias: row.alias,
    normalizedAlias: row.normalizedAlias,
    source: row.source,
    confidence: row.confidence,
  };
}

export async function ensureSystemAliases(userId: string): Promise<AccountAlias[]> {
  const accounts = await prisma.financialAccount.findMany({
    where: { userId },
    include: { businessEntity: true },
  });

  for (const account of accounts) {
    const records = buildAliasRecords(userId, toResolutionAccount(account));
    for (const record of records) {
      await prisma.accountAlias.upsert({
        where: {
          userId_normalizedAlias_financialAccountId: {
            userId,
            normalizedAlias: record.normalizedAlias,
            financialAccountId: record.financialAccountId,
          },
        },
        create: {
          userId,
          financialAccountId: record.financialAccountId,
          alias: record.alias,
          normalizedAlias: record.normalizedAlias,
          source: "SYSTEM",
          confidence: 1,
        },
        update: {},
      });
    }
  }

  return loadAliases(userId);
}

export async function loadAliases(userId: string): Promise<AccountAlias[]> {
  const rows = await prisma.accountAlias.findMany({ where: { userId } });
  return rows.map(toAccountAlias);
}

export async function learnAlias(
  userId: string,
  phrase: string,
  financialAccountId: string
): Promise<AccountAlias> {
  const normalized = normalizeAlias(phrase);
  const row = await prisma.accountAlias.upsert({
    where: {
      userId_normalizedAlias_financialAccountId: {
        userId,
        normalizedAlias: normalized,
        financialAccountId,
      },
    },
    create: {
      userId,
      financialAccountId,
      alias: phrase.trim(),
      normalizedAlias: normalized,
      source: "AI_LEARNED",
      confidence: 0.9,
    },
    update: {
      source: "AI_LEARNED",
      confidence: 0.95,
    },
  });
  return toAccountAlias(row);
}

export async function createUserAlias(
  userId: string,
  alias: string,
  financialAccountId: string
): Promise<AccountAlias> {
  const row = await prisma.accountAlias.create({
    data: {
      userId,
      financialAccountId,
      alias: alias.trim(),
      normalizedAlias: normalizeAlias(alias),
      source: "USER",
      confidence: 1,
    },
  });
  return toAccountAlias(row);
}

export async function deleteAlias(userId: string, aliasId: string): Promise<void> {
  await prisma.accountAlias.deleteMany({
    where: { id: aliasId, userId },
  });
}
