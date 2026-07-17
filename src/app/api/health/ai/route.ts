import { NextResponse } from "next/server";
import { getAIConfigStatus } from "@/lib/ai/pipeline/config-status";
import { getAIMetrics } from "@/lib/ai/pipeline/metrics";
import { getAIConfig } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getAIConfigStatus();
  const metrics = getAIMetrics();
  const aiConfig = getAIConfig();

  return NextResponse.json({
    status: "ok",
    providerConfigured: config.openaiKeyPresent || aiConfig.provider === "rules",
    modelConfigured: config.modelConfigured,
    model: aiConfig.model,
    provider: aiConfig.provider,
    lastSuccessfulAIRequest: metrics.lastSuccessAt ?? null,
    lastErrorCategory: metrics.lastErrorCategory ?? null,
    averageRecentLatencyMs: metrics.averageRecentLatencyMs,
    fallbackRate: metrics.fallbackRate,
    timestamp: new Date().toISOString(),
  });
}
