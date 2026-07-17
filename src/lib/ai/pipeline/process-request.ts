import { prisma } from "@/lib/db";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { getOrRecalculateFinancialState } from "@/lib/financial-state/recalculate";
import { createAIProvider } from "../provider";
import { getAIConfig } from "../config";
import {
  cfoAssistantResponseSchema,
  canAffordParamsSchema,
  explainMetricParamsSchema,
  safeToSpendParamsSchema,
} from "../schemas";
import { buildSafeContext } from "../context-builder";
import { buildFallbackResponse, enhanceWithLLM } from "../response-builder";
import { buildCompactAnswer } from "../compact-presenter";
import { checkDailyLimit, logUsage } from "../usage";
import type {
  CFOAssistantResponse,
  FinancialAssistantIntent,
  ToolExecutionRecord,
} from "../types";
import {
  calculateSafeToSpend,
  simulatePurchase,
  simulateBusinessPurchase,
  explainMetric,
  calculateDebtPaymentOptions,
  calculateCreditUtilization,
  detectOverdraftRisk,
  simulateIncomeDelay,
  getUpcomingObligations,
  generateMonthlyFinancialReport,
  getRecommendedAccountForExpense,
  getCurrentFinancialState,
} from "../tools";
import {
  classifyIntentDeterministicFirst,
  shouldSkipAIClassification,
} from "./deterministic-parse";
import { buildDeterministicFallback } from "./fallback";
import { mapPipelineError } from "./error-map";
import { createStageLogger, clearStageTimestamps } from "./stages";
import { withTimeout, PIPELINE_TIMEOUTS } from "./timeout";
import {
  CFOTimeoutError,
  CFOFinancialEngineError,
  isAbortError,
} from "./errors";
import {
  registerActiveRequest,
  completeIdempotentRequest,
  getIdempotentResult,
  releaseIdempotentRequest,
} from "./idempotency";
import { recordAIRequestSuccess, recordAIRequestFallback, recordAIRequestError } from "./metrics";
import type { ProcessCFORequestOptions, ProcessCFORequestResult } from "./types";

async function getLatestSnapshotId(userId: string): Promise<string> {
  const latest = await prisma.financialStateSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return latest?.id ?? "";
}

async function executeToolsForIntent(
  userId: string,
  intent: FinancialAssistantIntent,
  params: Record<string, unknown>,
  snapshot: Awaited<ReturnType<typeof getEngineSnapshot>>,
  snapshotId: string,
  signal?: AbortSignal
): Promise<ToolExecutionRecord[]> {
  const records: ToolExecutionRecord[] = [];

  async function run<T>(
    toolName: string,
    args: Record<string, unknown>,
    fn: () => Promise<{
      data: T;
      warnings: string[];
      assumptions: string[];
      calculatedAt: string;
      sourceSnapshotId: string;
    }>
  ) {
    const start = Date.now();
    const result = await withTimeout(
      fn(),
      PIPELINE_TIMEOUTS.financialTool,
      `financial_tool:${toolName}`,
      signal
    );
    records.push({
      toolName,
      arguments: args,
      result,
      durationMs: Date.now() - start,
    });
  }

  await run("getCurrentFinancialState", {}, () =>
    getCurrentFinancialState(userId, snapshot, snapshotId)
  );
  await run("getUpcomingObligations", { count: 3 }, () =>
    getUpcomingObligations(userId, snapshot, snapshotId, 3)
  );

  switch (intent) {
    case "SAFE_TO_SPEND": {
      const parsed = safeToSpendParamsSchema.safeParse(params);
      const horizon = parsed.success ? parsed.data.horizon : "today";
      const h =
        horizon === "custom" ? "today" : horizon === "payday" ? "payday" : horizon;
      await run("calculateSafeToSpend", { horizon: h }, () =>
        calculateSafeToSpend(
          userId,
          snapshot,
          snapshotId,
          h as "today" | "week" | "month" | "payday"
        )
      );
      break;
    }
    case "CAN_I_AFFORD": {
      const parsed = canAffordParamsSchema.safeParse(params);
      const amount = parsed.success ? parsed.data.amount : undefined;
      const name =
        parsed.success && parsed.data.purchaseName
          ? parsed.data.purchaseName
          : "Purchase";
      if (amount && amount > 0) {
        if (parsed.data?.isBusiness) {
          await run("simulateBusinessPurchase", { name, amount }, () =>
            simulateBusinessPurchase({
              userId,
              snapshot,
              snapshotId,
              businessEntityName:
                (params.businessEntityName as string | undefined) ?? name,
              amount,
              category:
                (params.category as string | undefined) ??
                (params.purchaseName as string | undefined) ??
                "GENERAL",
              purchaseDate: new Date(parsed.data?.purchaseDate ?? snapshot.asOfDate),
            })
          );
        } else {
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
      }
      await run("calculateSafeToSpend", { horizon: "today" }, () =>
        calculateSafeToSpend(userId, snapshot, snapshotId, "today")
      );
      break;
    }
    case "EXPLAIN_METRIC": {
      const parsed = explainMetricParamsSchema.safeParse({
        metricName: params.metricName ?? "safe_to_spend",
      });
      const metric = parsed.success ? parsed.data.metricName : "safe_to_spend";
      await run("explainMetric", { metricName: metric }, () =>
        explainMetric(userId, snapshot, snapshotId, metric)
      );
      break;
    }
    case "DEBT_PAYMENT":
      await run("calculateDebtPaymentOptions", params, () =>
        calculateDebtPaymentOptions(
          userId,
          snapshot,
          snapshotId,
          params.debtName as string | undefined
        )
      );
      break;
    case "CREDIT_UTILIZATION":
      await run("calculateCreditUtilization", {}, () =>
        calculateCreditUtilization(userId, snapshot, snapshotId)
      );
      break;
    case "OVERDRAFT_RISK":
      await run("detectOverdraftRisk", {}, () =>
        detectOverdraftRisk(userId, snapshot, snapshotId)
      );
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
        const amt = (params.amount as number) ?? 100;
        const purchaseLabel = (params.purchaseName as string) ?? "Purchase";
        await run("simulatePurchase", { name: purchaseLabel, amount: amt }, () =>
          simulatePurchase(userId, snapshot, snapshotId, {
            name: purchaseLabel,
            amount: amt,
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

export async function processCFORequest(
  params: ProcessCFORequestOptions
): Promise<ProcessCFORequestResult> {
  const requestId = params.requestId ?? crypto.randomUUID();
  const idempotencyKey = params.idempotencyKey ?? requestId;
  const logger = createStageLogger(requestId, params.userId);
  const startedAt = Date.now();
  let source: "AI" | "DETERMINISTIC_FALLBACK" = "AI";

  const cached = getIdempotentResult<ProcessCFORequestResult>(
    params.userId,
    idempotencyKey
  );
  if (cached) {
    logger.log("RESPONSE_SENT", { durationMs: 0 });
    return cached;
  }

  if (!registerActiveRequest(params.userId, idempotencyKey)) {
    throw new Error("duplicate_request");
  }

  try {
    return await withTimeout(
      processCFORequestInner(params, requestId, logger, () => {
        source = "DETERMINISTIC_FALLBACK";
      }),
      PIPELINE_TIMEOUTS.totalRequest,
      "total_request",
      params.signal
    ).then((result) => {
      result.source = source;
      completeIdempotentRequest(params.userId, idempotencyKey, result);
      recordAIRequestSuccess(Date.now() - startedAt);
      return result;
    });
  } catch (error) {
    releaseIdempotentRequest(params.userId, idempotencyKey);
    if (isAbortError(error)) {
      logger.log("REQUEST_CANCELLED");
      throw error;
    }
    if (error instanceof CFOTimeoutError) {
      logger.log("REQUEST_TIMED_OUT", { errorCategory: error.stage });
      recordAIRequestError("TIMEOUT");
    } else {
      logger.log("REQUEST_FAILED", {
        errorCategory: mapPipelineError(error).category,
      });
      recordAIRequestError(mapPipelineError(error).category);
    }
    throw error;
  } finally {
    clearStageTimestamps(requestId);
  }
}

async function processCFORequestInner(
  params: ProcessCFORequestOptions,
  requestId: string,
  logger: ReturnType<typeof createStageLogger>,
  markFallback: () => void
): Promise<ProcessCFORequestResult> {
  logger.log("REQUEST_RECEIVED");

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
      include: { messages: { orderBy: { createdAt: "asc" }, take: 12 } },
    });
    if (!conv) throw new Error("Conversation not found");
    priorSnapshotId = conv.financialSnapshotId ?? undefined;
    history = conv.messages.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 500),
    }));
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

  logger.log("SNAPSHOT_LOAD_STARTED");
  try {
    await withTimeout(
      getOrRecalculateFinancialState(params.userId),
      PIPELINE_TIMEOUTS.snapshotLoad,
      "snapshot_load",
      params.signal
    );
  } catch (error) {
    if (error instanceof CFOTimeoutError) {
      throw new CFOFinancialEngineError("Financial snapshot load timed out");
    }
    throw error;
  }
  const snapshot = await getEngineSnapshot(params.userId);
  const snapshotId = await getLatestSnapshotId(params.userId);
  const snapshotStale = !!priorSnapshotId && priorSnapshotId !== snapshotId;
  logger.log("SNAPSHOT_LOAD_COMPLETED");

  logger.log("DETERMINISTIC_PARSE_STARTED");
  let intentResult = await withTimeout(
    Promise.resolve(classifyIntentDeterministicFirst(params.question)),
    PIPELINE_TIMEOUTS.deterministicParse,
    "deterministic_parse",
    params.signal
  );
  logger.log("DETERMINISTIC_PARSE_COMPLETED", { intent: intentResult.intent });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  const skipAI = params.skipAI === true;
  const useOpenAI =
    !skipAI &&
    config.provider === "openai" &&
    Boolean(process.env.OPENAI_API_KEY) &&
    !shouldSkipAIClassification(intentResult);

  if (useOpenAI) {
    logger.log("AI_CLASSIFICATION_STARTED", { model: provider.model });
    try {
      const classified = await withTimeout(
        provider.classifyIntent({
          question: params.question,
          conversationHistory: history,
        }),
        PIPELINE_TIMEOUTS.aiClassification,
        "ai_classification",
        params.signal
      );
      if (classified.confidence > intentResult.confidence) {
        intentResult = classified;
      }
      totalPromptTokens += classified.usage?.promptTokens ?? 0;
      totalCompletionTokens += classified.usage?.completionTokens ?? 0;
      logger.log("AI_CLASSIFICATION_COMPLETED", { intent: intentResult.intent });
    } catch {
      intentResult = classifyIntentDeterministicFirst(params.question);
      logger.log("AI_CLASSIFICATION_COMPLETED", {
        intent: intentResult.intent,
        errorCategory: "AI_CLASSIFICATION_FALLBACK",
      });
    }
  }

  logger.log("TOOL_SELECTION_COMPLETED", { intent: intentResult.intent });

  logger.log("FINANCIAL_TOOL_STARTED", { toolName: intentResult.intent });
  const toolCalls = await executeToolsForIntent(
    params.userId,
    intentResult.intent,
    intentResult.extractedParams,
    snapshot,
    snapshotId,
    params.signal
  );
  logger.log("FINANCIAL_TOOL_COMPLETED");

  const context = buildSafeContext(snapshot, toolCalls);
  let response = buildFallbackResponse(intentResult.intent, snapshot, toolCalls);
  let fallbackReason: string | undefined;

  if (snapshotStale) {
    response.warnings.push(
      "Your financial data has changed since this conversation started. Recalculate for the latest numbers."
    );
  }

  if (useOpenAI) {
    logger.log("AI_EXPLANATION_STARTED", { model: provider.model });
    try {
      const enhanced = await withTimeout(
        enhanceWithLLM(
          provider,
          params.question,
          JSON.stringify(context),
          response
        ),
        PIPELINE_TIMEOUTS.aiExplanation,
        "ai_explanation",
        params.signal
      );
      response = validateResponse(enhanced);
      totalPromptTokens += 500;
      totalCompletionTokens += 300;
      logger.log("AI_EXPLANATION_COMPLETED");
    } catch (error) {
      markFallback();
      recordAIRequestFallback();
      logger.log("FALLBACK_STARTED", {
        errorCategory: mapPipelineError(error).category,
      });
      const fb = buildDeterministicFallback(
        params.question,
        intentResult.intent,
        snapshot,
        toolCalls,
        snapshot.asOfDate,
        mapPipelineError(error).message
      );
      response = fb.response;
      fallbackReason = fb.fallback.answer;
      logger.log("FALLBACK_COMPLETED");
    }
  } else {
    response = validateResponse(response);
    if (skipAI || !process.env.OPENAI_API_KEY) {
      markFallback();
      recordAIRequestFallback();
    }
  }

  logger.log("VALIDATION_STARTED");
  const parsed = cfoAssistantResponseSchema.safeParse(response);
  if (!parsed.success) {
    markFallback();
    recordAIRequestFallback();
    logger.log("FALLBACK_STARTED", { errorCategory: "VALIDATION_FAILED" });
    const fb = buildDeterministicFallback(
      params.question,
      intentResult.intent,
      snapshot,
      toolCalls,
      snapshot.asOfDate
    );
    response = fb.response;
    fallbackReason = fb.fallback.answer;
    logger.log("FALLBACK_COMPLETED");
  }
  logger.log("VALIDATION_COMPLETED");

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
      content: response.compact?.advice ?? response.answer,
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
        requestId,
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

  logger.log("RESPONSE_SENT");

  const fb = fallbackReason
    ? buildDeterministicFallback(
        params.question,
        intentResult.intent,
        snapshot,
        toolCalls,
        snapshot.asOfDate,
        fallbackReason
      ).fallback
    : undefined;

  return {
    conversationId: conversationId!,
    messageId: assistantMessage.id,
    response,
    intent: intentResult.intent,
    snapshotId,
    snapshotStale,
    toolCalls,
    requestId,
    source: fb ? "DETERMINISTIC_FALLBACK" : "AI",
    fallback: fb,
  };
}
