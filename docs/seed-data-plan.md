# Finance King — Seed Data Plan

Complete specification of the demo user financial profile seeded by `prisma/seed.ts`.

**Login credentials:** `tim@financeking.local` / `demo12345`

---

## 1. User Profile

| Field | Value |
|-------|-------|
| Email | `tim@financeking.local` |
| Name | Timothy |
| Role | USER |
| Plan Tier | KING |
| Onboarding Complete | `true` |
| Household | Delaney Household |

### 1.1 Preferences

| Setting | Value |
|---------|-------|
| Theme | dark (navy/gold) |
| Safety Margin Flat | $500 |
| Safety Margin Percent | 0% |
| Currency | USD |
| Timezone | America/New_York |
| Local OCR Only | true (default) |

### 1.2 Subscription

| Field | Value |
|-------|-------|
| Plan Tier | KING |
| Status | ACTIVE |
| OCR Quota | 100 pages/month |
| Storage Quota | 2000 MB |

---

## 2. Business Entities

| Entity | EIN | Accounts |
|--------|-----|----------|
| JadeSystems LLC | — | Truist Checking, Truist Tax Reserve |
| Pacific Luxe | — | Mercury Checking, Mercury Savings |

---

## 3. Financial Accounts (11 total)

### 3.1 Personal Accounts

| Institution | Nickname | Type | Routing Tag | Balance | Floor | Protected |
|-------------|----------|------|-------------|---------|-------|-----------|
| PenFed | PenFed Personal Checking | CHECKING | PERSONAL | $24,032.25 | $10,000 | — |
| PenFed | PenFed Premium Online Savings | SAVINGS | EMERGENCY | $40,000.01 | $40,000 | $40,000 |
| Current | Current Checking | CHECKING | PERSONAL | $0.00 | — | — |
| Current | Current Savings | SAVINGS | PERSONAL | $0.00 | — | — |

### 3.2 Joint Accounts

| Institution | Nickname | Type | Routing Tag | Balance | Ownership |
|-------------|----------|------|-------------|---------|-----------|
| Wells Fargo | Wells Fargo Joint Checking | JOINT_CHECKING | NY_PROPERTY | $1,000.00 | JOINT |
| Wells Fargo | Wells Fargo Joint Savings | JOINT_SAVINGS | NY_PROPERTY | $0.00 | JOINT |

### 3.3 Business Accounts

| Institution | Nickname | Type | Entity | Routing Tag | Balance | Floor |
|-------------|----------|------|--------|-------------|---------|-------|
| Truist | Truist JadeSystems Checking | BUSINESS_CHECKING | JadeSystems | JADESYSTEMS | $0.00 | — |
| Truist | Truist Tax Reserve | TAX_RESERVE | JadeSystems | TAX_RESERVE | $0.00 | $30,000 |
| Mercury | Mercury Pacific Luxe Checking | BUSINESS_CHECKING | Pacific Luxe | PACIFIC_LUXE | $0.00 | — |
| Mercury | Mercury Pacific Luxe Savings | BUSINESS_SAVINGS | Pacific Luxe | PACIFIC_LUXE | $0.00 | — |

### 3.4 Credit Card

| Institution | Nickname | Type | Routing Tag | Balance | Limit | APR | Min Pay | Due Day | Stmt Close |
|-------------|----------|------|-------------|---------|-------|-----|---------|---------|------------|
| American Express | Amex | CREDIT_CARD | PERSONAL | -$30,000 | $35,000 | 24.99% | $500 | 15 | 5 |

**Derived metrics:**
- Total liquid cash: **$65,032.26**
- Total debt: **$30,000**
- Credit utilization: **85.7%**

---

## 4. Income Routing Rules (5 rules)

| Rule Name | Income Key | Target Account | Allocation |
|-----------|------------|----------------|------------|
| W-2 Income → PenFed | `w2` | PenFed Personal Checking | 100% |
| Contract → Truist | `contract` | Truist JadeSystems Checking | 65% |
| Contract Tax Reserve | `contract` | Truist Tax Reserve | 35% |
| Turo → Mercury | `turo` | Mercury Pacific Luxe Checking | 100% |
| NY Rent → Wells Fargo | `ny_rent` | Wells Fargo Joint Checking | 100% |

---

## 5. Income Schedule

### 5.1 July 2026 (One-Time + Transition)

| Name | Amount | Date | Tag | Provisional |
|------|--------|------|-----|-------------|
| NY Rental Income | $4,300 | Jul 1 | NY_PROPERTY | No |
| Existing Contract Payment | $18,600 | Jul 15 | JADESYSTEMS | No |
| Turo/Pacific Luxe Rental | $5,000 | Jul 20 | PACIFIC_LUXE | No |
| W-2 Income | $5,000 | Jul 25 | PERSONAL | No |
| Diminished Value Payment | $4,000 | Jul 28 | PERSONAL | **Yes** |

**July gross (confirmed):** $33,900  
**July gross (with provisional):** $37,900

### 5.2 August–October 2026 (Monthly)

| Name | Amount | Day | Tag |
|------|--------|-----|-----|
| Existing Contract | $18,600 | 1st | JADESYSTEMS |
| New Contract | $18,200 | 15th | JADESYSTEMS |
| W-2 Income | $10,000 | 1st | PERSONAL |
| Turo/Pacific Luxe | $5,000 | 10th | PACIFIC_LUXE |
| NY Rental Income | $4,300 | 5th | NY_PROPERTY |

**Monthly gross:** $56,100  
**After 35% tax split on contracts:** $56,100 − ($18,600 + $18,200) × 0.35 = $43,210 net to operating accounts

### 5.3 November–December 2026 (No New Contract)

| Name | Amount | Day | Tag |
|------|--------|-----|-----|
| Existing Contract | $18,600 | 1st | JADESYSTEMS |
| W-2 Income | $10,000 | 1st | PERSONAL |
| Turo/Pacific Luxe | $5,000 | 10th | PACIFIC_LUXE |
| NY Rental Income | $4,300 | 5th | NY_PROPERTY |

**Monthly gross:** $37,900

---

## 6. Bills (6 recurring)

| Name | Amount | Due Day | Category | Required |
|------|--------|---------|----------|----------|
| NY Mortgage | $8,200 | 1st | housing | Yes |
| Santa Monica Rent | $5,700 | 1st | housing | Yes |
| Porsche Turbo S Payment | $5,700 | 15th | vehicle_loans | Yes |
| Monthly Tax Payment | $900 | 10th | taxes | Yes |
| General Living Expenses | $6,000 | 1st | food | Yes |
| 401(k) Repayment | $600 | 20th | retirement | Yes |

**Total monthly fixed:** $27,100

---

## 7. Savings Goals (3)

| Name | Type | Target | Current | Account | Protected |
|------|------|--------|---------|---------|-----------|
| Emergency Reserve | EMERGENCY_FUND | $40,000 | $40,000.01 | PenFed Savings | Yes |
| Tax Reserve | TAX_RESERVE | $30,000 | $0 | Truist Tax Reserve | No |
| Personal Operating Cash | CUSTOM | $10,000 | $24,032.25 | PenFed Checking | No |

---

## 8. Amex Payoff Calendar Events

| Date | Title | Amount | Source Account | Type |
|------|-------|--------|----------------|------|
| Jul 25, 2026 | Amex Payment $15,000 | $15,000 | PenFed Checking | DEBT_PAYMENT |
| Aug 15, 2026 | Amex Payment $5,000 | $5,000 | PenFed Checking | DEBT_PAYMENT |
| Sep 15, 2026 | Amex Payment $5,000 | $5,000 | PenFed Checking | DEBT_PAYMENT |
| Oct 15, 2026 | Amex Payment $5,000 | $5,000 | PenFed Checking | DEBT_PAYMENT |

### 8.1 Debt Record

| Field | Value |
|-------|-------|
| Name | Amex |
| Current Balance | $30,000 |
| Interest Rate | 24.99% |
| Minimum Payment | $500 |
| Target Payoff Date | Oct 31, 2025 → Oct 31, 2026 (seed year) |

---

## 9. Planned Purchases (5)

| Name | Max | Target | Date | Account | Business |
|------|-----|--------|------|---------|----------|
| Monterey Car Week | $2,500 | — | Aug 15 | PenFed Checking | No |
| LaGrange Family Road Trip | $6,500 | — | Sep 1 | PenFed Checking | No |
| Disneyland Day with Daughter | $700 | $600 | Aug 15 | PenFed Checking | No |
| Pacific Luxe Advertising Test | $500 | — | Aug 1 | Mercury Checking | Yes |
| Carrera S Wrap | $6,000 | — | Nov 1 | PenFed Checking | No |

**Total committed discretionary:** $16,200

---

## 10. Recurring Transactions (4 detected)

| Name | Amount | Frequency | Classification | Status |
|------|--------|-----------|----------------|--------|
| NY Mortgage | $8,200 | MONTHLY | NECESSARY | APPROVED |
| Santa Monica Rent | $5,700 | MONTHLY | NECESSARY | APPROVED |
| Porsche Payment | $5,700 | MONTHLY | NECESSARY | APPROVED |
| Contract Income | $18,600 | MONTHLY | NECESSARY | APPROVED |

---

## 11. Scenarios (3)

| Name | Type | Parameters |
|------|------|------------|
| Conservative | CONSERVATIVE | income ×0.9, expenses ×1.1, no ESOP, no new contract post-Oct |
| Base | BASE | income ×1.0, expenses ×1.0, no ESOP, no new contract post-Oct |
| Strong | STRONG | income ×1.0, expenses ×1.0, **ESOP $105,000**, new contract continues |

### 11.1 ESOP Scenario Detail

The **Strong** scenario includes a hypothetical Employee Stock Ownership Plan liquidity event:

| Parameter | Value |
|-----------|-------|
| `includeEsop` | `true` |
| `esopAmount` | $105,000 |
| Effect | Added to `yearEndBufferWithEsop` |
| Routing | Not auto-routed (user would configure) |

This models a potential liquidity event that dramatically improves year-end financial position without affecting monthly safe-to-spend (one-time inflow).

---

## 12. Alerts & Recommendations

### 12.1 Alert

| Field | Value |
|-------|-------|
| Type | UPCOMING_BILL |
| Severity | WARNING |
| Title | Amex Payment Due |
| Message | $15,000 Amex payment scheduled before August 1. Ensure PenFed checking is funded. |

### 12.2 Recommendation

| Field | Value |
|-------|-------|
| Title | Fund Amex Payoff |
| Message | Schedule $15,000 transfer to PenFed checking before July 25 Amex payment. |
| Priority | 1 |
| Action URL | `/credit` |

---

## 13. Seed Execution

```bash
# Reset and reseed
npm run db:seed

# Or full reset
npx prisma migrate reset  # WARNING: destroys all data
```

**Seed order (respects foreign keys):**
1. Delete all existing data (reverse dependency order)
2. Create user + preferences + subscription + household
3. Create business entities
4. Create financial accounts (11)
5. Create credit card + debt records for Amex
6. Create routing rules (5)
7. Create savings goals (3)
8. Create income sources (~40 entries)
9. Create bills (6)
10. Create calendar events (4 Amex payments)
11. Create planned purchases (5)
12. Create recurring transactions (4)
13. Create scenarios (3)
14. Create alert + recommendation (1 each)

All seed records have `isSeedData: true` for identification and cleanup.

---

## 14. Expected Dashboard State (July 16, 2026)

When the dashboard loads with seed data:

| Metric | Expected Value |
|--------|---------------|
| Total Liquid Cash | $65,032.26 |
| Safe to Spend (today) | ~$4,532 |
| Safe to Spend (month) | $0 (Amex payment) |
| Protected Emergency | $40,000.01 |
| Tax Reserve | $0 (shortfall: $30,000) |
| Personal Operating | $64,032.26 |
| Business Operating | $1,000.00 |
| Total Debt | $30,000 |
| Credit Utilization | 85.7% |
| Health Score | ~60 ("Stable") |
| isProvisional | true (provisional_income) |
| Year-End Buffer (Base) | Negative (high obligations) |
| Year-End Buffer + ESOP (Strong) | Significantly improved |

---

## 15. Data Cleanup

To remove seed data while keeping the user:

```sql
DELETE FROM "Transaction" WHERE "isSeedData" = true;
DELETE FROM "FinancialAccount" WHERE "isSeedData" = true;
-- etc. for all tables with isSeedData
```

Or full reseed: `npm run db:seed` (deletes all data first).

---

## 16. Related Documents

- [Cash Flow Rules](./cash-flow-rules.md) — How seed income/bills interact
- [Safe-to-Spend](./safe-to-spend.md) — Expected STS calculations
- [Credit Methodology](./credit-methodology.md) — Amex payoff details
- [Database Schema](./database-schema.md) — Table definitions
