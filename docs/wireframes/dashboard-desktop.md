# Wireframe: Dashboard (Desktop)

**Route:** `/dashboard`  
**Viewport:** 1280×800+ (desktop)  
**Theme:** Navy background (`#060d18`), gold accents (`#c9a227`), card surfaces (`#12182a`)

---

## Layout Overview

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ■ FINANCE KING                              🔔 1  ⚠ Amex Payment Due    Timothy ▾  │
│   Your Financial Command Center                                                      │
├────────────┬─────────────────────────────────────────────────────────────────────────┤
│            │                                                                         │
│  Dashboard │  ┌─ Safe to Spend ──────────────────────────────────────────────────┐  │
│  ●         │  │                                                                   │  │
│            │  │   SAFE TO SPEND                          As of Jul 16, 2026      │  │
│  Calendar  │  │   ┌──────────────────────────────────────────────────────────┐   │  │
│            │  │   │                                                          │   │  │
│  Accounts  │  │   │              $4,532.26                                   │   │  │
│            │  │   │              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │   │  │
│  Upload    │  │   │              (gold, DM Mono, 48px)                         │   │  │
│            │  │   │                                                          │   │  │
│  Credit    │  │   └──────────────────────────────────────────────────────────┘   │  │
│            │  │   ⚠ PROVISIONAL — provisional_income                               │  │
│  Scenarios │  │                                                                   │  │
│            │  │   [Today]  [This Week]  [This Month]  [Next Payday]               │  │
│  Purchases │  │    $4,532     $4,532      $0.00         $4,532                  │  │
│            │  └───────────────────────────────────────────────────────────────────┘  │
│  Settings  │                                                                         │
│            │  ┌─ KPI Row ─────────────────────────────────────────────────────────┐  │
│            │  │                                                                     │  │
│            │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │  │
│            │  │  │ Liquid Cash  │ │  Protected   │ │ Total Debt   │ │ Health   │ │  │
│            │  │  │              │ │  Reserves    │ │              │ │ Score    │ │  │
│            │  │  │ $65,032.26   │ │ Emergency    │ │ $30,000.00   │ │   62     │ │  │
│            │  │  │              │ │ $40,000 ✓    │ │              │ │ Stable   │ │  │
│            │  │  │              │ │ Tax $0/$30k  │ │ Util 85.7%   │ │ ████░░   │ │  │
│            │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │  │
│            │  └─────────────────────────────────────────────────────────────────────┘  │
│            │                                                                         │
│            │  ┌─ 7-Day Risk Strip ──────────────────────────────────────────────────┐  │
│            │  │  Jul 16    Jul 17    Jul 18    Jul 19    Jul 20    Jul 21    Jul 22 │  │
│            │  │  ┌────┐   ┌────┐   ┌────┐   ┌────┐   ┌────┐   ┌────┐   ┌────┐  │  │
│            │  │  │ 🟡 │   │ 🟡 │   │ 🟡 │   │ 🟡 │   │ 🟠 │   │ 🟠 │   │ 🔴 │  │  │
│            │  │  │$4.5k│   │$4.5k│   │$4.5k│   │$4.5k│   │$3.9k│   │$3.9k│   │ $0 │  │  │
│            │  │  └────┘   └────┘   └────┘   └────┘   └────┘   └────┘   └────┘  │  │
│            │  │                              ▲ 401k $600        ▲ Amex $15k     │  │
│            │  └───────────────────────────────────────────────────────────────────┘  │
│            │                                                                         │
│            │  ┌─ Scenarios ─────────────────────┐  ┌─ Recommendations ────────────┐ │
│            │  │                                  │  │                              │ │
│            │  │  Conservative   Base    Strong   │  │ ⚡ Fund Amex Payoff          │ │
│            │  │  ─────────────────────────────── │  │ Schedule $15,000 transfer    │ │
│            │  │  Year-End Buffer                 │  │ to PenFed before Jul 25.     │ │
│            │  │  -$12,400      -$8,200   +$2,100 │  │                              │ │
│            │  │                                  │  │ [View Credit Plan →]         │ │
│            │  │  + ESOP                        │  │                              │ │
│            │  │     —            —      +$107k  │  └──────────────────────────────┘ │
│            │  │                                  │                                   │
│            │  │  [Compare Scenarios →]           │  ┌─ Account Summary ──────────────┐ │
│            │  └──────────────────────────────────┘  │                              │ │
│            │                                       │ PenFed Checking    $24,032   │ │
│            │  ┌─ Cash Flow Chart (30 days) ──────┐ │ PenFed Savings     $40,000   │ │
│            │  │                                   │ │ Wells Fargo Joint   $1,000   │ │
│            │  │  $70k ┤                          │ │ Truist Checking         $0   │ │
│            │  │       │    ╭──╮                   │ │ Truist Tax Reserve      $0   │ │
│            │  │  $65k ┤───╯  ╰────╮             │ │ Mercury Checking        $0   │ │
│            │  │       │          ╰──╮  ╭──     │ │ Amex              -$30,000   │ │
│            │  │  $50k ┤             ╰──╯        │ │                              │ │
│            │  │       │      ▲ Amex $15k        │ │ [View All Accounts →]        │ │
│            │  │  $35k ┤                          │ └──────────────────────────────┘ │
│            │  │       └────────────────────── │                                   │
│            │  │        Jul    Aug    Sep         │                                   │
│            │  └───────────────────────────────────┘                                   │
│            │                                                                         │
└────────────┴─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Notes

### Safe to Spend Hero
- Largest element on page; gold (`#c9a227`) DM Mono font
- Horizon tabs below; active tab underlined in gold
- Provisional badge: amber background, warning icon
- Month horizon showing $0 triggers visual emphasis (red tint on tab)

### Sidebar Navigation
- Fixed left sidebar, 240px wide
- Active item: gold left border + gold text
- Icons from Lucide (LayoutDashboard, Calendar, Wallet, Upload, CreditCard)
- Collapses to icon-only at 1024px

### KPI Cards
- `.kpi-card` class: rounded-xl, border `#2a3142`, bg `#12182a`
- Amounts in `.font-mono-amount` (DM Mono, tabular-nums)
- Emergency fund: green checkmark when funded
- Tax reserve: red progress bar showing $0/$30k

### 7-Day Risk Strip
- Color-coded cells: GREEN `#2ecc71`, YELLOW, ORANGE, RED `#e74c3c`
- Event annotations below cells (small muted text)
- Jul 22 RED: Amex $15k payment day

### Scenario Cards
- Three columns: Conservative (muted), Base (default), Strong (gold border)
- ESOP row only populated in Strong scenario
- Negative buffers shown in red

### Recommendation Card
- Gold left border accent
- Priority 1 recommendations pinned to top
- Action link routes to `/credit`

---

## Interactions

| Action | Result |
|--------|--------|
| Click horizon tab | Recalculate STS for selected horizon |
| Click risk strip day | Navigate to `/calendar/2026-07-22` |
| Click "Fund Amex Payoff" | Navigate to `/credit` |
| Click account row | Navigate to `/accounts/{id}` |
| Click 🔔 alert icon | Open alert dropdown |
| Click "Compare Scenarios" | Navigate to `/scenarios` |

---

## Related Wireframes

- [Dashboard Mobile](./dashboard-mobile.md)
- [Calendar Day Detail](./calendar-day-detail.md)
