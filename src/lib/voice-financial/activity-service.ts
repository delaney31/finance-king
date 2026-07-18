import { prisma } from "@/lib/db";
import type { AccountActivityEventType, ActivitySource } from "@prisma/client";

export async function createActivityEvent(input: {
  userId: string;
  accountId: string;
  eventType: AccountActivityEventType;
  description: string;
  source: ActivitySource;
  auditLogId: string;
  effectiveDate?: Date;
  previousBalance?: number;
  newBalance?: number;
  amount?: number;
  transactionId?: string;
  relatedAccountId?: string;
  payee?: string;
  category?: string;
  originalTranscript?: string;
  financialSnapshotId?: string;
}) {
  return prisma.accountActivityEvent.create({
    data: {
      userId: input.userId,
      accountId: input.accountId,
      eventType: input.eventType,
      description: input.description,
      source: input.source,
      auditLogId: input.auditLogId,
      effectiveDate: input.effectiveDate ?? new Date(),
      previousBalance: input.previousBalance,
      newBalance: input.newBalance,
      amount: input.amount,
      transactionId: input.transactionId,
      relatedAccountId: input.relatedAccountId,
      payee: input.payee,
      category: input.category,
      originalTranscript: input.originalTranscript,
      financialSnapshotId: input.financialSnapshotId,
    },
  });
}
