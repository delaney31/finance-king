# AI Timeout and Fallback Spec

## Stage Timeouts

| Stage | Limit |
|-------|-------|
| Authentication | 5s |
| Financial snapshot load | 8s |
| Deterministic intent parsing | 3s |
| AI intent classification | 12s |
| Financial tool execution | 10s per tool |
| AI explanation generation | 30s |
| Structured-output validation | 5s |
| **Total request** | **45s** |

Implementation: `src/lib/ai/pipeline/timeout.ts` → `withTimeout()`

## Client Timeouts

| Event | Timing |
|-------|--------|
| Slow warning UI | 15s |
| AbortController abort | 45s |
| State machine always exits active state | `finally` block |

## Fallback Triggers

Fallback is used when:

- OpenAI API key missing
- `skipAI: true` from client ("Finance King only")
- AI classification fails → rules-based intent
- AI explanation times out or errors
- Response schema validation fails
- Deterministic parse confidence ≥ 0.85 → skip AI classify entirely

## Fallback Content

Built by `buildDeterministicFallback()`:

- Verdict from engine recommendation
- Headline with entity + amount (e.g. Pacific Luxe $500 advertising)
- Metrics from compact presenter
- Protection checks from engine
- Calculation lines from tool output

User always sees numbers if financial tools completed.

## Example: Pacific Luxe Advertising

Question: *"Can Pacific Luxe spend $500 on advertising?"*

1. Deterministic parse → `CAN_I_AFFORD`, amount=500, isBusiness=true
2. `simulateBusinessPurchase()` runs without OpenAI
3. If AI fails → fallback shows operating cash, floor, recommendation

## No Infinite Loading

Both server (`withTimeout` on total request) and client (`AbortController` 45s) guarantee termination.
