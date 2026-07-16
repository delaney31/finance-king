# Financial State Refresh Flow

## Event

```ts
type FinancialStateChangedEvent = {
  userId: string;
  previousSnapshotId: string;
  newSnapshotId: string;
  reason: string;
  changedEntityIds: string[];
};
```

Published client-side after successful `applyCFODataCommand`.

## Client behavior

1. Show "Updating your finances…" during apply
2. On success, dispatch `financial-state-changed` custom event
3. `FinancialStateProvider` refetches `/api/v1/financial-state`
4. Dashboard client sections subscribed to context update
5. Prior AI answers marked stale (`snapshotStale: true`)

## Server behavior

- Apply handler returns full new snapshot in response (reduces flicker)
- `router.refresh()` called on dashboard after mutation for SSR pages

## No optimistic balance updates

Balances update only after server confirmation.

## Cache keys (if using TanStack Query)

```ts
["financial-state"]
["accounts"]
["dashboard"]
["calendar-forecast"]
["credit-summary"]
["alerts"]
```

Finance King uses `FinancialStateProvider` + `router.refresh()` for SSR compatibility without requiring React Query on every page.
