import {
  CFOConfigurationError,
  CFOFinancialEngineError,
  CFOProviderError,
  CFOValidationError,
  CFOTimeoutError,
  isAbortError,
} from "./errors";

export type CFOErrorResponse = {
  category: string;
  message: string;
  retryable: boolean;
};

export function mapOpenAIError(error: unknown): CFOErrorResponse {
  if (isAbortError(error)) {
    return {
      category: "REQUEST_CANCELLED",
      message: "Request was cancelled.",
      retryable: true,
    };
  }

  if (error instanceof CFOTimeoutError) {
    return {
      category: "AI_TIMEOUT",
      message:
        "The AI explanation timed out. Here is the result from Finance King's financial engine.",
      retryable: true,
    };
  }

  if (error instanceof CFOConfigurationError) {
    return {
      category: "AI_CONFIGURATION",
      message:
        "AI configuration is incomplete. Finance King still completed the calculation.",
      retryable: false,
    };
  }

  if (error instanceof CFOValidationError) {
    return {
      category: "VALIDATION_FAILED",
      message:
        "I could not validate the AI response, so I'm showing the calculation directly.",
      retryable: true,
    };
  }

  if (error instanceof CFOFinancialEngineError) {
    return {
      category: "FINANCIAL_ENGINE",
      message: "I couldn't load your current financial snapshot. No records were changed.",
      retryable: true,
    };
  }

  if (error instanceof CFOProviderError) {
    return {
      category: error.category,
      message:
        "The AI service encountered an error. Finance King completed the calculation.",
      retryable: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (!process.env.OPENAI_API_KEY) {
    return {
      category: "AI_CONFIGURATION",
      message:
        "AI is not fully configured. Finance King's financial calculations are still available.",
      retryable: false,
    };
  }

  if (lower.includes("401") || lower.includes("invalid api key")) {
    return {
      category: "AI_AUTH",
      message:
        "AI configuration is incomplete. Finance King still completed the calculation.",
      retryable: false,
    };
  }

  if (lower.includes("429") || lower.includes("rate limit")) {
    return {
      category: "AI_RATE_LIMIT",
      message:
        "The AI service is temporarily busy. Your financial data was not changed.",
      retryable: true,
    };
  }

  if (lower.includes("insufficient_quota") || lower.includes("billing")) {
    return {
      category: "AI_QUOTA",
      message:
        "AI credits are unavailable. Finance King completed the calculation without AI prose.",
      retryable: false,
    };
  }

  if (lower.includes("model") && lower.includes("not found")) {
    return {
      category: "AI_MODEL",
      message:
        "AI model is misconfigured. Finance King still completed the calculation.",
      retryable: false,
    };
  }

  if (lower.includes("context length") || lower.includes("maximum context")) {
    return {
      category: "AI_CONTEXT",
      message:
        "The question was too long for AI explanation. Here is the Finance King calculation.",
      retryable: true,
    };
  }

  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("econnreset")) {
    return {
      category: "AI_NETWORK",
      message:
        "The AI service is temporarily unavailable. Your financial data was not changed.",
      retryable: true,
    };
  }

  return {
    category: "AI_UNKNOWN",
    message:
      "The AI explanation could not be completed. Finance King completed the calculation.",
    retryable: true,
  };
}

export function mapPipelineError(error: unknown): CFOErrorResponse {
  if (error instanceof CFOTimeoutError) {
    if (error.stage.includes("snapshot") || error.stage.includes("financial")) {
      return {
        category: "FINANCIAL_ENGINE_TIMEOUT",
        message: "Loading your financial data took too long. Please try again.",
        retryable: true,
      };
    }
    return mapOpenAIError(error);
  }

  if (error instanceof Error && error.message.includes("Daily AI request limit")) {
    return {
      category: "RATE_LIMIT",
      message: error.message,
      retryable: false,
    };
  }

  if (error instanceof Error && error.message.includes("duplicate")) {
    return {
      category: "DUPLICATE_REQUEST",
      message: "This question is already being processed.",
      retryable: false,
    };
  }

  return mapOpenAIError(error);
}
