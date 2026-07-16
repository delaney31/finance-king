# Finance King — Safe-to-Spend Engine

Formal specification of the safe-to-spend calculation, horizons, committed amounts, and edge cases.

**Implementation:** `src/lib/engine/safe-to-spend.ts`  
**Types:** `src/lib/engine/types.ts`

---

## 1. Definition

> **Safe-to-Spend (STS)** is the maximum amount a user can spend without jeopardizing required bills, debt payments, protected reserves, planned purchases, account minimum floors, or the configured safety margin — within a given time horizon.

```
SafeToSpend = max(0, AvailableLiquid − Committed)
```

If the result is negative before `max(0, ...)`, the user has **no safe-to-spend** capacity (displayed as $0 with risk warnings).

---

## 2. Available Liquid Cash

```
AvailableLiquid = Σ currentBalance
                  for all accounts where:
                    isLiquid = true
                    AND accountType ∉ {CREDIT_CARD, VEHICLE_LOAN, MORTGAGE, PERSONAL_LOAN}
```

### 2.1 Seed Profile Liquid Cash

| Account | Balance | Included |
|---------|---------|----------|
| PenFed Personal Checking | $24,032.25 | ✓ |
| PenFed Premium Online Savings | $40,000.01 | ✓ |
| Wells Fargo Joint Checking | $1,000.00 | ✓ |
| Wells Fargo Joint Savings | $0.00 | ✓ |
| Truist JadeSystems Checking | $0.00 | ✓ |
| Truist Tax Reserve | $0.00 | ✓ |
| Mercury Pacific Luxe Checking | $0.00 | ✓ |
| Mercury Pacific Luxe Savings | $0.00 | ✓ |
| Current Checking | $0.00 | ✓ |
| Current Savings | $0.00 | ✓ |
| Amex Credit Card | -$30,000.00 | ✗ (liability) |

**Available Liquid Cash = $65,032.26**

Note: Emergency savings balance is included in liquid cash but protected amounts are subtracted in the Committed calculation.

---

## 3. Committed Amount

```
Committed = EmergencyShortfall
          + TaxShortfall
          + Σ RequiredBillsInHorizon
          + Σ DebtPaymentsInHorizon
          + Σ CommittedPlannedPurchasesInHorizon
          + FloorShortfall
          + SafetyMargin
```

### 3.1 Protected Reserve Shortfalls

```typescript
EmergencyShortfall = max(0, emergencyTarget − emergencyActual)
TaxShortfall       = max(0, taxTarget − taxActual)
```

**Seed values:**

| Reserve | Target | Actual | Shortfall |
|---------|--------|--------|-----------|
| Emergency Fund | $40,000 | $40,000.01 | $0 |
| Tax Reserve | $30,000 | $0 | **$30,000** |

### 3.2 Required Bills in Horizon

A bill is included when:
- `isRequired = true`
- Due date falls within `[asOf, horizonEnd]`

Due date resolution:
1. Use `nextDueDate` if set
2. Else compute from `dueDay` in current month
3. If neither exists → flag `bill_due_dates` as missing

```typescript
billTotal = Σ bill.amount for bills in horizon where bill.isRequired
```

### 3.3 Debt Payments in Horizon

Includes calendar events and scheduled debt payments where `dueDate` is within horizon:

**Seed Amex payments (July horizon):**
- Jul 25: $15,000 → included in July/month horizons

### 3.4 Committed Planned Purchases in Horizon

```typescript
plannedTotal = Σ purchase.maxAmount
  for purchases where:
    purchase.isCommitted = true
    AND (purchase.plannedDate is null OR plannedDate in horizon)
```

### 3.5 Floor Shortfall

```typescript
FloorShortfall = Σ max(0, account.minimumTargetBalance − account.currentBalance)
  for all accounts where account.isLiquid = true
```

**Seed floor shortfalls:**

| Account | Floor | Balance | Shortfall |
|---------|-------|---------|-----------|
| PenFed Checking | $10,000 | $24,032.25 | $0 |
| PenFed Savings | $40,000 | $40,000.01 | $0 |
| Truist Tax Reserve | $30,000 | $0 | $30,000 |

**Total floor shortfall: $30,000** (same as tax shortfall — both point to unfunded tax reserve)

### 3.6 Safety Margin

```typescript
SafetyMargin = safetyMarginFlat + (AvailableLiquid × safetyMarginPercent)
```

**Seed defaults:**
- `safetyMarginFlat = $500`
- `safetyMarginPercent = 0`

**Safety margin = $500**

---

## 4. Time Horizons

### 4.1 Horizon Definitions

| Horizon | `horizonEnd` | Use Case |
|---------|-------------|----------|
| `today` | `asOf` (same day) | "Can I buy coffee?" |
| `week` | End of current week (Sunday) | "Can I go to dinner this weekend?" |
| `month` | End of current month | "Can I afford Car Week?" |
| `payday` | Next W-2 deposit date | "What's left until I get paid?" |

```typescript
function getHorizonEnd(asOf, horizon, nextPayday?) {
  switch (horizon) {
    case "today":  return asOf;
    case "week":   return endOfWeek(asOf);      // Sunday
    case "month":  return endOfMonth(asOf);
    case "payday": return nextPayday ?? endOfWeek(asOf);
  }
}
```

### 4.2 Multi-Horizon Output

`computeAllHorizons()` returns all four values in a single `SafeToSpendResult`:

```typescript
interface SafeToSpendResult {
  today: number;
  thisWeek: number;
  thisMonth: number;
  nextPayday?: number;
  availableLiquid: number;
  committed: number;
  protectedAmount: number;
  safetyMargin: number;
  isProvisional: boolean;
  missingFields: string[];
}
```

---

## 5. Worked Example (Seed Data, July 16 2026)

### 5.1 Horizon: Today (July 16)

**Bills due July 16:** None  
**Debt payments due July 16:** None  
**Planned purchases due July 16:** None

```
Committed = $0 (emergency) + $30,000 (tax) + $0 (bills) + $0 (debt) + $0 (planned) + $30,000 (floor) + $500 (margin)
         = $60,500

STS_today = max(0, $65,032.26 − $60,500) = $4,532.26
```

### 5.2 Horizon: This Month (through July 31)

**Bills due in July:**

| Bill | Amount | Due |
|------|--------|-----|
| NY Mortgage | $8,200 | Jul 1 (past) |
| Santa Monica Rent | $5,700 | Jul 1 (past) |
| General Living Expenses | $6,000 | Jul 1 (past) |
| Monthly Tax Payment | $900 | Jul 10 (past) |
| Porsche Payment | $5,700 | Jul 15 (past) |
| 401(k) Repayment | $600 | Jul 20 |

Note: Bills with due dates before `asOf` are excluded (already past due). Only future bills within horizon count.

**Bills remaining in July:** 401(k) Repayment $600 (Jul 20)

**Debt payments in July:** Amex $15,000 (Jul 25)

**Planned purchases in July:** None with July dates

```
Committed = $0 + $30,000 + $600 + $15,000 + $0 + $30,000 + $500
         = $76,100

STS_month = max(0, $65,032.26 − $76,100) = $0
```

**Result:** $0 safe-to-spend for the month — the $15k Amex payment exceeds remaining liquid capacity after reserves. This triggers the "Fund Amex Payoff" alert.

### 5.3 After July 25 Income

If W-2 ($5,000, Jul 25) is received before Amex payment:

```
AvailableLiquid = $65,032.26 + $5,000 = $70,032.26
Committed = $76,100 (unchanged)
STS_month = max(0, $70,032.26 − $76,100) = $0
```

Still $0 — need contract income (Jul 15, $18,600 → $12,090 after 65% split) to fund Amex.

---

## 6. Provisional Flag

`isProvisional = true` when:

1. Any required bill lacks `nextDueDate` and `dueDay` → `missingFields: ["bill_due_dates"]`
2. Any income has `isProvisional: true` → `missingFields: ["provisional_income"]`
3. Any other field in `snapshot.provisionalFields`

**UI behavior:** Display STS with amber "Provisional" badge. Tooltip shows missing fields.

---

## 7. Edge Cases

### 7.1 Zero and Negative Results

| Condition | Display | Risk Level |
|-----------|---------|------------|
| STS > 0 | Gold monospace amount | GREEN |
| STS = 0 | "$0.00" with explanation | YELLOW/ORANGE |
| Committed > Available | "$0.00" + "Overcommitted" banner | RED |

### 7.2 Emergency Account Spending

Direct spending from `routingTag: EMERGENCY` is blocked by purchase impact simulator:

```typescript
if (account.routingTag === "EMERGENCY") {
  return { recommendation: "decline", warnings: ["Cannot spend from protected emergency reserve"] };
}
```

The emergency balance is in liquid cash but protected shortfall prevents it from being spendable.

### 7.3 Credit Card Balances

Amex (-$30,000) is excluded from liquid cash. The $30k payoff is tracked via:
- Calendar DEBT_PAYMENT events (subtracted in committed)
- Debt model (minimum payment tracking)
- Credit utilization (separate from STS)

### 7.4 Duplicate Shortfall Counting

Tax reserve shortfall appears in both:
- `TaxShortfall` (from goals)
- `FloorShortfall` (from `minimumTargetBalance`)

**Current behavior:** Both are summed. This is conservative (double-counts the $30k tax reserve gap). 

**Mitigation (planned):** Deduplicate when the same account contributes to both goal shortfall and floor shortfall.

### 7.5 Income Not Yet in Account Balances

Scheduled income is **not** added to `currentBalance` until status changes to `RECEIVED`. The engine does not pre-credit scheduled income to available liquid.

**Implication:** STS is conservative — it does not assume future income will arrive on time.

**Future enhancement:** Optional "include scheduled income in horizon" mode.

### 7.6 Multiple Bills on Same Day

All bills due on the same day are summed. No ordering or prioritization — all required bills are treated equally.

### 7.7 Business vs. Personal STS

Current engine computes a single aggregate STS across all liquid accounts. 

**Future enhancement:** Per-entity STS:
- Personal STS (PERSONAL + EMERGENCY tags)
- Business STS (JADESYSTEMS + PACIFIC_LUXE + TAX_RESERVE tags)
- NY Property STS (NY_PROPERTY tag)

---

## 8. Relationship to Other Engine Functions

| Function | Relationship to STS |
|----------|-------------------|
| `computeOverdraftRisk()` | Uses daily STS to color risk levels |
| `simulatePurchaseImpact()` | Adds hypothetical purchase to committed |
| `runScenarioForecast()` | Computes STS under scenario adjustments |
| `computeFinancialHealthScore()` | STS ratio is 30% of health score |
| `buildDashboardSnapshot()` | Exposes all horizons in dashboard |

---

## 9. Configuration

Users can adjust via `UserPreference`:

| Setting | Default | Effect |
|---------|---------|--------|
| `safetyMarginFlat` | $500 | Added to committed |
| `safetyMarginPercent` | 0% | Percentage of liquid cash added to committed |

**Example:** User sets $1,000 flat + 5% margin:
```
SafetyMargin = $1,000 + ($65,032 × 0.05) = $4,251.60
```

---

## 10. Testing

Unit tests should verify:

- [ ] STS never negative (clamped to 0)
- [ ] Emergency shortfall prevents spending from protected account
- [ ] Bills outside horizon excluded
- [ ] Amex excluded from liquid cash
- [ ] Provisional flag set with provisional income
- [ ] All four horizons computed correctly
- [ ] Safety margin applied correctly
- [ ] Month horizon includes Amex $15k → STS drops to $0

---

## 11. Related Documents

- [Cash Flow Rules](./cash-flow-rules.md) — Income, bills, routing
- [Credit Methodology](./credit-methodology.md) — Amex payoff planning
- [Seed Data Plan](./seed-data-plan.md) — Seed balances and schedule
- [Architecture](./architecture.md) — Engine module structure
