# Natural Financial Command Spec

## VoiceFinancialIntent

```
RECORD_EXPENSE | RECORD_INCOME | RECORD_PAYMENT | RECORD_REFUND
RECORD_TRANSFER | UPDATE_ACCOUNT_BALANCE | UPDATE_CREDIT_CARD_BALANCE
MARK_TRANSACTION_CLEARED | MARK_TRANSACTION_PENDING | MARK_BILL_PAID
SCHEDULE_TRANSACTION | CREATE_BILL | UPDATE_BILL | CREATE_PAYEE | UNKNOWN
```

## VoiceFinancialCommand

Validated with Zod. See `src/lib/voice-financial/schemas.ts`.

## Parsing pipeline

1. Normalize message (`normalizeCfoMessage`)
2. Parse spoken amounts and dates
3. Detect intent from patterns
4. Extract payee, accounts, status, category
5. Resolve accounts via alias system (with context boost)
6. Match payees from Payee table
7. Return command with `missingFields` and `warnings`

## Pattern examples

| Utterance | Intent | Key fields |
|-----------|--------|------------|
| I paid Victor $500 from PenFed | RECORD_EXPENSE | payee, amount, source |
| I paid $1,200 to State Farm | RECORD_EXPENSE | payee, amount (context account) |
| Transfer $2,900 from PenFed to Wells | RECORD_TRANSFER | amount, source, dest |
| The $5,000 paycheck came into PenFed | RECORD_INCOME | amount, dest |
| I paid the mortgage from Wells | RECORD_PAYMENT | payee=mortgage, source |
| Pacific Luxe paid $500 to Google for advertising | RECORD_EXPENSE | business scope |
| I spent $85 at Nobu from my personal account | RECORD_EXPENSE | merchant, amount |
| Update Mercury to $5,200 | UPDATE_ACCOUNT_BALANCE | dest, amount |
| My Amex balance is now $10,000 | UPDATE_CREDIT_CARD_BALANCE | dest, amount |
| Mark the mortgage paid | MARK_BILL_PAID | bill |
| Add pending $900 tax payment for Friday | SCHEDULE_TRANSACTION | pending, date |

## Context account

When `contextAccountId` is set:
- Boost that account +50 in resolution
- Default source account if not specified
- Do not ask "which account?" unless ambiguous or explicit override

## Account override warning

If context is PenFed but user says "from Wells Fargo", add warning:
"You started from PenFed Checking, but I heard 'from Wells Fargo.' Use Wells Fargo instead?"

## Missing fields

Ask only for missing detail. Preserve parsed payee, amount, date while clarifying.
