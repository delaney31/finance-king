type AIMetricsState = {
  lastSuccessAt?: string;
  lastErrorCategory?: string;
  recentLatenciesMs: number[];
  fallbackCount: number;
  requestCount: number;
  errorCount: number;
};

const metrics: AIMetricsState = {
  recentLatenciesMs: [],
  fallbackCount: 0,
  requestCount: 0,
  errorCount: 0,
};

const MAX_LATENCIES = 50;

export function recordAIRequestSuccess(durationMs: number): void {
  metrics.requestCount += 1;
  metrics.lastSuccessAt = new Date().toISOString();
  metrics.recentLatenciesMs.push(durationMs);
  if (metrics.recentLatenciesMs.length > MAX_LATENCIES) {
    metrics.recentLatenciesMs.shift();
  }
}

export function recordAIRequestFallback(): void {
  metrics.fallbackCount += 1;
}

export function recordAIRequestError(category: string): void {
  metrics.errorCount += 1;
  metrics.lastErrorCategory = category;
}

export function getAIMetrics() {
  const avgLatency =
    metrics.recentLatenciesMs.length > 0
      ? metrics.recentLatenciesMs.reduce((a, b) => a + b, 0) /
        metrics.recentLatenciesMs.length
      : null;

  const fallbackRate =
    metrics.requestCount > 0
      ? metrics.fallbackCount / metrics.requestCount
      : 0;

  return {
    ...metrics,
    averageRecentLatencyMs: avgLatency,
    fallbackRate,
  };
}
