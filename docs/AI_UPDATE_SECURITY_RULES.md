# AI Update Security Rules

## Never sent to the model

- Full account numbers
- Routing numbers
- Card numbers (only last four)
- SSNs or tax IDs
- Authentication secrets

## Model receives

- Account nicknames
- Institution names
- Account type and ownership designation
- Last four digits when available
- Amounts needed for the specific command

## Mutation boundary

The LLM produces structured **intent + parameters**. Only validated server handlers in `applyCFODataCommand` touch the database. No raw SQL or arbitrary Prisma queries from AI output.

## Confirmation required

Every mutation shows a preview card with before/after values. User must click Confirm.

## Audit trail

Each applied command logs: user, timestamp, original message, parsed command, previous/new values, snapshot ids, provider name, confirmation time.

## Rollback

Failed transactions roll back entirely. Undo restores prior audited values.
