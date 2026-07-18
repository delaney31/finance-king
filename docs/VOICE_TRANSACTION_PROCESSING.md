# Voice Transaction Processing

## applyVoiceFinancialCommand

```ts
applyVoiceFinancialCommand(userId, command): Promise<VoiceFinancialUpdateResult>
```

Single database transaction:

1. Authenticate user (caller responsibility)
2. Validate command (Zod)
3. Resolve accounts and verify ownership
4. Create/update transactions
5. Update balances (expense: subtract, income: add, transfer: both sides)
6. Create balance snapshots
7. Create account activity events
8. Create audit log (immutable)
9. Update payee usage stats
10. Recalculate financial state
11. Return metric changes

## Balance rules

| Intent | Effect |
|--------|--------|
| RECORD_EXPENSE / RECORD_PAYMENT | sourceBalance -= amount |
| RECORD_INCOME / RECORD_REFUND | destBalance += amount |
| RECORD_TRANSFER | source -= amount, dest += amount (not income/expense) |
| UPDATE_ACCOUNT_BALANCE | set balance to amount |
| Credit card charge | card balance += amount |
| Credit card payment | checking -= amount, card balance -= amount |

## Internal transfers

- `isTransfer: true` on both transaction records
- Linked via `transferPairId`
- Do not affect total liquid cash

## Post-update

Dispatch `FINANCIAL_STATE_CHANGED_EVENT`. All UI reads from centralized financial state — no manual card updates.

## Rollback

On any failure within the transaction, full rollback. No partial state.
