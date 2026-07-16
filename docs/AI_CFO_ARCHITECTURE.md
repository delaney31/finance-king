# Ask My CFO — Architecture

## Principle

**Finance King performs the math. The AI explains the math, answers questions, simulates choices, and recommends the safest next action.**

The LLM is never the primary calculator. All balances, safe-to-spend, projections, debt math, and risk detection flow through the deterministic financial engine in `src/lib/engine/`.

## Request Flow

```
User question
    → Intent classifier (structured JSON)
    → Zod-validated tool arguments
    → Financial tools (engine wrappers)
    → Structured tool results + snapshot ID
    → Safe context builder (minimum PII)
    → LLM explanation layer (or rules fallback)
    → Zod-validated CFOAssistantResponse
    → UI result cards
```

## Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| UI | `src/components/cfo/` | Panel, result cards, suggested questions |
| API | `src/app/api/v1/cfo/` | Auth, rate limits, conversation persistence |
| Orchestrator | `src/lib/ai/orchestrator.ts` | Pipeline coordination |
| Intent | `src/lib/ai/intent-classifier.ts` | Map questions → intents |
| Tools | `src/lib/ai/tools/` | Engine-backed calculations |
| Context | `src/lib/ai/context-builder.ts` | Sanitized prompt context |
| Provider | `src/lib/ai/providers/` | OpenAI + rules-based fallback |
| Engine | `src/lib/engine/` | Source of truth for all math |

## Snapshot Binding

Every AI answer references a `FinancialStateSnapshot` created at request time via `recalculateFinancialState`. Stale conversations compare snapshot timestamps and prompt recalculation.

## Data Boundaries

**Never sent to the model:** full account numbers, routing numbers, card numbers, SSNs, raw uploads, auth tokens, unrelated transactions.

**Always from tools:** balances, safe-to-spend, purchase simulation, debt options, overdraft risk.

## Provider Abstraction

```ts
interface AIProvider {
  classifyIntent(input: IntentRequest): Promise<IntentResult>;
  generateStructuredResponse<T>(request: StructuredAIRequest<T>): Promise<T>;
}
```

Configured via `AI_PROVIDER`, `AI_MODEL`, `AI_TEMPERATURE`, `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, `AI_RETRY_COUNT`.

When no API key is configured, `RulesBasedProvider` handles intent classification and generates deterministic explanations from tool output.

## Phases

- **Phase 1 (this PR):** Provider, intents, tools, safe-to-spend, can-I-afford, explain-metric, UI, tests
- **Phase 2:** Debt, overdraft, income delay, monthly review, conversation history, feedback
- **Phase 3:** Proactive briefing, goal coaching, subscription limits
