import { CFOTimeoutError } from "./errors";

export const PIPELINE_TIMEOUTS = {
  auth: 5_000,
  snapshotLoad: 8_000,
  deterministicParse: 3_000,
  aiClassification: 12_000,
  financialTool: 10_000,
  aiExplanation: 30_000,
  validation: 5_000,
  totalRequest: 45_000,
} as const;

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  signal?: AbortSignal
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new CFOTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      promise,
      timeoutPromise,
      new Promise<never>((_, reject) => {
        if (!signal) return;
        if (signal.aborted) {
          reject(new DOMException("Request aborted", "AbortError"));
          return;
        }
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Request aborted", "AbortError")),
          { once: true }
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
