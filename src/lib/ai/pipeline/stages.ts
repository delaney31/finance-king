export type CFORequestStage =
  | "REQUEST_RECEIVED"
  | "AUTH_STARTED"
  | "AUTH_COMPLETED"
  | "SNAPSHOT_LOAD_STARTED"
  | "SNAPSHOT_LOAD_COMPLETED"
  | "DETERMINISTIC_PARSE_STARTED"
  | "DETERMINISTIC_PARSE_COMPLETED"
  | "AI_CLASSIFICATION_STARTED"
  | "AI_CLASSIFICATION_COMPLETED"
  | "TOOL_SELECTION_COMPLETED"
  | "FINANCIAL_TOOL_STARTED"
  | "FINANCIAL_TOOL_COMPLETED"
  | "AI_EXPLANATION_STARTED"
  | "AI_EXPLANATION_COMPLETED"
  | "VALIDATION_STARTED"
  | "VALIDATION_COMPLETED"
  | "FALLBACK_STARTED"
  | "FALLBACK_COMPLETED"
  | "RESPONSE_SENT"
  | "REQUEST_FAILED"
  | "REQUEST_CANCELLED"
  | "REQUEST_TIMED_OUT";

export type CFOStageLog = {
  requestId: string;
  userId?: string;
  stage: CFORequestStage;
  timestamp: string;
  durationMs?: number;
  intent?: string;
  toolName?: string;
  model?: string;
  errorCategory?: string;
};

const stageTimestamps = new Map<string, Partial<Record<CFORequestStage, number>>>();

export function markStageStart(requestId: string, stage: CFORequestStage): void {
  const entry = stageTimestamps.get(requestId) ?? {};
  entry[stage] = Date.now();
  stageTimestamps.set(requestId, entry);
}

export function getStageDuration(requestId: string, stage: CFORequestStage): number | undefined {
  const entry = stageTimestamps.get(requestId);
  const start = entry?.[stage];
  return start != null ? Date.now() - start : undefined;
}

export function clearStageTimestamps(requestId: string): void {
  stageTimestamps.delete(requestId);
}

export function logCFOStage(log: CFOStageLog): void {
  const payload = {
    ...log,
    service: "ask-my-cfo",
  };
  if (process.env.NODE_ENV === "development") {
    console.info("[CFO]", JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

export function createStageLogger(requestId: string, userId?: string) {
  let lastStageTime = Date.now();

  return {
    log(
      stage: CFORequestStage,
      extras?: Partial<Pick<CFOStageLog, "intent" | "toolName" | "model" | "errorCategory" | "durationMs">>
    ) {
      const now = Date.now();
      const durationMs = extras?.durationMs ?? now - lastStageTime;
      lastStageTime = now;
      markStageStart(requestId, stage);
      logCFOStage({
        requestId,
        userId,
        stage,
        timestamp: new Date().toISOString(),
        durationMs,
        ...extras,
      });
    },
    getStages(): CFOStageLog[] {
      return [];
    },
  };
}
