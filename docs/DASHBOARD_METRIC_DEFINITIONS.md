# Dashboard Metric Definitions

## Total liquid cash

Sum of **confirmed current balances** for liquid deposit accounts (checking, savings, money market). Excludes credit cards, loans, and investment accounts unless marked liquid.

## Cleared vs pending

- **Cleared liquid cash**: uses `availableBalance` when set, else `currentBalance`
- **Pending cash**: sum of `pendingBalance` on liquid accounts
- **Total liquid cash**: sum of `currentBalance` on liquid deposit accounts (confirmed ledger balances)

## Protected emergency reserve

Amount designated as protected emergency savings (`routingTag = EMERGENCY` or emergency goal current amount).

## Personal operating cash

Liquid cash in **personal** accounts only (`routingTag = PERSONAL`), minus per-account `protectedBalance`. Does **not** include emergency savings, business accounts, or joint property accounts.

## Business operating cash

Liquid cash in business accounts (`JADESYSTEMS`, `PACIFIC_LUXE`), minus protected business reserves. Tax reserve accounts are reported separately.

## Property operating cash

Liquid cash in property/joint accounts (`NY_PROPERTY`).

## Tax reserve

Balances on accounts with `routingTag = TAX_RESERVE` or tax goal current amount.

## Safe to spend today

```
clearedPersonalLiquidCash
  - protectedPersonalReserves
  - requiredPersonalBills (before next reliable income)
  - personalMinimumAccountFloors
  - committedPersonalDebtPayments
  - approvedPersonalPlannedSpending
  - safetyMargin
```

Clamped to ≥ 0 for display. Shortfall preserved in `doNotSpendAmount` when negative internally.

Business cash does not inflate personal safe-to-spend unless a confirmed transfer/draw is recorded.

## Do not spend amount

When safe-to-spend calculation is negative before clamping, the absolute value is stored as `doNotSpendAmount`.
