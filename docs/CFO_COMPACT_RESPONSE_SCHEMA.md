# CFO Compact Response Schema

Presentation-layer model derived from deterministic `CFOAssistantResponse` and tool results.

```ts
type CFOCompactAnswer = {
  question: string;
  verdict: "GO_AHEAD" | "GO_AHEAD_WITH_LIMIT" | "REDUCE_BUDGET" | "WAIT" | "NOT_YET" | "NEED_MORE_INFORMATION";
  headline: string;       // Display verdict text
  advice: string;         // Conversational guidance
  reason: string;         // One-sentence explanation
  status: "SAFE" | "CAUTION" | "RISK" | "UNKNOWN";
  primaryMetrics: Array<{ label: string; value: string; change?: string }>;
  protectionChecks: Array<{ label: string; status: "PASS" | "WARN" | "FAIL" }>;
  details: { ... };
  suggestedQuestions: string[];
};
```

## Mapping from engine

| Engine field | Compact field |
|--------------|---------------|
| `recommendation` | `verdict` (validated) |
| `safeToSpendToday` | Metric "Safe today" |
| `recommendedAmount` + balance after | Metric "After …" |
| `emergencyReserveAffected` | Protection check |
| `supportingCalculations` | `details.supportingCalculations` |
| `assumptions` | `details.assumptions` |

Technical `intent` is never exposed in compact output.

## Storage

`CFOAssistantResponse.compact?: CFOCompactAnswer` attached server-side in orchestrator.
