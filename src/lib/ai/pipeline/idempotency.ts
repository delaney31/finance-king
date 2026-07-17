const recentKeys = new Map<string, { expiresAt: number; result?: unknown }>();
const TTL_MS = 60_000;

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of recentKeys) {
    if (entry.expiresAt < now) recentKeys.delete(key);
  }
}

export function buildIdempotencyKey(userId: string, key: string): string {
  return `${userId}:${key}`;
}

export function isDuplicateRequest(userId: string, idempotencyKey: string): boolean {
  pruneExpired();
  const composite = buildIdempotencyKey(userId, idempotencyKey);
  const entry = recentKeys.get(composite);
  return entry != null && entry.expiresAt > Date.now() && entry.result === undefined;
}

export function registerActiveRequest(userId: string, idempotencyKey: string): boolean {
  pruneExpired();
  const composite = buildIdempotencyKey(userId, idempotencyKey);
  if (isDuplicateRequest(userId, idempotencyKey)) return false;
  recentKeys.set(composite, { expiresAt: Date.now() + TTL_MS });
  return true;
}

export function completeIdempotentRequest(
  userId: string,
  idempotencyKey: string,
  result: unknown
): void {
  const composite = buildIdempotencyKey(userId, idempotencyKey);
  recentKeys.set(composite, { expiresAt: Date.now() + TTL_MS, result });
}

export function getIdempotentResult<T>(userId: string, idempotencyKey: string): T | undefined {
  pruneExpired();
  const composite = buildIdempotencyKey(userId, idempotencyKey);
  const entry = recentKeys.get(composite);
  if (entry?.result != null) return entry.result as T;
  return undefined;
}

export function releaseIdempotentRequest(userId: string, idempotencyKey: string): void {
  const composite = buildIdempotencyKey(userId, idempotencyKey);
  recentKeys.delete(composite);
}
