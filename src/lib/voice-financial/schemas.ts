import { z } from "zod";

export const voiceFinancialIntentSchema = z.enum([
  "RECORD_EXPENSE",
  "RECORD_INCOME",
  "RECORD_PAYMENT",
  "RECORD_REFUND",
  "RECORD_TRANSFER",
  "UPDATE_ACCOUNT_BALANCE",
  "UPDATE_CREDIT_CARD_BALANCE",
  "MARK_TRANSACTION_CLEARED",
  "MARK_TRANSACTION_PENDING",
  "MARK_BILL_PAID",
  "SCHEDULE_TRANSACTION",
  "CREATE_BILL",
  "UPDATE_BILL",
  "CREATE_PAYEE",
  "UNKNOWN",
]);

export const voiceTransactionStatusSchema = z.enum(["CLEARED", "PENDING", "SCHEDULED"]);

export const voiceFinancialCommandSchema = z.object({
  intent: voiceFinancialIntentSchema,
  confidence: z.number().min(0).max(1),
  sourceAccountId: z.string().optional(),
  sourceAccountReference: z.string().optional(),
  destinationAccountId: z.string().optional(),
  destinationAccountReference: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().default("USD"),
  payeeName: z.string().optional(),
  merchantName: z.string().optional(),
  recipientName: z.string().optional(),
  description: z.string().optional(),
  memo: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  transactionDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  clearedDate: z.string().optional(),
  status: voiceTransactionStatusSchema.optional(),
  ownershipScope: z.enum(["PERSONAL", "JOINT", "BUSINESS", "PROPERTY"]).optional(),
  relatedBillId: z.string().optional(),
  relatedIncomeId: z.string().optional(),
  relatedDebtId: z.string().optional(),
  missingFields: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  transcript: z.string(),
  clarificationQuestion: z.string().optional(),
  contextAccountMismatch: z.boolean().optional(),
  suggestedPayeeId: z.string().optional(),
  isNewPayee: z.boolean().optional(),
  previousBalance: z.number().optional(),
  projectedBalance: z.number().optional(),
});

export type VoiceFinancialIntent = z.infer<typeof voiceFinancialIntentSchema>;
export type VoiceFinancialCommand = z.infer<typeof voiceFinancialCommandSchema>;

export const voiceFinancialUpdateResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  updatedEntities: z.array(
    z.object({ type: z.string(), id: z.string(), label: z.string() })
  ),
  previousSnapshotId: z.string(),
  newSnapshotId: z.string(),
  metricChanges: z.array(
    z.object({
      metric: z.string(),
      before: z.number(),
      after: z.number(),
      difference: z.number(),
    })
  ),
  warnings: z.array(z.string()),
  auditId: z.string().optional(),
  activityEventIds: z.array(z.string()).optional(),
});

export type VoiceFinancialUpdateResult = z.infer<typeof voiceFinancialUpdateResultSchema>;
