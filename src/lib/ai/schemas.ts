import { z } from "zod";

export const financialAssistantIntentSchema = z.enum([
  "SAFE_TO_SPEND",
  "CAN_I_AFFORD",
  "EXPLAIN_METRIC",
  "DEBT_PAYMENT",
  "CREDIT_UTILIZATION",
  "OVERDRAFT_RISK",
  "INCOME_DELAY",
  "UPCOMING_BILLS",
  "MONTHLY_REVIEW",
  "ACCOUNT_ROUTING",
  "GENERAL_FINANCIAL_QUESTION",
  "UNKNOWN",
]);

export const intentResultSchema = z.object({
  intent: financialAssistantIntentSchema,
  confidence: z.number().min(0).max(1),
  extractedParams: z.record(z.unknown()).default({}),
});

export const safeToSpendParamsSchema = z.object({
  horizon: z.enum(["today", "week", "month", "payday", "custom"]).default("today"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const canAffordParamsSchema = z.object({
  purchaseName: z.string().optional(),
  amount: z.number().positive().optional(),
  purchaseDate: z.string().optional(),
  isBusiness: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  preferredAccountId: z.string().optional(),
});

export const explainMetricParamsSchema = z.object({
  metricName: z.string(),
});

export const debtPaymentParamsSchema = z.object({
  debtId: z.string().optional(),
  debtName: z.string().optional(),
});

export const incomeDelayParamsSchema = z.object({
  incomeId: z.string().optional(),
  incomeName: z.string().optional(),
  delayedDate: z.string().optional(),
});

export const cfoAssistantResponseSchema = z.object({
  answer: z.string().min(1),
  recommendation: z.enum([
    "PROCEED",
    "PROCEED_WITH_LIMIT",
    "DELAY",
    "DECLINE",
    "INFORMATION_ONLY",
  ]),
  safeToSpendToday: z.number().optional(),
  safeToSpendThisWeek: z.number().optional(),
  safeToSpendThisMonth: z.number().optional(),
  recommendedAmount: z.number().optional(),
  recommendedAccountId: z.string().optional(),
  monthEndImpact: z.number().optional(),
  yearEndImpact: z.number().optional(),
  emergencyReserveAffected: z.boolean(),
  taxReserveAffected: z.boolean(),
  nextBillsCovered: z.boolean(),
  warnings: z.array(z.string()),
  assumptions: z.array(z.string()),
  supportingCalculations: z.array(
    z.object({
      label: z.string(),
      amount: z.number().optional(),
      description: z.string().optional(),
    })
  ),
  suggestedFollowUpQuestions: z.array(z.string()),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  question: z.string().min(1).max(2000),
});

export const feedbackSchema = z.object({
  messageId: z.string(),
  feedback: z.enum(["positive", "negative"]),
  note: z.string().max(500).optional(),
});
