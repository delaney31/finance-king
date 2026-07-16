# Finance King — Credit Methodology

Credit utilization calculations, debt payoff strategies (avalanche/snowball), Amex payoff plan, and educational disclaimers.

**Implementation:** `src/lib/engine/credit.ts`

---

## 1. Overview

Finance King provides **educational** credit analysis tools. It is not a credit counseling service, does not pull credit reports, and does not guarantee score outcomes.

The credit module helps users:
- Understand current utilization across cards
- Calculate payments needed to reach utilization targets
- Compare avalanche vs. snowball payoff strategies
- Track staged payoff plans (Amex $30k elimination)

---

## 2. Utilization Calculation

### 2.1 Per-Card Utilization

```
CardUtilization = |currentBalance| / creditLimit
```

### 2.2 Overall Utilization

```
OverallUtilization = Σ|balance| / Σ creditLimit
  for all accounts where accountType = CREDIT_CARD
```

### 2.3 Seed Profile: Amex

| Field | Value |
|-------|-------|
| Issuer | American Express |
| Balance | $30,000 |
| Credit Limit | $35,000 |
| APR | 24.99% |
| Minimum Payment | $500/month |
| Payment Due Day | 15th |
| Statement Close Day | 5th |
| Account Age | — |

**Current utilization: 85.7%** ($30,000 / $35,000)

**Risk assessment:** Utilization above 30% negatively impacts credit scores. Above 50% is considered high risk.

---

## 3. Utilization Targets

`computeUtilizationTargets()` calculates payments needed to reach standard thresholds:

```
PaymentNeeded(threshold) = max(0, TotalBalance − (TotalLimit × threshold))
NewUtilization = (TotalBalance − PaymentNeeded) / TotalLimit
```

### 3.1 Amex Target Payments

| Target | Threshold | Payment Needed | Resulting Utilization |
|--------|-----------|----------------|----------------------|
| Good | 30% | $19,500 | 30.0% |
| Excellent | 10% | $26,500 | 10.0% |
| Optimal | 5% | $28,250 | 5.0% |

**Calculation (30% target):**
```
Target balance = $35,000 × 0.30 = $10,500
Payment needed = $30,000 − $10,500 = $19,500
```

### 3.2 UI Presentation

Display as a stepped progress chart:

```
[████████████████████████████████████████░░░░░] 85.7% current
[████████████████████░░░░░░░░░░░░░░░░░░░░░░░░] 30.0% target — pay $19,500
[██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 10.0% target — pay $26,500
[███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  5.0% target — pay $28,250
```

---

## 4. Amex Staged Payoff Plan

The seed data includes a deliberate 4-payment plan to eliminate the $30k balance by October 2026:

| # | Date | Amount | Cumulative Paid | Remaining Balance | Utilization After |
|---|------|--------|-----------------|-------------------|-------------------|
| 1 | Jul 25, 2026 | $15,000 | $15,000 | $15,000 | 42.9% |
| 2 | Aug 15, 2026 | $5,000 | $20,000 | $10,000 | 28.6% |
| 3 | Sep 15, 2026 | $5,000 | $25,000 | $5,000 | 14.3% |
| 4 | Oct 15, 2026 | $5,000 | $30,000 | $0 | 0.0% |

**Source account:** PenFed Personal Checking for all payments.

### 4.1 Funding Requirements

Before each payment, the engine checks PenFed Checking balance:

| Payment | Required Balance | Alert |
|---------|-----------------|-------|
| Jul 25: $15,000 | ≥ $15,000 + $10,000 floor = $25,000 | ⚠ Current: $24,032 — **underfunded** |
| Aug 15: $5,000 | ≥ $5,000 + $10,000 floor = $15,000 | Depends on Aug income |
| Sep 15: $5,000 | ≥ $15,000 | Depends on Sep income |
| Oct 15: $5,000 | ≥ $15,000 | Depends on Oct income |

**Active alert:** "Schedule $15,000 transfer to PenFed checking before July 25 Amex payment."

### 4.2 Impact on Safe-to-Spend

Each Amex payment is a `DEBT_PAYMENT` calendar event subtracted from safe-to-spend within the payment's horizon. The July $15k payment is the primary driver of $0 month-end STS.

---

## 5. Payoff Strategies

### 5.1 Avalanche Method

**Strategy:** Pay minimums on all cards, apply extra payment to the card with the **highest APR**.

```typescript
buildAvalanchePlan(cards, monthlyBudget)
// Sorts cards by APR descending
// Directs surplus to highest-APR card after minimums
```

**Best for:** Minimizing total interest paid.

**Seed scenario (single card):** With only Amex at 24.99% APR, avalanche and snowball produce identical results.

### 5.2 Snowball Method

**Strategy:** Pay minimums on all cards, apply extra payment to the card with the **smallest balance**.

```typescript
buildSnowballPlan(cards, monthlyBudget)
// Sorts cards by balance ascending
// Directs surplus to smallest-balance card after minimums
```

**Best for:** Psychological wins from eliminating cards quickly.

### 5.3 Payoff Plan Output

```typescript
interface PayoffPlan {
  strategy: "avalanche" | "snowball";
  monthlyPayment: number;
  payoffDate: string;        // ISO date
  totalInterest: number;
  payments: {
    month: string;           // "yyyy-MM"
    cardId: string;
    amount: number;
    remainingBalance: number;
  }[];
}
```

### 5.4 Example: $2,000/Month Budget

With only Amex ($30k, 24.99% APR, $500 min):

| Month | Payment | Interest | Remaining |
|-------|---------|----------|-----------|
| 1 | $500 (min) + $1,500 (extra) = $2,000 | ~$625 | $28,625 |
| 2 | $2,000 | ~$596 | $27,221 |
| ... | ... | ... | ... |
| ~17 | $2,000 | ~$40 | $0 |

**Estimated payoff:** ~17 months at $2,000/month  
**Estimated total interest:** ~$5,500

*Note: The staged plan ($15k + $5k + $5k + $5k) pays off faster with less interest by making large early payments.*

---

## 6. Interest Calculation

Monthly interest accrual in payoff projections:

```
MonthlyInterest = (RemainingBalance × APR) / 12
```

Applied after minimum payment each month in `buildPayoffPlan()`.

**Amex monthly interest at $30k:** $30,000 × 0.2499 / 12 = **$624.75/month**

---

## 7. Credit Score Factors (Educational)

Finance King does not calculate credit scores. The following educational context is displayed on the credit page:

| Factor | Weight (FICO) | Finance King Tracking |
|--------|---------------|----------------------|
| Payment history | 35% | Calendar DEBT_PAYMENT events |
| Amounts owed (utilization) | 30% | Real-time utilization calculation |
| Length of credit history | 15% | `accountAgeMonths` field |
| Credit mix | 10% | Account type diversity |
| New credit (inquiries) | 10% | Not tracked |

Users can manually enter `CreditScoreSnapshot` records to track score over time.

---

## 8. Credit Goals

`CreditGoal` model allows setting targets:

```typescript
{ targetScore: 750, targetDate: "2026-12-31" }
```

Displayed as progress toward goal with educational milestones:
- 720+: Excellent
- 680–719: Good
- 620–679: Fair
- < 620: Needs improvement

---

## 9. Disclaimers

### 9.1 Primary Disclaimer

Exported as `CREDIT_DISCLAIMER` constant:

> Credit score estimates are educational only. Credit bureaus and scoring models may calculate scores differently. Payment history, utilization, age, account mix, inquiries, and derogatory records all affect outcomes. Do not drain emergency savings solely to optimize utilization.

### 9.2 Additional Disclaimers (UI)

**On payoff plans:**
> Payoff projections assume no new charges, consistent monthly payments, and current APR. Actual results may vary. Promotional rates and balance transfers are not modeled.

**On utilization targets:**
> Reaching lower utilization thresholds may temporarily improve scores, but paying from emergency reserves can increase financial risk. Balance the tradeoff between credit optimization and cash safety.

**On staged Amex plan:**
> This plan is based on your configured calendar events. Ensure source accounts are funded before each payment date. Missing a payment may result in late fees and credit score impact.

### 9.3 What Finance King Is NOT

- ❌ A credit repair service
- ❌ A licensed financial advisor
- ❌ A credit bureau or report provider
- ❌ A debt settlement negotiator
- ❌ A guarantee of credit score improvement

---

## 10. Alerts & Recommendations

### 10.1 Credit-Related Alert Types

| AlertType | Trigger | Severity |
|-----------|---------|----------|
| `CREDIT_CARD_DUE` | Payment due within 7 days | WARNING |
| `HIGH_UTILIZATION` | Overall utilization > 30% | WARNING |
| `STATEMENT_CLOSING` | Statement close day within 3 days | INFO |
| `LOW_BALANCE` | Source account < payment amount | URGENT |

### 10.2 Seed Alert

```json
{
  "type": "UPCOMING_BILL",
  "severity": "WARNING",
  "title": "Amex Payment Due",
  "message": "$15,000 Amex payment scheduled before August 1. Ensure PenFed checking is funded."
}
```

### 10.3 Seed Recommendation

```json
{
  "title": "Fund Amex Payoff",
  "message": "Schedule $15,000 transfer to PenFed checking before July 25 Amex payment.",
  "priority": 1,
  "actionUrl": "/credit"
}
```

---

## 11. Multi-Card Scenarios (Future)

When multiple credit cards exist, the comparison becomes meaningful:

| Card | Balance | Limit | APR | Avalanche Priority | Snowball Priority |
|------|---------|-------|-----|-------------------|-------------------|
| Amex | $30,000 | $35,000 | 24.99% | 1st (highest APR) | 2nd (larger balance) |
| Chase | $3,000 | $10,000 | 19.99% | 2nd | 1st (smallest balance) |

**Avalanche:** Extra payments to Amex first.  
**Snowball:** Extra payments to Chase first (quick win), then Amex.

---

## 12. Related Documents

- [Safe-to-Spend](./safe-to-spend.md) — How debt payments affect STS
- [Cash Flow Rules](./cash-flow-rules.md) — Amex payment schedule
- [Seed Data Plan](./seed-data-plan.md) — Amex seed values
- [User Flows](./user-flows.md) — Amex payoff flow diagram
