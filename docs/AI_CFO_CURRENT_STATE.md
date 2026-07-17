# Ask My CFO — Current State (Post-Hardening)

## Request Entry Point

**Client:** `AskMyCfoPanel` → `useCfoRequest.sendQuestion()` → `POST /api/v1/cfo/ask`

**Server:** `src/app/api/v1/cfo/ask/route.ts` → `processCFOQuestion()` → `processCFORequest()`

## Client Request Method

- `fetch` with JSON body (not streaming)
- `AbortController` signal (45s client timeout)
- `idempotencyKey` per submission
- State machine: `IDLE` → `SENDING` → … → `COMPLETE` | `ERROR` | `TIMED_OUT` | `CANCELLED`

## API Route

`POST /api/v1/cfo/ask` with schema:

```ts
{ message, conversationId?, idempotencyKey, skipAI? }
```

Legacy `POST /api/v1/cfo/conversations` still works via `processCFOQuestion`.

## Auth Lookup

`auth()` from `@/lib/auth` in API route. Unauthorized → 401 with structured error.

## Financial Snapshot Lookup

`getOrRecalculateFinancialState(userId)` with 8s timeout, then `getEngineSnapshot(userId)`.

Previously: unconditional `recalculateFinancialState()` on every message (removed — caused latency).

## Intent Parsing

1. **Deterministic** (`pipeline/deterministic-parse.ts`) — regex patterns, confidence 0.92
2. **Rules-based** (`providers/rules-based.ts`) — fallback patterns
3. **OpenAI** — only if confidence < 0.85 and key configured (12s timeout)

Pacific Luxe question matches deterministic `CAN_I_AFFORD` without AI.

## Financial Tool Execution

`executeToolsForIntent()` with 10s timeout per tool.

Business purchases use `simulateBusinessPurchase()` → wraps `simulatePurchase(isBusiness: true)`.

## OpenAI Call

- `classifyIntent` — optional, skipped when deterministic confident
- `enhanceWithLLM` — optional, 30s timeout, falls back to deterministic response on failure

## Validation

`cfoAssistantResponseSchema` (Zod). Failure → rebuild from `buildDeterministicFallback()`.

## Response Return

JSON: `{ success, requestId, source, answer, conversationId, messageId, snapshotId }`

## Loading State Logic

Client uses `CFORequestState` enum, not boolean. `finally` always clears active request ref.

Progress labels rotate every 2.5s. Slow warning at 15s with Cancel / Finance King only.

## Known Failure Points (Addressed)

| Issue | Fix |
|-------|-----|
| Fetch hangs forever | Client AbortController 45s |
| Server hangs on OpenAI | Per-stage + total timeouts |
| OpenAI classify on obvious questions | Deterministic-first, skip AI |
| recalculate on every message | getOrRecalculateFinancialState |
| No fallback on AI failure | buildDeterministicFallback |
| Duplicate clicks | idempotency + isActive guard |
| Stale responses | activeClientRequestRef check |

## Streaming

**Not used.** JSON only. Render buffering not a factor.

## Unresolved Promises

All async paths wrapped in `withTimeout` or caught. `processCFORequest` `finally` clears stage timestamps.

## Render Deployment

- `maxDuration = 60` on ask route
- Health at `/api/health`
- Env: `OPENAI_API_KEY`, `AI_PROVIDER`, `DATABASE_URL`, `AUTH_SECRET`
