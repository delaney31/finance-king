import { prisma } from "@/lib/db";
import { getAIConfig } from "./config";

export async function checkDailyLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const config = getAIConfig();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const used = await prisma.aIUsageRecord.count({
    where: { userId, createdAt: { gte: startOfDay } },
  });

  return { allowed: used < config.dailyRequestLimit, used, limit: config.dailyRequestLimit };
}

export async function logUsage(params: {
  userId: string;
  conversationId?: string;
  intent?: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}) {
  const config = getAIConfig();
  const { estimateCostUsd } = await import("./config");
  const promptTokens = params.promptTokens ?? 0;
  const completionTokens = params.completionTokens ?? 0;

  await prisma.aIUsageRecord.create({
    data: {
      userId: params.userId,
      conversationId: params.conversationId,
      intent: params.intent,
      provider: params.provider ?? config.provider,
      model: params.model ?? config.model,
      promptTokens,
      completionTokens,
      estimatedCostUsd: estimateCostUsd(
        params.provider ?? config.provider,
        params.model ?? config.model,
        promptTokens,
        completionTokens
      ),
    },
  });
}

export async function getUsageSummary(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const config = getAIConfig();

  const [todayCount, monthRecords] = await Promise.all([
    prisma.aIUsageRecord.count({ where: { userId, createdAt: { gte: startOfDay } } }),
    prisma.aIUsageRecord.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      select: { estimatedCostUsd: true, promptTokens: true, completionTokens: true },
    }),
  ]);

  const monthCost = monthRecords.reduce((s, r) => s + Number(r.estimatedCostUsd), 0);
  const monthTokens = monthRecords.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0);

  return {
    todayRequests: todayCount,
    dailyLimit: config.dailyRequestLimit,
    monthEstimatedCostUsd: monthCost,
    monthTokens,
    remainingToday: Math.max(0, config.dailyRequestLimit - todayCount),
  };
}
