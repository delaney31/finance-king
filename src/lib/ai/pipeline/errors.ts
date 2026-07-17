export class CFOTimeoutError extends Error {
  constructor(
    public stage: string,
    public timeoutMs: number
  ) {
    super(`${stage} timed out after ${timeoutMs}ms`);
    this.name = "CFOTimeoutError";
  }
}

export class CFOProviderError extends Error {
  constructor(
    message: string,
    public category: string
  ) {
    super(message);
    this.name = "CFOProviderError";
  }
}

export class CFOValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CFOValidationError";
  }
}

export class CFOFinancialEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CFOFinancialEngineError";
  }
}

export class CFOConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CFOConfigurationError";
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof CFOTimeoutError;
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (error instanceof Error && error.name === "AbortError");
}
