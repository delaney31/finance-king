# Account Activity Log Spec

## Purpose

Every account has a chronological activity timeline showing all events that change or may affect the account.

## AccountActivityEvent

Stored in `AccountActivityEvent` table. See Prisma schema.

## Event types

- ACCOUNT_CREATED, BALANCE_UPDATED, TRANSACTION_ADDED, TRANSACTION_UPDATED, TRANSACTION_DELETED
- INCOME_RECORDED, EXPENSE_RECORDED, PAYMENT_RECORDED
- TRANSFER_SENT, TRANSFER_RECEIVED, BILL_PAID, PENDING_CLEARED
- SCREENSHOT_IMPORTED, VOICE_COMMAND_APPLIED
- PROTECTED_AMOUNT_CHANGED, MINIMUM_FLOOR_CHANGED, ACCOUNT_DETAILS_CHANGED
- IMPORT_UNDONE, CHANGE_UNDONE

## Sources

`VOICE | AI_CHAT | MANUAL | SCREENSHOT | SYSTEM | IMPORT`

## Required fields per event

- userId, accountId, eventType, timestamp, effectiveDate, description, source, auditLogId
- Optional: previousBalance, newBalance, amount, transactionId, payee, category, originalTranscript

## UI (account detail page)

```
Today
State Farm payment          -$1,200    Voice update
Balance: $24,032 → $22,832
```

### Filters

All | Income | Spending | Transfers | Balance updates | Voice | Imports | System

### Search

Payee, amount, category, date, source, description

## Creation

Every `applyVoiceFinancialCommand` call creates activity events for all affected accounts.
