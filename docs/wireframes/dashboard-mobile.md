# Wireframe: Dashboard (Mobile)

**Route:** `/dashboard`  
**Viewport:** 375×812 (iPhone)  
**Theme:** Navy background, gold accents, PWA standalone mode

---

## Layout Overview

```
┌─────────────────────────────────┐
│ ■ FINANCE KING          🔔 ⚠  ☰ │
├─────────────────────────────────┤
│                                 │
│  SAFE TO SPEND                  │
│  ┌─────────────────────────────┐│
│  │                             ││
│  │        $4,532.26            ││
│  │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ││
│  │     (gold, 36px mono)       ││
│  │                             ││
│  │  ⚠ PROVISIONAL              ││
│  │                             ││
│  │  As of Jul 16, 2026         ││
│  └─────────────────────────────┘│
│                                 │
│  ┌───────┐┌───────┐┌───────┐┌───────┐
│  │ Today ││ Week  ││ Month ││Payday │
│  │$4,532 ││$4,532 ││  $0   ││$4,532 │
│  │  ●    ││       ││  ●    ││       │
│  └───────┘└───────┘└───────┘└───────┘
│                                 │
│  ┌─ Alert Banner ──────────────┐│
│  │ ⚠ Amex Payment Due          ││
│  │ $15,000 due Jul 25. Fund    ││
│  │ PenFed checking.    [View]  ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─ KPI Stack ─────────────────┐│
│  │                             ││
│  │  Liquid Cash    $65,032.26  ││
│  │  ─────────────────────────  ││
│  │  Emergency      $40,000 ✓   ││
│  │  Tax Reserve    $0 / $30k   ││
│  │  ████░░░░░░░░░░░░  0%       ││
│  │  ─────────────────────────  ││
│  │  Total Debt     $30,000     ││
│  │  Utilization    85.7%  🔴   ││
│  │  ─────────────────────────  ││
│  │  Health Score   62 Stable   ││
│  │  ████████░░░░░░░░  62%      ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─ 7-Day Risk ─────────────────┐
│  │                              │
│  │ 16  17  18  19  20  21  22  │
│  │ 🟡  🟡  🟡  🟡  🟠  🟠  🔴  │
│  │                              │
│  │ ← swipe for more days →     │
│  └──────────────────────────────┘
│                                 │
│  ┌─ Recommendation ─────────────┐
│  │ ⚡ Fund Amex Payoff          │
│  │ Transfer $15k to PenFed     │
│  │ before Jul 25.              │
│  │ [View Credit Plan →]        │
│  └──────────────────────────────┘
│                                 │
│  ┌─ Scenarios ──────────────────┐
│  │                              │
│  │  ←  [Base]  [Strong]  →     │
│  │                              │
│  │  Year-End Buffer             │
│  │  Base:     -$8,200           │
│  │  Strong:   +$2,100           │
│  │  + ESOP:   +$107,100         │
│  │                              │
│  │  [Compare All →]             │
│  └──────────────────────────────┘
│                                 │
│  ┌─ Quick Actions ──────────────┐
│  │                              │
│  │  [📤 Upload]  [💳 Credit]    │
│  │  [📅 Calendar] [🛒 Simulate] │
│  │                              │
│  └──────────────────────────────┘
│                                 │
├─────────────────────────────────┤
│  🏠      📅      💰      📤      ⚙  │
│  Home  Calendar Accounts Upload More│
└─────────────────────────────────┘
```

---

## Component Notes

### Safe to Spend Hero (Mobile)
- Full-width card, no side margins
- Font size 36px (down from 48px desktop)
- Provisional badge inline below amount
- Horizon tabs: horizontal scroll if needed

### Alert Banner
- Full-width, amber/orange background tint
- Dismissible with swipe or X button
- Tapping "View" navigates to `/credit`
- Shows most urgent alert only (not full list)

### KPI Stack
- Single column, full-width rows
- Divider lines between sections
- Progress bars for tax reserve and health score
- Utilization shown with red dot when > 30%

### 7-Day Risk Strip
- Horizontally scrollable
- Larger touch targets (44px min)
- Tap day → navigate to calendar day detail
- Today highlighted with gold ring

### Scenario Carousel
- Swipeable cards (Base default, Strong next)
- Conservative accessible via "Compare All"
- ESOP row highlighted in gold when present

### Bottom Navigation
- Fixed bottom bar, 5 items
- Active item: gold icon + label
- Matches PWA `start_url: /dashboard`
- Safe area padding for iPhone notch

### Quick Actions
- 2×2 grid of action buttons
- Upload, Credit, Calendar, Simulate Purchase
- Gold outline buttons on navy card background

---

## Mobile-Specific Interactions

| Gesture | Action |
|---------|--------|
| Pull down | Refresh dashboard data |
| Swipe left on alert | Dismiss alert |
| Tap STS amount | Expand breakdown (liquid − committed) |
| Long press account | Quick balance update |
| Swipe scenario cards | Switch between Base/Strong/Conservative |

---

## PWA Behavior

| Setting | Value |
|---------|-------|
| `display` | standalone (no browser chrome) |
| `theme_color` | `#0a1628` (status bar) |
| `background_color` | `#060d18` (splash screen) |
| `orientation` | portrait-primary |

---

## Responsive Breakpoint

This layout applies at `< 768px`. At `768px+`, see [Dashboard Desktop](./dashboard-desktop.md).

---

## Related Wireframes

- [Dashboard Desktop](./dashboard-desktop.md)
- [Calendar Day Detail](./calendar-day-detail.md)
