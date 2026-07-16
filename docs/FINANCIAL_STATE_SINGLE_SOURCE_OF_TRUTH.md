# Financial State — Single Source of Truth

## Principle

Every number shown in Finance King — dashboard KPIs, charts, calendar forecasts, AI answers, alerts, and scenarios — must come from one recalculated `FinancialStateSnapshot`. No React component may compute totals independently.

## Pipeline

```
Prisma records
  → getEngineSnapshot(userId)
  → buildFinancialStateSnapshot(engineSnapshot)
  → prisma.financialStateSnapshot.create(...)
  → FinancialStateSnapshot (id + all metrics + calculationLines)
```

## Entry point

```ts
recalculateFinancialState(userId, options?): Promise<FinancialStateSnapshot>
```

Call this after:

- Dashboard load (read latest or recalculate if stale)
- AI CFO question
- Import confirm / undo
- AI-confirmed data mutation
- Manual account/bill/income update

## Consumers

| Consumer | Reads |
|----------|-------|
| Dashboard KPI cards | `snapshot.safeToSpendToday`, `totalLiquidCash`, etc. |
| Dashboard charts | `snapshot.dashboard.scenarios`, projections |
| Ask My CFO | Latest snapshot id + engine for tools |
| Calendar | Same snapshot via API |
| Post-mutation UI | `FinancialStateChangedEvent` → refetch |

## Stale detection

AI messages store `financialSnapshotId`. When `latestSnapshot.id !== message.financialSnapshotId`, mark answer as based on older balances.

## Files

- `src/lib/financial-state/types.ts` — canonical snapshot type
- `src/lib/financial-state/build.ts` — metric computation
- `src/lib/financial-state/recalculate.ts` — persist + return
- `src/lib/financial-state/get-latest.ts` — read latest snapshot
