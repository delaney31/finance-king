import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, PIPELINE_TIMEOUTS } from "../timeout";
import { CFOTimeoutError } from "../errors";
import {
  parseDeterministicIntent,
  classifyIntentDeterministicFirst,
  shouldSkipAIClassification,
} from "../deterministic-parse";
import { mapPipelineError, mapOpenAIError } from "../error-map";
import {
  isDuplicateRequest,
  registerActiveRequest,
  completeIdempotentRequest,
  getIdempotentResult,
} from "../idempotency";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when promise completes in time", async () => {
    const p = withTimeout(Promise.resolve(42), 1000, "test");
    await expect(p).resolves.toBe(42);
  });

  it("rejects with CFOTimeoutError when exceeded", async () => {
    const p = withTimeout(
      new Promise((resolve) => setTimeout(() => resolve(1), 5000)),
      100,
      "test_stage"
    );
    vi.advanceTimersByTime(150);
    await expect(p).rejects.toBeInstanceOf(CFOTimeoutError);
  });

  it("rejects on abort signal", async () => {
    const controller = new AbortController();
    const p = withTimeout(
      new Promise((resolve) => setTimeout(() => resolve(1), 5000)),
      10000,
      "test",
      controller.signal
    );
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("deterministic parse", () => {
  it("parses Pacific Luxe advertising question", () => {
    const result = parseDeterministicIntent(
      "Can Pacific Luxe spend $500 on advertising?"
    );
    expect(result?.intent).toBe("CAN_I_AFFORD");
    expect(result?.extractedParams.amount).toBe(500);
    expect(result?.extractedParams.isBusiness).toBe(true);
    expect(result?.extractedParams.purchaseName).toMatch(/advertising/i);
  });

  it("skips AI when confidence high", () => {
    const result = classifyIntentDeterministicFirst(
      "How much can I safely spend today?"
    );
    expect(shouldSkipAIClassification(result)).toBe(true);
  });
});

describe("error map", () => {
  it("maps timeout to user message", () => {
    const mapped = mapOpenAIError(new CFOTimeoutError("ai_explanation", 30000));
    expect(mapped.category).toBe("AI_TIMEOUT");
    expect(mapped.retryable).toBe(true);
  });

  it("maps missing API key", () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const mapped = mapOpenAIError(new Error("failed"));
    expect(mapped.category).toBe("AI_CONFIGURATION");
    if (prev) process.env.OPENAI_API_KEY = prev;
  });
});

describe("idempotency", () => {
  it("blocks duplicate active requests", () => {
    const userId = "user-1";
    const key = "key-abc";
    expect(registerActiveRequest(userId, key)).toBe(true);
    expect(isDuplicateRequest(userId, key)).toBe(true);
    expect(registerActiveRequest(userId, key)).toBe(false);
  });

  it("returns cached result after completion", () => {
    const userId = "user-2";
    const key = "key-xyz";
    registerActiveRequest(userId, key);
    completeIdempotentRequest(userId, key, { answer: "ok" });
    expect(getIdempotentResult<{ answer: string }>(userId, key)?.answer).toBe("ok");
  });
});

describe("pipeline timeouts config", () => {
  it("total request is 45 seconds", () => {
    expect(PIPELINE_TIMEOUTS.totalRequest).toBe(45_000);
  });
});
