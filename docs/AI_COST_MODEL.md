# AI Cost Model — Ask My CFO

## Controls

| Control | Implementation |
|---------|----------------|
| Per-user daily limit | `AI_DAILY_REQUEST_LIMIT` (default 50) |
| Token logging | `AIUsageRecord` per request |
| Estimated cost | `promptTokens × inputRate + completionTokens × outputRate` |
| Monthly report cache | Same snapshot + month → skip LLM |
| Calculation reuse | Snapshot-bound tool results cached per conversation turn |
| Short context | Context builder sends only relevant accounts/bills |
| Summarized history | Last 6 messages, truncated to 500 chars each |
| Rate limiting | Daily limit check before orchestrator |
| Streaming | SSE endpoint for progressive UI (Phase 1: non-streaming with loading states) |

## Default Model Pricing (estimates)

| Provider | Model | Input / 1M tokens | Output / 1M tokens |
|----------|-------|-------------------|---------------------|
| openai | gpt-4o-mini | $0.15 | $0.60 |
| rules | n/a | $0 | $0 |

## When NOT to Call AI

- Dashboard page load
- Balance/chart rendering
- Obvious deterministic transaction categorization
- Cached explanation for same snapshot + question hash

## Estimated Cost per Active User

Assuming 10 questions/day, ~2K prompt + 500 completion tokens per question on gpt-4o-mini:

~$0.003/day/user ≈ **$0.09/month/user**

Rules-based fallback: **$0**
