# AI Financial Mutation Spec

## Two-step workflow

1. **Parse & preview** — `POST /api/v1/cfo/commands/parse`
2. **Confirm & apply** — `POST /api/v1/cfo/commands/apply`

The AI never silently mutates data.

## Supported intents

`UPDATE_ACCOUNT_BALANCE`, `UPDATE_PROTECTED_AMOUNT`, `CREATE_ACCOUNT`, `UPDATE_ACCOUNT_DETAILS`, `ADD_TRANSACTION`, `MARK_TRANSACTION_CLEARED`, `MARK_BILL_PAID`, `UPDATE_BILL`, `ADD_EXPECTED_INCOME`, `MARK_INCOME_RECEIVED`, `UPDATE_INCOME_DATE`, `TRANSFER_BETWEEN_ACCOUNTS`, `CREATE_CREDIT_CARD`, `UPDATE_CREDIT_CARD`, `CREATE_LOAN`, `UPDATE_LOAN`, `UNKNOWN`

## Command schema

See `src/lib/ai/commands/schemas.ts` — validated with Zod.

## Account matching

Resolve by nickname, institution, last four, account type, ownership. If ambiguous, return `missingFields` and a clarification question — never guess.

## Apply flow

`applyCFODataCommand(userId, command)`:

1. Auth + ownership check
2. Zod validation
3. Prisma transaction: update records + balance snapshot + audit log
4. `recalculateFinancialState`
5. Return `CFOUpdateResult` with metric deltas

## Undo

Audit records store `previousValues`. `POST /api/v1/cfo/commands/undo` restores prior values and recalculates.

## Post-update response

Show metric changes and confirm all dashboard elements refresh via `FinancialStateChangedEvent`.
