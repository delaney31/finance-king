# Finance King — Cash Flow Rules

Income recognition, transfer handling, account routing, and bill scheduling rules that drive the financial engine.

---

## 1. Overview

Finance King's cash flow model separates **personal**, **business**, and **joint** money flows. The engine uses these rules to project daily balances, compute safe-to-spend, and route income to the correct accounts.

**Core principle:** Income is recognized on `expectedDate` when status is `SCHEDULED`, and on `receivedDate` when status is `RECEIVED`. Transfers between accounts net to zero in aggregate liquid cash.

---

## 2. Account Routing Tags

Every `FinancialAccount` has a `routingTag` that determines its role in cash flow:

| Tag | Purpose | Seed Accounts |
|-----|---------|---------------|
| `PERSONAL` | Personal operating cash | PenFed Checking, Current Checking/Savings |
| `EMERGENCY` | Protected emergency reserve | PenFed Premium Online Savings ($40k protected) |
| `JADESYSTEMS` | JadeSystems LLC operating | Truist JadeSystems Checking |
| `TAX_RESERVE` | Business tax withholding | Truist Tax Reserve ($30k target) |
| `PACIFIC_LUXE` | Pacific Luxe / Turo business | Mercury Checking, Mercury Savings |
| `NY_PROPERTY` | Joint NY rental property | Wells Fargo Joint Checking/Savings |

### 2.1 Operating Cash Calculation

```typescript
// Personal operating cash
computeOperatingCash(accounts, ["PERSONAL", "EMERGENCY"])

// Business operating cash
computeOperatingCash(accounts, ["JADESYSTEMS", "PACIFIC_LUXE", "NY_PROPERTY", "TAX_RESERVE"])
```

Credit card accounts (`CREDIT_CARD`) are excluded from liquid cash regardless of tag.

---

## 3. Income Routing Rules

### 3.1 Rule Structure

`AccountRoutingRule` maps income source keys to target accounts:

| Field | Description |
|-------|-------------|
| `incomeSourceKey` | Identifier matched against income source name/category |
| `targetAccountId` | Destination account |
| `allocationPercent` | Percentage of income amount (default 100%) |
| `sourceAccountId` | Optional — for transfer-based routing |

### 3.2 Seed Routing Rules

| Rule Name | Income Key | Target Account | Allocation |
|-----------|------------|----------------|------------|
| W-2 Income → PenFed | `w2` | PenFed Personal Checking | 100% |
| Contract → Truist | `contract` | Truist JadeSystems Checking | 65% |
| Contract Tax Reserve | `contract` | Truist Tax Reserve | 35% |
| Turo → Mercury | `turo` | Mercury Pacific Luxe Checking | 100% |
| NY Rent → Wells Fargo | `ny_rent` | Wells Fargo Joint Checking | 100% |

### 3.3 Contract Income Split (65/35)

JadeSystems contract income ($18,600/month existing, $18,200/month new) is split:

```
Gross contract payment: $18,600
├── 65% → Truist JadeSystems Checking: $12,090 (operating)
└── 35% → Truist Tax Reserve:          $6,510 (tax withholding)
```

**Rationale:** 35% estimated effective tax rate on 1099 contract income. Tax reserve target is $30,000.

### 3.4 Income Recognition Rules

| Rule | Behavior |
|------|----------|
| Status `SCHEDULED` | Included in forward projections on `expectedDate` |
| Status `RECEIVED` | Credited on `receivedDate`; removed from scheduled |
| Status `CANCELLED` | Excluded from all calculations |
| `isProvisional: true` | Included in projections but flags STS as provisional |

**Provisional income example:** Diminished Value Payment ($4,000, one-time, July 28) — uncertain timing/amount.

### 3.5 Income Schedule (Seed Data)

#### Pre-August 2026 (One-Time)

| Income | Amount | Date | Routing Tag |
|--------|--------|------|-------------|
| NY Rental Income | $4,300 | Jul 1 | NY_PROPERTY |
| Existing Contract Payment | $18,600 | Jul 15 | JADESYSTEMS |
| Turo/Pacific Luxe Rental | $5,000 | Jul 20 | PACIFIC_LUXE |
| W-2 Income | $5,000 | Jul 25 | PERSONAL |
| Diminished Value Payment | $4,000 | Jul 28 | PERSONAL (provisional) |

#### August–October 2026 (Monthly)

| Income | Amount | Day | Routing Tag |
|--------|--------|-----|-------------|
| Existing Contract | $18,600 | 1st | JADESYSTEMS |
| New Contract | $18,200 | 15th | JADESYSTEMS |
| W-2 Income | $10,000 | 1st | PERSONAL |
| Turo/Pacific Luxe | $5,000 | 10th | PACIFIC_LUXE |
| NY Rental Income | $4,300 | 5th | NY_PROPERTY |

**Monthly gross (Aug–Oct):** $56,100

#### November–December 2026 (No New Contract)

| Income | Amount | Day | Routing Tag |
|--------|--------|-----|-------------|
| Existing Contract | $18,600 | 1st | JADESYSTEMS |
| W-2 Income | $10,000 | 1st | PERSONAL |
| Turo/Pacific Luxe | $5,000 | 10th | PACIFIC_LUXE |
| NY Rental Income | $4,300 | 5th | NY_PROPERTY |

**Monthly gross (Nov–Dec):** $37,900 (new contract ends after October)

---

## 4. Bill & Expense Rules

### 4.1 Required Bills (Seed Data)

| Bill | Amount | Due Day | Category | Monthly |
|------|--------|---------|----------|---------|
| NY Mortgage | $8,200 | 1st | housing | ✓ |
| Santa Monica Rent | $5,700 | 1st | housing | ✓ |
| Porsche Turbo S Payment | $5,700 | 15th | vehicle_loans | ✓ |
| Monthly Tax Payment | $900 | 10th | taxes | ✓ |
| General Living Expenses | $6,000 | 1st | food | ✓ |
| 401(k) Repayment | $600 | 20th | retirement | ✓ |

**Total fixed monthly obligations:** $27,100

### 4.2 Bill Inclusion in Safe-to-Spend

A bill is subtracted from safe-to-spend when:

1. `isRequired: true` (all seed bills are required)
2. Due date falls within the calculation horizon
3. Due date determined by `nextDueDate` or `dueDay` of current month

```typescript
// Bills without nextDueDate but with dueDay:
const dueThisMonth = new Date(year, month, bill.dueDay);
// Included if: dueThisMonth >= asOf && dueThisMonth <= horizonEnd
```

### 4.3 Bill Payment Account

Bills may specify `accountId` (payment source). If null, the engine debits the first liquid account (typically PenFed Checking). Future enhancement: route bills by category to appropriate accounts.

---

## 5. Transfer Rules

### 5.1 Transfer Detection

Transactions with `type: TRANSFER` and `isTransfer: true` are linked via `transferPairId`:

```
Transaction A: -$5,000 from PenFed Checking (TRANSFER)
Transaction B: +$5,000 to Truist Checking   (TRANSFER)
transferPairId: "pair-uuid"
```

**Net effect on liquid cash:** Zero (money moves between accounts, not out of system).

### 5.2 Internal Transfer Patterns

| Transfer | From | To | Trigger |
|----------|------|----|---------|
| Tax reserve funding | Truist Checking | Truist Tax Reserve | Automatic via 35% routing |
| Amex payment | PenFed Checking | Amex (liability) | Calendar DEBT_PAYMENT event |
| Emergency → operating | PenFed Savings | PenFed Checking | Overdraft prevention (suggested) |

### 5.3 Transfer vs. Expense

| Characteristic | Transfer | Expense |
|----------------|----------|---------|
| `type` | `TRANSFER` | `EXPENSE` |
| `isTransfer` | `true` | `false` |
| Paired transaction | Yes | No |
| Affects liquid cash total | No | Yes |
| Affects safe-to-spend | No (unless cross-entity) | Yes |

---

## 6. Debt Payment Rules

### 6.1 Amex Staged Payoff

| Date | Amount | Source Account | Event Type |
|------|--------|----------------|--------------|
| Jul 25, 2026 | $15,000 | PenFed Checking | DEBT_PAYMENT |
| Aug 15, 2026 | $5,000 | PenFed Checking | DEBT_PAYMENT |
| Sep 15, 2026 | $5,000 | PenFed Checking | DEBT_PAYMENT |
| Oct 15, 2026 | $5,000 | PenFed Checking | DEBT_PAYMENT |

**Total payoff:** $30,000 (full Amex balance)

Debt payments are included in safe-to-spend committed amount when `dueDate` falls within the horizon.

### 6.2 Minimum Payments

Credit card minimum payments ($500/month Amex) are tracked separately from staged payoff amounts. The engine uses calendar events for explicit payments; minimums apply when no calendar event exists.

---

## 7. Planned Purchase Rules

### 7.1 Seed Planned Purchases

| Purchase | Max Amount | Target | Date | Account | Business |
|----------|------------|--------|------|---------|----------|
| Monterey Car Week | $2,500 | — | Aug 15 | PenFed Checking | No |
| LaGrange Family Road Trip | $6,500 | — | Sep 1 | PenFed Checking | No |
| Disneyland Day with Daughter | $700 | $600 | Aug 15 | PenFed Checking | No |
| Pacific Luxe Advertising Test | $500 | — | Aug 1 | Mercury Checking | Yes |
| Carrera S Wrap | $6,000 | — | Nov 1 | PenFed Checking | No |

### 7.2 Inclusion Rules

A planned purchase is committed in safe-to-spend when:

1. `isCommitted: true` (all seed purchases are committed)
2. `plannedDate` falls within horizon, OR `plannedDate` is null (always committed)

**Amount used:** `maxAmount` (conservative — uses worst case, not `targetAmount`).

---

## 8. Protected Reserve Rules

### 8.1 Emergency Fund

| Field | Value |
|-------|-------|
| Account | PenFed Premium Online Savings |
| Routing tag | EMERGENCY |
| Target | $40,000 |
| Current | $40,000.01 |
| Protected balance | $40,000 |
| `isProtected` on goal | `true` |

**Rule:** Emergency fund balance is never subtracted as available liquid cash. If actual < target, the shortfall is added to committed amount.

### 8.2 Tax Reserve

| Field | Value |
|-------|-------|
| Account | Truist Tax Reserve |
| Routing tag | TAX_RESERVE |
| Target | $30,000 |
| Current | $0 |
| Funding | 35% of contract income |

**Rule:** Tax reserve shortfall ($30,000) is added to committed amount until funded.

### 8.3 Minimum Target Balances

| Account | Minimum Floor |
|---------|---------------|
| PenFed Personal Checking | $10,000 |
| PenFed Premium Online Savings | $40,000 |
| Truist Tax Reserve | $30,000 |

Floor shortfall = `max(0, minimumTargetBalance - currentBalance)` for each liquid account.

---

## 9. Scenario Adjustments

Scenarios modify cash flow rules:

| Parameter | Conservative | Base | Strong |
|-----------|-------------|------|--------|
| `incomeMultiplier` | 0.9 | 1.0 | 1.0 |
| `expenseMultiplier` | 1.1 | 1.0 | 1.0 |
| `includeNewContractAfterOctober` | false | false | true |
| `includeEsop` | false | false | true ($105,000) |
| `incomeDelayDays` | 7 | 0 | 0 |

**Conservative effect:** 10% less income, 10% more expenses.  
**Strong effect:** New contract continues past October; ESOP liquidity event adds $105k to year-end buffer.

---

## 10. Daily Projection Rules

The overdraft engine (`projectDailyBalances`) applies events in this order each day:

1. **Starting balance** — sum of all liquid account balances
2. **Scheduled income** — credit to first liquid account (or routing target)
3. **Bills due** — debit from bill's `accountId` or first liquid account
4. **Debt payments due** — debit from payment's `accountId` or first liquid account
5. **Planned purchases due** — debit `maxAmount` from purchase account
6. **Ending balance** — recalculate per-account and aggregate
7. **Safe-to-spend** — recompute for this day
8. **Risk level** — GREEN/YELLOW/ORANGE/RED based on ending balance vs. minimum floor

---

## 11. Edge Cases

| Case | Handling |
|------|----------|
| Income on same day as large bill | Both applied; net effect on balance |
| Provisional + confirmed income same day | Both included; provisional flag remains |
| Transfer between liquid and non-liquid | Non-liquid excluded from aggregate |
| Bill with no due date and no due day | Flagged as `bill_due_dates` missing; excluded from STS |
| Negative account balance (Amex) | Excluded from liquid cash; tracked as debt |
| Multiple routing rules for same income key | All rules applied by allocationPercent |

---

## 12. Related Documents

- [Safe-to-Spend](./safe-to-spend.md) — How these rules feed the STS formula
- [Seed Data Plan](./seed-data-plan.md) — Complete seed values
- [Database Schema](./database-schema.md) — Income, Bill, RoutingRule tables
- [Scenarios](./architecture.md) — Scenario engine implementation
