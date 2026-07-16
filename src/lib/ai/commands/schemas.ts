import { z } from "zod";

export const cfoUpdateIntentSchema = z.enum([
  "UPDATE_ACCOUNT_BALANCE",
  "UPDATE_PROTECTED_AMOUNT",
  "CREATE_ACCOUNT",
  "UPDATE_ACCOUNT_DETAILS",
  "ADD_TRANSACTION",
  "MARK_TRANSACTION_CLEARED",
  "MARK_BILL_PAID",
  "UPDATE_BILL",
  "ADD_EXPECTED_INCOME",
  "MARK_INCOME_RECEIVED",
  "UPDATE_INCOME_DATE",
  "TRANSFER_BETWEEN_ACCOUNTS",
  "CREATE_CREDIT_CARD",
  "UPDATE_CREDIT_CARD",
  "CREATE_LOAN",
  "UPDATE_LOAN",
  "UNKNOWN",
]);

export const cfoDataCommandSchema = z.object({
  intent: cfoUpdateIntentSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  accountId: z.string().optional(),
  accountName: z.string().optional(),
  institution: z.string().optional(),
  accountType: z.string().optional(),
  amount: z.number().optional(),
  previousAmount: z.number().optional(),
  sourceAccountId: z.string().optional(),
  destinationAccountId: z.string().optional(),
  sourceAccountName: z.string().optional(),
  destinationAccountName: z.string().optional(),
  transactionDate: z.string().optional(),
  dueDate: z.string().optional(),
  clearedDate: z.string().optional(),
  transactionDescription: z.string().optional(),
  category: z.string().optional(),
  ownershipType: z.enum(["PERSONAL", "JOINT", "BUSINESS", "PROPERTY"]).optional(),
  creditLimit: z.number().optional(),
  statementBalance: z.number().optional(),
  minimumPayment: z.number().optional(),
  apr: z.number().optional(),
  statementClosingDate: z.string().optional(),
  protectedAmount: z.number().optional(),
  minimumFloor: z.number().optional(),
  billId: z.string().optional(),
  billName: z.string().optional(),
  incomeId: z.string().optional(),
  incomeName: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  missingFields: z.array(z.string()).default([]),
  clarificationQuestion: z.string().optional(),
});

export type CFODataCommand = z.infer<typeof cfoDataCommandSchema>;

export const cfoUpdateResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  updatedEntities: z.array(
    z.object({
      type: z.string(),
      id: z.string(),
      label: z.string(),
    })
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
});

export type CFOUpdateResult = z.infer<typeof cfoUpdateResultSchema>;
