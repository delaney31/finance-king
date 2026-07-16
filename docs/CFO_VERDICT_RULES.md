# CFO Verdict Rules

Verdicts are derived from deterministic engine output and validated before display.

## Verdict mapping

| Engine `recommendation` | Default verdict |
|-------------------------|-----------------|
| `PROCEED` | `GO_AHEAD` |
| `PROCEED_WITH_LIMIT` | `GO_AHEAD_WITH_LIMIT` |
| `DELAY` | `WAIT` |
| `DECLINE` | `NOT_YET` |
| `INFORMATION_ONLY` | Context-dependent |

## Validation (cannot override engine safety)

1. If `recommendedAmount` &lt; `safeToSpendToday` AND emergency not affected AND bills covered → verdict **cannot** be `NOT_YET`
2. If purchase `canAffordCash === true` → verdict **cannot** be `NOT_YET`
3. If `canAffordCash === false` and would breach reserves → `NOT_YET` or `WAIT`
4. Missing amount for afford question → `NEED_MORE_INFORMATION`
5. Conflicts log to console in dev; safe fallback applied

## Status colors

| Status | Verdicts | Color |
|--------|----------|-------|
| `SAFE` | GO_AHEAD, GO_AHEAD_WITH_LIMIT | Green |
| `CAUTION` | REDUCE_BUDGET, WAIT | Yellow |
| `RISK` | NOT_YET | Red |
| `UNKNOWN` | NEED_MORE_INFORMATION | Gray |

## Language

Use advisor tone: "I'd keep it under $100" not "Recommendation: DECLINE".
