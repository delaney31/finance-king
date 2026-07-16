# Wireframe: Calendar Day Detail

**Route:** `/calendar/2026-07-25` (example: Amex payment day)  
**Context:** Day detail panel for July 25, 2026 — highest risk day in July  
**Theme:** Navy background, risk-colored accents

---

## Layout Overview (Desktop — Side Panel)

```
┌────────────────────────────────────────┬───────────────────────────────────────────┐
│                                        │                                           │
│  CALENDAR — July 2026                  │  ■ July 25, 2026 — Friday                │
│                                        │  Risk Level: 🔴 RED                       │
│  Su  Mo  Tu  We  Th  Fr  Sa           │                                           │
│              1   2   3   4   5         │  ┌─ Day Summary ────────────────────────┐ │
│   6   7   8   9  10  11  12           │  │                                      │ │
│  13  14  15  16  17  18  19           │  │  Starting Balance     $65,032.26     │ │
│  20  21  22  23  24 [25] 26           │  │  + Income              +$5,000.00     │ │
│  27  28  29  30  31                   │  │  − Expenses           −$15,000.00    │ │
│                                        │  │  ─────────────────────────────────   │ │
│  ● Bill  ● Income  ● Debt  ● Purchase │  │  Ending Balance       $55,032.26     │ │
│                                        │  │                                      │ │
│  25 highlighted in RED border          │  │  Safe to Spend          $0.00        │ │
│                                        │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │ │
│                                        │  │                                      │ │
│                                        │  └──────────────────────────────────────┘ │
│                                        │                                           │
│                                        │  ┌─ Events ─────────────────────────────┐ │
│                                        │  │                                      │ │
│                                        │  │  ┌────────────────────────────────┐  │ │
│                                        │  │  │ 💵 INCOME                      │  │ │
│                                        │  │  │ W-2 Income                     │  │ │
│                                        │  │  │ +$5,000.00 → PenFed Checking   │  │ │
│                                        │  │  │ Status: SCHEDULED              │  │ │
│                                        │  │  └────────────────────────────────┘  │ │
│                                        │  │                                      │ │
│                                        │  │  ┌────────────────────────────────┐  │ │
│                                        │  │  │ 💳 DEBT_PAYMENT            🔴  │  │ │
│                                        │  │  │ Amex Payment $15,000           │  │ │
│                                        │  │  │ −$15,000.00 ← PenFed Checking  │  │ │
│                                        │  │  │ Remaining Amex: $15,000        │  │ │
│                                        │  │  │ Utilization after: 42.9%       │  │ │
│                                        │  │  └────────────────────────────────┘  │ │
│                                        │  │                                      │ │
│                                        │  └──────────────────────────────────────┘ │
│                                        │                                           │
│                                        │  ┌─ Account Balances (End of Day) ──────┐ │
│                                        │  │                                      │ │
│                                        │  │  Account                  Balance    │ │
│                                        │  │  ─────────────────────────────────   │ │
│                                        │  │  PenFed Checking          $14,032 ⚠  │ │
│                                        │  │  PenFed Savings           $40,000    │ │
│                                        │  │  Wells Fargo Joint         $1,000    │ │
│                                        │  │  Truist Checking               $0    │ │
│                                        │  │  Truist Tax Reserve            $0    │ │
│                                        │  │  Mercury Checking              $0    │ │
│                                        │  │  Amex (liability)         −$15,000   │ │
│                                        │  │                                      │ │
│                                        │  │  ⚠ PenFed Checking below $10k floor  │ │
│                                        │  │                                      │ │
│                                        │  └──────────────────────────────────────┘ │
│                                        │                                           │
│                                        │  ┌─ Suggested Action ───────────────────┐ │
│                                        │  │                                      │ │
│                                        │  │  ⚡ PenFed Checking will drop to       │ │
│                                        │  │  $14,032 after Amex payment — below    │ │
│                                        │  │  the $10,000 minimum floor.            │ │
│                                        │  │                                      │ │
│                                        │  │  Ensure W-2 income ($5,000) arrives    │ │
│                                        │  │  before payment processes.             │ │
│                                        │  │                                      │ │
│                                        │  │  [View Amex Payoff Plan →]             │ │
│                                        │  │                                      │ │
│                                        │  └──────────────────────────────────────┘ │
│                                        │                                           │
│                                        │  ┌─ Navigation ─────────────────────────┐ │
│                                        │  │  [← Jul 24]              [Jul 26 →] │ │
│                                        │  └──────────────────────────────────────┘ │
│                                        │                                           │
└────────────────────────────────────────┴───────────────────────────────────────────┘
```

---

## Layout Overview (Mobile — Full Screen)

```
┌─────────────────────────────────┐
│ ← Calendar   Jul 25, 2026   🔴  │
├─────────────────────────────────┤
│                                 │
│  ┌─ Day Summary ───────────────┐│
│  │                             ││
│  │  Ending Balance  $55,032    ││
│  │  Safe to Spend      $0.00   ││
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ││
│  │                             ││
│  │  +$5,000 income             ││
│  │  −$15,000 Amex payment      ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─ Events ────────────────────┐│
│  │                             ││
│  │  💵 W-2 Income    +$5,000  ││
│  │     → PenFed Checking       ││
│  │                             ││
│  │  💳 Amex Payment  −$15,000 ││
│  │     ← PenFed Checking  🔴   ││
│  │     Remaining: $15,000      ││
│  │     Util: 42.9% after       ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─ Accounts ─────────────────┐│
│  │ PenFed Checking  $14,032 ⚠  ││
│  │ PenFed Savings   $40,000    ││
│  │ Amex            −$15,000    ││
│  │ [Show all accounts]         ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─ ⚡ Action Needed ───────────┐│
│  │ PenFed below $10k floor.    ││
│  │ Ensure W-2 arrives first.   ││
│  │ [View Amex Plan →]          ││
│  └─────────────────────────────┘│
│                                 │
│  [← Jul 24]        [Jul 26 →]  │
│                                 │
├─────────────────────────────────┤
│  🏠      📅      💰      📤      ⚙  │
└─────────────────────────────────┘
```

---

## Calendar Month View (Context)

```
┌─ July 2026 ──────────────────────────────────────────────┐
│                                                          │
│  Su    Mo    Tu    We    Th    Fr    Sa                  │
│        1🟡   2🟡   3🟡   4🟡   5🟡                      │
│  6🟡   7🟡   8🟡   9🟡  10🟡  11🟡  12🟡               │
│ 13🟡  14🟡  15🟠  16🟡  17🟡  18🟡  19🟡               │
│ 20🟠  21🟠  22🟠  23🟠  24🟠 [25🔴] 26🟡               │
│ 27🟡  28🟡  29🟡  30🟡  31🟡                           │
│                                                          │
│  Event dots below date numbers:                          │
│  • green = income   • red = debt   • blue = bill         │
│  • gold = purchase  • gray = transfer                    │
│                                                          │
│  25 = RED border (Amex $15k payment day)                 │
│  15 = ORANGE (Porsche payment $5,700)                    │
│  20 = ORANGE (401k repayment $600)                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Component Notes

### Day Summary Card
- Top of detail panel
- Ending balance and safe-to-spend prominently displayed
- Income/expense net shown as +/- line items
- Risk level color on header (RED for Jul 25)

### Event Cards
- Color-coded left border by `CalendarEventType`:
  - BILL: blue
  - INCOME / PAYDAY: green
  - DEBT_PAYMENT: red
  - PURCHASE: gold
  - TRANSFER: gray
- Amount with direction arrow (→ account for income, ← account for expenses)
- Debt payments show remaining balance and utilization after payment

### Account Balances Table
- End-of-day projected balances per account
- Warning icon (⚠) when below `minimumTargetBalance`
- Credit card balances shown as negative (liability)
- Collapsed on mobile (show top 3 + "Show all")

### Suggested Action Card
- Only shown when risk level is ORANGE or RED
- Engine-generated from `computeOverdraftRisk()`
- Actionable link to relevant page (credit, accounts, transfer)
- Gold lightning bolt icon

### Day Navigation
- Previous/next day arrows
- Keyboard shortcuts: ← → on desktop
- Swipe left/right on mobile

---

## Example Days for Reference

### July 20 (ORANGE) — 401(k) Repayment

| Field | Value |
|-------|-------|
| Events | 401(k) Repayment −$600 |
| Risk | ORANGE (approaching floor) |
| STS | ~$3,900 |

### August 15 (ORANGE) — Amex + Car Week

| Field | Value |
|-------|-------|
| Events | Amex Payment −$5,000, Monterey Car Week −$2,500 |
| Risk | ORANGE |
| STS | Depends on August income |

### September 1 (ORANGE) — LaGrange Trip

| Field | Value |
|-------|-------|
| Events | LaGrange Family Road Trip −$6,500 |
| Risk | ORANGE |
| STS | Depends on September income |

---

## Risk Level Calculation

```typescript
function riskFromBalance(balance, floor) {
  if (balance < 0)        return RED;
  if (balance < floor)    return ORANGE;
  if (balance < floor×1.5) return YELLOW;
  return GREEN;
}
```

For July 25:
- PenFed Checking after events: $24,032 + $5,000 − $15,000 = $14,032
- Floor: $10,000
- $14,032 < $15,000 (floor × 1.5) → **ORANGE** per account
- Aggregate STS = $0 → day rated **RED**

---

## Interactions

| Action | Result |
|--------|--------|
| Click event card | Expand event details |
| Click account row | Navigate to `/accounts/{id}` |
| Click "View Amex Plan" | Navigate to `/credit` |
| Click [← →] arrows | Navigate to adjacent day |
| Click calendar date | Close panel / switch day |
| Swipe down (mobile) | Close day detail, return to month view |

---

## Related Documents

- [User Flows: Calendar Day Detail](../user-flows.md#8-calendar-day-detail)
- [Cash Flow Rules: Amex Payoff](../cash-flow-rules.md#61-amex-staged-payoff)
- [Safe-to-Spend: July Example](../safe-to-spend.md#52-horizon-this-month-through-july-31)
- [Dashboard Desktop](./dashboard-desktop.md) — 7-day risk strip links here
