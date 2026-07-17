"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CFOAssistantResponse } from "@/lib/ai/types";
import type { CFOFallbackResponse } from "@/lib/ai/pipeline/fallback";
import { isAbortError } from "@/lib/ai/pipeline/errors";

export type CFORequestState =
  | "IDLE"
  | "SENDING"
  | "LOADING_FINANCIAL_DATA"
  | "UNDERSTANDING_QUESTION"
  | "CALCULATING"
  | "GENERATING_EXPLANATION"
  | "USING_FALLBACK"
  | "COMPLETE"
  | "ERROR"
  | "TIMED_OUT"
  | "CANCELLED";

const CLIENT_TIMEOUT_MS = 45_000;
const SLOW_WARNING_MS = 15_000;

export const STATE_LABELS: Record<CFORequestState, string> = {
  IDLE: "",
  SENDING: "Sending your question…",
  LOADING_FINANCIAL_DATA: "Loading your latest confirmed balances…",
  UNDERSTANDING_QUESTION: "Understanding your question…",
  CALCULATING: "Checking cash and upcoming bills…",
  GENERATING_EXPLANATION: "Preparing a clear answer…",
  USING_FALLBACK: "Using Finance King calculation…",
  COMPLETE: "",
  ERROR: "",
  TIMED_OUT: "",
  CANCELLED: "",
};

export type CFOAskResult = {
  conversationId: string;
  messageId: string;
  response: CFOAssistantResponse;
  snapshotStale?: boolean;
  requestId: string;
  source: "AI" | "DETERMINISTIC_FALLBACK";
  fallback?: CFOFallbackResponse;
};

export function useCfoRequest() {
  const [state, setState] = useState<CFORequestState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [slowWarning, setSlowWarning] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const activeClientRequestRef = useRef<string | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = !["IDLE", "COMPLETE", "ERROR", "TIMED_OUT", "CANCELLED"].includes(state);

  const clearTimers = useCallback(() => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    if (clientTimeoutRef.current) clearTimeout(clientTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    slowTimerRef.current = null;
    clientTimeoutRef.current = null;
    progressIntervalRef.current = null;
  }, []);

  const cancelRequest = useCallback(() => {
    controllerRef.current?.abort();
    clearTimers();
    setState("CANCELLED");
    setActiveRequestId(null);
    activeClientRequestRef.current = null;
  }, [clearTimers]);

  const startProgress = useCallback(() => {
    const steps: CFORequestState[] = [
      "SENDING",
      "LOADING_FINANCIAL_DATA",
      "UNDERSTANDING_QUESTION",
      "CALCULATING",
      "GENERATING_EXPLANATION",
    ];
    let i = 0;
    setState(steps[0]);
    progressIntervalRef.current = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setState(steps[i]);
    }, 2500);
  }, []);

  const sendQuestion = useCallback(
    async (
      message: string,
      options?: {
        conversationId?: string;
        skipAI?: boolean;
        idempotencyKey?: string;
      }
    ): Promise<CFOAskResult | null> => {
      if (!message.trim()) return null;

      const clientRequestId = crypto.randomUUID();
      const idempotencyKey = options?.idempotencyKey ?? clientRequestId;

      if (activeClientRequestRef.current) return null;

      activeClientRequestRef.current = clientRequestId;
      setError(null);
      setSlowWarning(false);
      setActiveRequestId(clientRequestId);
      clearTimers();
      startProgress();

      const controller = new AbortController();
      controllerRef.current = controller;

      clientTimeoutRef.current = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
      slowTimerRef.current = setTimeout(() => setSlowWarning(true), SLOW_WARNING_MS);

      try {
        const res = await fetch("/api/v1/cfo/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message.trim(),
            conversationId: options?.conversationId,
            idempotencyKey,
            skipAI: options?.skipAI,
          }),
          signal: controller.signal,
        });

        const data = await res.json();

        if (activeClientRequestRef.current !== clientRequestId) return null;

        setLastRequestId(data.requestId ?? clientRequestId);

        if (!res.ok || !data.success) {
          const errMsg = data.error?.message ?? "Request failed";
          setError(errMsg);
          if (data.error?.category === "REQUEST_CANCELLED") {
            setState("CANCELLED");
          } else {
            setState("ERROR");
          }
          return null;
        }

        setState(data.source === "DETERMINISTIC_FALLBACK" ? "USING_FALLBACK" : "COMPLETE");

        return {
          conversationId: data.conversationId,
          messageId: data.messageId,
          response: data.answer,
          snapshotStale: data.snapshotStale,
          requestId: data.requestId,
          source: data.source,
          fallback: data.fallback,
        };
      } catch (err) {
        if (activeClientRequestRef.current !== clientRequestId) return null;

        if (isAbortError(err)) {
          const timedOut = slowWarning;
          setState(timedOut ? "TIMED_OUT" : "CANCELLED");
          setError(
            timedOut
              ? "This request timed out. Try again or use Finance King calculation only."
              : "Request was cancelled."
          );
        } else {
          setState("ERROR");
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
        return null;
      } finally {
        clearTimers();
        setActiveRequestId(null);
        activeClientRequestRef.current = null;
        controllerRef.current = null;
        setState((s) =>
          s === "SENDING" ||
          s === "LOADING_FINANCIAL_DATA" ||
          s === "UNDERSTANDING_QUESTION" ||
          s === "CALCULATING" ||
          s === "GENERATING_EXPLANATION"
            ? "COMPLETE"
            : s
        );
      }
    },
    [clearTimers, slowWarning, startProgress]
  );

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      clearTimers();
    };
  }, [clearTimers]);

  return {
    state,
    stateLabel: STATE_LABELS[state],
    error,
    slowWarning,
    isActive,
    activeRequestId,
    lastRequestId,
    sendQuestion,
    cancelRequest,
    setError,
    resetState: () => setState("IDLE"),
  };
}
