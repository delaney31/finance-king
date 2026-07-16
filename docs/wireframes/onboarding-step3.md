# Wireframe: Onboarding Step 3 — Income & Routing

**Route:** `/onboarding/3`  
**Step:** 3 of 5 — "Income & Routing Rules"  
**Theme:** Navy background, gold progress indicator

---

## Layout Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                    ■ FINANCE KING                                        │
│                                                                          │
│     ●━━━━━━━━━●━━━━━━━━━●─────────○─────────○                           │
│     Accounts   Income    Bills   Preferences  Launch                     │
│                  ▲                                                       │
│               (step 3, gold)                                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Income Sources & Routing                                          │  │
│  │  Tell us where your money comes from and where it should go.       │  │
│  │                                                                    │  │
│  │  ── Income Sources ──────────────────────────────────────────────  │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ Name              Amount     Frequency   Expected    Tag     │  │  │
│  │  ├──────────────────────────────────────────────────────────────┤  │  │
│  │  │ W-2 Income        $10,000    Monthly     1st         PERSONAL│  │  │
│  │  │ Existing Contract $18,600    Monthly     1st         JADE    │  │  │
│  │  │ New Contract      $18,200    Monthly     15th        JADE    │  │  │
│  │  │ Turo/Pacific Luxe $5,000     Monthly     10th        PACIFIC │  │  │
│  │  │ NY Rental Income  $4,300     Monthly     5th         NY_PROP │  │  │
│  │  │ Diminished Value  $4,000     One-time    Jul 28      PERSONAL│  │  │
│  │  │                                           ⚠ provisional      │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  [+ Add Income Source]                                             │  │
│  │                                                                    │  │
│  │  ── Routing Rules ─────────────────────────────────────────────────  │  │
│  │  When income arrives, how should it be allocated?                  │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │                                                                │  │  │
│  │  │  W-2 Income (w2)                                               │  │  │
│  │  │  ┌────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │  100%  ──────────────────────────►  PenFed Checking     │   │  │  │
│  │  │  └────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                                                │  │  │
│  │  │  Contract Income (contract)                                    │  │  │
│  │  │  ┌────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │   65%  ──────────────────────────►  Truist Checking     │   │  │  │
│  │  │  │   35%  ──────────────────────────►  Truist Tax Reserve  │   │  │  │
│  │  │  └────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                                                │  │  │
│  │  │  Turo / Pacific Luxe (turo)                                    │  │  │
│  │  │  ┌────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │  100%  ──────────────────────────►  Mercury Checking    │   │  │  │
│  │  │  └────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                                                │  │  │
│  │  │  NY Rental Income (ny_rent)                                    │  │  │
│  │  │  ┌────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │  100%  ──────────────────────────►  Wells Fargo Joint    │   │  │  │
│  │  │  └────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                                                │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  [+ Add Routing Rule]                                              │  │
│  │                                                                    │  │
│  │  ── Routing Preview ─────────────────────────────────────────────  │  │
│  │                                                                    │  │
│  │  Example: $18,600 contract payment on Aug 1                        │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │                                                            │  │  │
│  │  │  $18,600 ──┬── 65% ──► Truist Checking      $12,090       │  │  │
│  │  │            └── 35% ──► Truist Tax Reserve    $6,510       │  │  │
│  │  │                                                            │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │ 💡 Tip: The 35% tax reserve split helps ensure you have     │   │  │
│  │  │ enough set aside for quarterly estimated tax payments.      │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│              [← Back]                              [Continue →]          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Add Income Source Modal

```
┌─────────────────────────────────────────┐
│  Add Income Source                  ✕  │
│                                         │
│  Name                                   │
│  ┌─────────────────────────────────┐    │
│  │ W-2 Income                      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Amount          Frequency              │
│  ┌──────────┐   ┌──────────────────┐    │
│  │ $10,000  │   │ Monthly        ▾ │    │
│  └──────────┘   └──────────────────┘    │
│                                         │
│  Expected Date (next occurrence)        │
│  ┌─────────────────────────────────┐    │
│  │ 2026-08-01                      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Routing Tag                            │
│  ┌─────────────────────────────────┐    │
│  │ PERSONAL                      ▾ │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ☐ Mark as provisional (uncertain)      │
│                                         │
│  Income Source Key (for routing)        │
│  ┌─────────────────────────────────┐    │
│  │ w2                              │    │
│  └─────────────────────────────────┘    │
│                                         │
│         [Cancel]    [Add Income]        │
└─────────────────────────────────────────┘
```

---

## Component Notes

### Progress Bar
- 5 steps: Accounts → Income → Bills → Preferences → Launch
- Completed steps: gold filled circle
- Current step: gold ring
- Future steps: muted gray

### Income Source Table
- Editable inline (tap row to edit)
- Provisional income: amber warning icon + "provisional" badge
- Routing tag shown as colored badge
- Amount in DM Mono

### Routing Rules Visual
- Flow diagram style: percentage → arrow → account name
- Contract split visually emphasized (65/35)
- Account names link to account detail
- Percentages must sum to 100% per income key (validation)

### Routing Preview
- Live calculation based on entered values
- Updates when amounts or percentages change
- Shows dollar amounts, not just percentages

### Tip Card
- Muted navy card with gold lightbulb icon
- Contextual tips per step
- This step: explains tax reserve rationale

---

## Validation Rules

| Rule | Error Message |
|------|---------------|
| At least 1 income source | "Add at least one income source" |
| Routing allocations sum to 100% | "Contract routing must total 100% (currently 90%)" |
| Income key unique per routing group | "Duplicate routing key" |
| Amount > 0 | "Amount must be positive" |
| Expected date required for one-time | "Select expected date" |

---

## Seed Data Pre-Population

When seeding or using demo mode, this step pre-fills:

| Income | Amount | Frequency | Key |
|--------|--------|-----------|-----|
| W-2 Income | $10,000 | Monthly | `w2` |
| Existing Contract | $18,600 | Monthly | `contract` |
| New Contract | $18,200 | Monthly | `contract` |
| Turo/Pacific Luxe | $5,000 | Monthly | `turo` |
| NY Rental Income | $4,300 | Monthly | `ny_rent` |
| Diminished Value | $4,000 | One-time | — (provisional) |

---

## Navigation

| Button | Action |
|--------|--------|
| ← Back | Return to Step 2 (Accounts) — data preserved |
| Continue → | Validate → proceed to Step 4 (Bills) |
| + Add Income Source | Open modal |
| + Add Routing Rule | Open routing rule editor |

---

## Related Documents

- [User Flows: Onboarding](../user-flows.md#2-onboarding-wizard)
- [Cash Flow Rules: Income Routing](../cash-flow-rules.md#3-income-routing-rules)
- [Seed Data Plan](../seed-data-plan.md#4-income-routing-rules-5-rules)
