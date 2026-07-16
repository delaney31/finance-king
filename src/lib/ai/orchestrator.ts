import { prisma } from "@/lib/db";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { recalculateFinancialState } from "@/lib/financial-state/recalculate";
import { createAIProvider, classifyIntentRules } from "./provider";
import { getAIConfig } from "./config";
import { cfoAssistantResponseSchema, canAffordParamsSchema, explainMetricParamsSchema, safeToSpendParamsSchema } from "./schemas";
import { buildSafeContext } from "./context-builder";
import { buildFallbackResponse, enhanceWithLLM } from "./response-builder";
import { buildCompactAnswer } from "./compact-presenter";
import { checkDailyLimit, logUsage } from "./usage";
import type {
  CFOAssistantResponse,
  FinancialAssistantIntent,
  ToolExecutionRecord,
} from "./types";
import {
  calculateSafeToSpend,
  simulatePurchase,
  explainMetric,
  calculateDebtPaymentOptions,
  calculateCreditUtilization,
  detectOverdraftRisk,
  simulateIncomeDelay,
  getUpcomingObligations,
  generateMonthlyFinancialReport,
  getRecommendedAccountForExpense,
  getCurrentFinancialState,
} from "./tools";

export interface OrchestratorResult {
  conversationId: string;
  messageId: string;
  response: CFOAssistantResponse;
  intent: FinancialAssistantIntent;
  snapshotId: string;
  snapshotStale?: boolean;
  toolCalls: ToolExecutionRecord[];
}

async function getLatestSnapshotId(userId: string): Promise<string> {
  const latest = await prisma.financialStateSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (latest) return latest.id;

  const state = await recalculateFinancialState(userId);
  void state;
  const created = await prisma.financialStateSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return created?.id ?? "";
}

async function executeToolsForIntent(
  userId: string,
  intent: FinancialAssistantIntent,
  params: Record<string, unknown>,
  snapshot: Awaited<ReturnType<typeof getEngineSnapshot>>,
  snapshotId: string
): Promise<ToolExecutionRecord[]> {
  const records: ToolExecutionRecord[] = [];

  async function run<T>(toolName: string, args: Record<string, unknown>, fn: () => Promise<{ data: T; warnings: string[]; assumptions: string[]; calculatedAt: string; sourceSnapshotId: string }>) {
    const start = Date.now();
    const result = await fn();
    records.push({
      toolName,
      arguments: args,
      result,
      durationMs: Date.now() - start,
    });
  }

  await run("getCurrentFinancialState", {}, () => getCurrentFinancialState(userId, snapshot, snapshotId));
  await run("getUpcomingObligations", { count: 3 }, () => getUpcomingObligations(userId, snapshot, snapshotId, 3));

  switch (intent) {
    case "SAFE_TO_SPEND": {
      const parsed = safeToSpendParamsSchema.safeParse(params);
      const horizon = parsed.success ? parsed.data.horizon : "today";
      const h = horizon === "custom" ? "today" : horizon === "payday" ? "payday" : horizon;
      await run("calculateSafeToSpend", { horizon: h }, () =>
        calculateSafeToSpend(userId, snapshot, snapshotId, h as "today" | "week" | "month" | "payday")
      );
      break;
    }
    case "CAN_I_AFFORD": {
      const parsed = canAffordParamsSchema.safeParse(params);
      const amount = parsed.success ? parsed.data.amount : undefined;
      const name = parsed.success && parsed.data.purchaseName ? parsed.data.purchaseName : "Purchase";
      if (amount && amount > 0) {
        await run("simulatePurchase", { name, amount }, () =>
          simulatePurchase(userId, snapshot, snapshotId, {
            name,
            amount,
            date: parsed.data?.purchaseDate ?? snapshot.asOfDate,
            accountId: parsed.data?.preferredAccountId,
            isBusiness: parsed.data?.isBusiness,
          })
        );
      }
      await run("calculateSafeToSpend", { horizon: "today" }, () =>
        calculateSafeToSpend(userId, snapshot, snapshotId, "today")
      );
      break;
    }
    case "EXPLAIN_METRIC": {
      const parsed = explainMetricParamsSchema.safeParse({ metricName: params.metricName ?? "safe_to_spend" });
      const metric = parsed.success ? parsed.data.metricName : "safe_to_spend";
      await run("explainMetric", { metricName: metric }, () =>
        explainMetric(userId, snapshot, snapshotId, metric)
      );
      break;
    }
    case "DEBT_PAYMENT":
      await run("calculateDebtPaymentOptions", params, () =>
        calculateDebtPaymentOptions(userId, snapshot, snapshotId, params.debtName as string | undefined)
      );
      break;
    case "CREDIT_UTILIZATION":
      await run("calculateCreditUtilization", {}, () =>
        calculateCreditUtilization(userId, snapshot, snapshotId)
      );
      break;
    case "OVERDRAFT_RISK":
      await run("detectOverdraftRisk", {}, () => detectOverdraftRisk(userId, snapshot, snapshotId));
      break;
    case "INCOME_DELAY":
      await run("simulateIncomeDelay", params, () =>
        simulateIncomeDelay(
          userId,
          snapshot,
          snapshotId,
          params.incomeName as string | undefined,
          params.delayedDate as string | undefined
        )
      );
      break;
    case "MONTHLY_REVIEW":
      await run("generateMonthlyFinancialReport", {}, () =>
        generateMonthlyFinancialReport(userId, snapshot, snapshotId)
      );
      break;
    case "ACCOUNT_ROUTING":
      await run("getRecommendedAccountForExpense", params, () =>
        getRecommendedAccountForExpense(userId, snapshot, snapshotId, {
          name: params.expenseName as string | undefined,
          amount: params.amount as number | undefined,
          isBusiness: params.isBusiness as boolean | undefined,
        })
      );
      break;
    case "UPCOMING_BILLS":
      break;
    case "GENERAL_FINANCIAL_QUESTION":
    case "UNKNOWN":
    default:
      await run("calculateSafeToSpend", { horizon: "today" }, () =>
        calculateSafeToSpend(userId, snapshot, snapshotId, "today")
      );
      if (params.amount || params.purchaseName) {
        const amount = (params.amount as number) ?? 100;
        const name = (params.purchaseName as string) ?? "Purchase";
        await run("simulatePurchase", { name, amount }, () =>
          simulatePurchase(userId, snapshot, snapshotId, {
            name,
            amount,
            date: snapshot.asOfDate,
            isBusiness: params.isBusiness as boolean | undefined,
          })
        );
      }
      break;
  }

  return records;
}

function validateResponse(response: CFOAssistantResponse): CFOAssistantResponse {
  const parsed = cfoAssistantResponseSchema.safeParse(response);
  if (parsed.success) return parsed.data;
  return response;
}

export async function processCFOQuestion(params: {
  userId: string;
  question: string;
  conversationId?: string;
}): Promise<OrchestratorResult> {
  const limit = await checkDailyLimit(params.userId);
  if (!limit.allowed) {
    throw new Error(`Daily AI request limit reached (${limit.limit}). Try again tomorrow.`);
  }

  const provider = createAIProvider();
  const config = getAIConfig();

  let conversationId = params.conversationId;
  let history: { role: string; content: string }[] = [];
  let priorSnapshotId: string | undefined;

  if (conversationId) {
    const conv = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId: params.userId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 12 },
      },
    });
    if (!conv) throw new Error("Conversation not found");
    priorSnapshotId = conv.financialSnapshotId ?? undefined;
    history = conv.messages.map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));
  } else {
    const conv = await prisma.aIConversation.create({
      data: {
        userId: params.userId,
        title: params.question.slice(0, 80),
      },
    });
    conversationId = conv.id;
  }

  await prisma.aIMessage.create({
    data: {
      conversationId: conversationId!,
      role: "user",
      content: params.question,
    },
  });

  await recalculateFinancialState(params.userId);
  const snapshot = await getEngineSnapshot(params.userId);
  const snapshotId = await getLatestSnapshotId(params.userId);
  const snapshotStale = !!priorSnapshotId && priorSnapshotId !== snapshotId;

  let intentResult = classifyIntentRules(params.question);
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  if (config.provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const classified = await provider.classifyIntent({
        question: params.question,
        conversationHistory: history,
      });
      intentResult = classified;
      totalPromptTokens += classified.usage?.promptTokens ?? 0;
      totalCompletionTokens += classified.usage?.completionTokens ?? 0;
    } catch {
      intentResult = classifyIntentRules(params.question);
    }
  }

  const toolCalls = await executeToolsForIntent(
    params.userId,
    intentResult.intent,
    intentResult.extractedParams,
    snapshot,
    snapshotId
  );

  const context = buildSafeContext(snapshot, toolCalls);
  let response = buildFallbackResponse(intentResult.intent, snapshot, toolCalls);

  if (snapshotStale) {
    response.warnings.push("Your financial data has changed since this conversation started. Recalculate for the latest numbers.");
  }

  if (config.provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const enhanced = await enhanceWithLLM(
        provider,
        params.question,
        JSON.stringify(context),
        response
      );
      response = validateResponse(enhanced);
      totalPromptTokens += 500;
      totalCompletionTokens += 300;
    } catch {
      response = validateResponse(response);
    }
  } else {
    response = validateResponse(response);
  }

  const parsed = cfoAssistantResponseSchema.safeParse(response);
  if (!parsed.success) {
    response = validateResponse(buildFallbackResponse(intentResult.intent, snapshot, toolCalls));
  }

  response.compact = buildCompactAnswer(
    params.question,
    response,
    intentResult.intent,
    toolCalls,
    snapshot.asOfDate,
    snapshot
  );

  const assistantMessage = await prisma.aIMessage.create({
    data: {
      conversationId: conversationId!,
      role: "assistant",
      content: response.answer,
      structuredResponse: response as object,
      financialSnapshotId: snapshotId,
      intent: intentResult.intent,
    },
  });

  for (const tc of toolCalls) {
    await prisma.aIToolCall.create({
      data: {
        messageId: assistantMessage.id,
        toolName: tc.toolName,
        arguments: tc.arguments as object,
        result: tc.result as object,
        durationMs: tc.durationMs,
      },
    });
  }

  await prisma.aIRecommendation.create({
    data: {
      messageId: assistantMessage.id,
      type: response.recommendation,
      metadata: {
        safeToSpendToday: response.safeToSpendToday,
        recommendedAccountId: response.recommendedAccountId,
      },
    },
  });

  await prisma.aIConversation.update({
    where: { id: conversationId! },
    data: { financialSnapshotId: snapshotId, updatedAt: new Date() },
  });

  await logUsage({
    userId: params.userId,
    conversationId: conversationId!,
    intent: intentResult.intent,
    provider: provider.name,
    model: provider.model,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
  });

  return {
    conversationId: conversationId!,
    messageId: assistantMessage.id,
    response,
    intent: intentResult.intent,
    snapshotId,
    snapshotStale,
    toolCalls,
  };
}

export async function getConversation(userId: string, conversationId: string) {
  const conv = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          toolCalls: true,
          recommendation: true,
          financialSnapshot: true,
        },
      },
      financialSnapshot: true,
    },
  });

  if (!conv) return null;

  const latestSnapshot = await prisma.financialStateSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const snapshotStale =
    !!conv.financialSnapshotId &&
    !!latestSnapshot &&
    conv.financialSnapshotId !== latestSnapshot.id;

  return { ...conv, snapshotStale };
}

export async function submitFeedback(
  userId: string,
  messageId: string,
  feedback: "positive" | "negative",
  note?: string
) {
  const message = await prisma.aIMessage.findFirst({
    where: { id: messageId, conversation: { userId } },
  });
  if (!message) throw new Error("Message not found");

  return prisma.aIMessage.update({
    where: { id: messageId },
    data: { feedback, feedbackNote: note },
  });
}

export async function listConversations(userId: string) {
  return prisma.aIConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}
