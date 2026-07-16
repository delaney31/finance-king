# Financial Tool Specification

All tools return:

```ts
type FinancialToolResult<T> = {
  data: T;
  warnings: string[];
  assumptions: string[];
  calculatedAt: string;
  sourceSnapshotId: string;
};
```

Tools call `src/lib/engine/` — never duplicate formulas in the AI layer.

## Phase 1 Tools

| Tool | Engine Functions | Purpose |
|------|------------------|---------|
| `getCurrentFinancialState` | `buildDashboardSnapshot` | Dashboard KPIs |
| `calculateSafeToSpend` | `computeSafeToSpend`, `computeAllHorizons` | Horizon-based STS |
| `simulatePurchase` | `simulatePurchaseImpact` | Can-I-afford analysis |
| `explainMetric` | Engine breakdown helpers | Line-by-line KPI explanation |

## Phase 2 Tools

| Tool | Engine Functions | Purpose |
|------|------------------|---------|
| `calculateDebtPaymentOptions` | `buildAvalanchePlan`, `buildSnowballPlan` | Payoff strategies |
| `calculateCreditUtilization` | `computeUtilizationTargets` | Utilization thresholds |
| `detectOverdraftRisk` | `computeOverdraftRisk` | Account risk |
| `simulateIncomeDelay` | Scenario income shift | Delayed deposit impact |
| `forecastAccountBalances` | `projectDailyBalances` | Balance projection |
| `getUpcomingObligations` | Bills + debt payments | Next N obligations |
| `generateMonthlyFinancialReport` | Dashboard + aggregates | Monthly summary |
| `getRecommendedAccountForExpense` | Routing rules + balances | Account routing |

## Argument Validation

Every tool argument schema is defined in `src/lib/ai/schemas.ts` and validated with Zod before execution.

## Account Masking

Account references in tool output use `nickname` and `accountLastFour` only. Full numbers never appear in tool results destined for the model.
