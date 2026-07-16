export interface AIConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retryCount: number;
  dailyRequestLimit: number;
}

export function getAIConfig(): AIConfig {
  return {
    provider: process.env.AI_PROVIDER ?? "rules",
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    temperature: Number(process.env.AI_TEMPERATURE ?? "0.2"),
    maxTokens: Number(process.env.AI_MAX_TOKENS ?? "1500"),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? "30000"),
    retryCount: Number(process.env.AI_RETRY_COUNT ?? "1"),
    dailyRequestLimit: Number(process.env.AI_DAILY_REQUEST_LIMIT ?? "50"),
  };
}

export function estimateCostUsd(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  if (provider === "rules") return 0;
  if (provider === "openai" && model.includes("gpt-4o-mini")) {
    return (promptTokens * 0.15 + completionTokens * 0.6) / 1_000_000;
  }
  if (provider === "openai" && model.includes("gpt-4o")) {
    return (promptTokens * 2.5 + completionTokens * 10) / 1_000_000;
  }
  return (promptTokens * 0.5 + completionTokens * 1.5) / 1_000_000;
}
