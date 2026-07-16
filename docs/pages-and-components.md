# Finance King — Pages & Components

Route inventory, layout structure, and component catalog for the Finance King application.

**Theme:** Navy (`#0a1628`) background, gold (`#c9a227`) accents, DM Sans + DM Mono fonts.  
**Status legend:** ✅ Implemented · 🔲 Planned · 🚧 Partial

---

## 1. Route Map

### 1.1 Public Routes

| Route | Status | Purpose | Auth |
|-------|--------|---------|------|
| `/` | 🚧 | Landing page — hero, features, CTA to register | Public |
| `/login` | 🔲 | Email/password sign-in | Public |
| `/register` | 🔲 | Account creation | Public |
| `/privacy` | 🔲 | Privacy policy | Public |
| `/terms` | 🔲 | Terms of service | Public |
| `/api/auth/*` | ✅ | NextAuth handlers | Public |

### 1.2 Protected Routes — Core

| Route | Status | Purpose |
|-------|--------|---------|
| `/dashboard` | 🔲 | Main command center — safe-to-spend, KPIs, risk strip |
| `/onboarding` | 🔲 | Multi-step setup wizard |
| `/onboarding/[step]` | 🔲 | Individual wizard steps (1–5) |
| `/accounts` | 🔲 | Account list, balances, routing tags |
| `/accounts/[id]` | 🔲 | Account detail, balance history, transactions |
| `/accounts/new` | 🔲 | Add financial account |

### 1.3 Protected Routes — Cash Flow

| Route | Status | Purpose |
|-------|--------|---------|
| `/calendar` | 🔲 | Monthly calendar with events and risk colors |
| `/calendar/[date]` | 🔲 | Day detail panel |
| `/income` | 🔲 | Income sources list and schedule |
| `/income/new` | 🔲 | Add income source |
| `/bills` | 🔲 | Recurring bills management |
| `/bills/new` | 🔲 | Add bill |
| `/transactions` | 🔲 | Transaction history with filters |
| `/transactions/[id]` | 🔲 | Transaction detail / edit |

### 1.4 Protected Routes — Planning

| Route | Status | Purpose |
|-------|--------|---------|
| `/credit` | 🔲 | Credit cards, utilization, payoff plans |
| `/credit/payoff` | 🔲 | Avalanche vs snowball comparison |
| `/scenarios` | 🔲 | Conservative / Base / Strong comparison |
| `/purchases` | 🔲 | Planned purchases (Car Week, trips, wrap) |
| `/purchases/simulate` | 🔲 | Purchase impact simulator |
| `/goals` | 🔲 | Savings goals (emergency, tax reserve) |

### 1.5 Protected Routes — Ingestion

| Route | Status | Purpose |
|-------|--------|---------|
| `/upload` | 🔲 | Document upload (drag-drop, camera) |
| `/upload/review/[id]` | 🔲 | OCR extraction review and confirm |
| `/upload/history` | 🔲 | Past uploads and statuses |

### 1.6 Protected Routes — Settings

| Route | Status | Purpose |
|-------|--------|---------|
| `/settings` | 🔲 | User preferences hub |
| `/settings/profile` | 🔲 | Name, email, password |
| `/settings/preferences` | 🔲 | Safety margin, theme, timezone |
| `/settings/routing` | 🔲 | Income routing rules editor |
| `/settings/privacy` | 🔲 | OCR mode, auto-delete, consents |
| `/settings/subscription` | 🔲 | Plan tier, Stripe billing |
| `/settings/notifications` | 🔲 | Email/push/SMS toggles |

### 1.7 API Routes (Planned)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth session |
| `/api/dashboard` | GET | Dashboard snapshot JSON |
| `/api/engine/safe-to-spend` | GET | STS computation |
| `/api/engine/simulate-purchase` | POST | Purchase impact |
| `/api/uploads/presign` | POST | S3 presigned upload URL |
| `/api/uploads/[id]/process` | POST | Enqueue OCR job |
| `/api/uploads/[id]/confirm` | POST | Confirm extraction → transactions |
| `/api/uploads/[id]/reject` | POST | Reject extraction |
| `/api/accounts` | GET/POST | Account CRUD |
| `/api/accounts/[id]` | GET/PATCH/DELETE | Single account |
| `/api/alerts` | GET/PATCH | Alert list and mark-read |
| `/api/scenarios` | GET | Run all scenarios |

---

## 2. Layout Structure

```
RootLayout (src/app/layout.tsx) ✅
├── ThemeProvider (dark default)
├── DM Sans + DM Mono fonts
└── children
    │
    ├── (public)/layout.tsx 🔲
    │   ├── Header (logo, login CTA)
    │   └── Footer
    │
    ├── (auth)/layout.tsx 🔲
    │   └── Centered card (login, register)
    │
    └── (app)/layout.tsx 🔲
        ├── AppShell
        │   ├── Sidebar (desktop) / BottomNav (mobile)
        │   ├── TopBar (alerts, user menu)
        │   └── Main content area
        └── children (page content)
```

### 2.1 App Shell Navigation

| Nav Item | Route | Icon |
|----------|-------|------|
| Dashboard | `/dashboard` | LayoutDashboard |
| Calendar | `/calendar` | Calendar |
| Accounts | `/accounts` | Wallet |
| Upload | `/upload` | Upload |
| Credit | `/credit` | CreditCard |
| More | `/settings` | Menu |

---

## 3. Component Inventory

### 3.1 UI Primitives (`src/components/ui/`) — ✅ Implemented

| Component | File | Usage |
|-----------|------|-------|
| `Button` | `button.tsx` | CTAs, form submits |
| `Card` | `card.tsx` | KPI cards, content panels |
| `Input` | `input.tsx` | Form fields, amount entry |
| `Label` | `label.tsx` | Form labels |
| `Badge` | `badge.tsx` | Status chips (provisional, risk level) |
| `Alert` | `alert.tsx` | Warning banners |
| `Progress` | `progress.tsx` | Goal progress, utilization bars |

### 3.2 Theme — ✅ Implemented

| Component | File | Usage |
|-----------|------|-------|
| `ThemeProvider` | `theme-provider.tsx` | Dark/light mode via `next-themes` |

### 3.3 Dashboard Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `SafeToSpendHero` | Gold monospace STS number with horizon tabs |
| `KpiCard` | Reusable metric card (`.kpi-card` class) |
| `RiskStrip` | 7-day horizontal risk indicator |
| `ProtectedReservesBar` | Emergency + tax reserve progress |
| `ScenarioComparison` | Three-column scenario cards |
| `HealthScoreGauge` | Financial health score (0–100) |
| `AlertBanner` | Dismissible alert with severity color |
| `RecommendationCard` | Actionable recommendation with link |
| `OverdraftWarning` | Account-specific overdraft risk |
| `QuickActions` | Upload, simulate, view calendar |

### 3.4 Account Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `AccountCard` | Institution, nickname, balance, routing tag badge |
| `AccountList` | Grouped by routing tag or institution |
| `BalanceHistoryChart` | Line chart from AccountBalanceSnapshot |
| `RoutingTagBadge` | Color-coded tag (PERSONAL, JADESYSTEMS, etc.) |
| `AccountForm` | Create/edit financial account |

### 3.5 Calendar Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `CalendarGrid` | Month view with event dots |
| `CalendarDay` | Single day cell with risk color border |
| `DayDetailPanel` | Slide-over with events, balances, STS |
| `CalendarEventChip` | Typed event pill (BILL, PAYDAY, etc.) |
| `EventTypeIcon` | Icon per CalendarEventType |

### 3.6 Credit Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `UtilizationGauge` | Circular or bar utilization display |
| `UtilizationTargets` | 30% / 10% / 5% payment needed table |
| `PayoffTimeline` | Amex staged payment schedule |
| `StrategyComparison` | Avalanche vs snowball side-by-side |
| `CreditDisclaimer` | Educational disclaimer footer |

### 3.7 Upload Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `UploadDropzone` | Drag-drop area with file type validation |
| `UploadProgress` | Upload + processing progress bar |
| `ExtractionReview` | Field-by-field review with confidence |
| `ConfidenceBadge` | High/medium/low confidence indicator |
| `TransactionPreview` | Table of extracted transactions |
| `UploadHistory` | Past uploads with status badges |

### 3.8 Onboarding Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `OnboardingWizard` | Step indicator + navigation |
| `AccountSetupStep` | Bulk account entry |
| `IncomeRoutingStep` | Income sources + routing rules |
| `BillsSetupStep` | Recurring bill entry |
| `PreferencesStep` | Safety margin, theme, privacy |
| `OnboardingSummary` | Review before launch |

### 3.9 Form & Input Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `MoneyInput` | Currency input with DM Mono, decimal handling |
| `RoutingRuleEditor` | Income key → account allocation rows |
| `InstitutionSelect` | Dropdown with common institutions |
| `RoutingTagSelect` | Tag picker with descriptions |
| `DatePicker` | Date selection for bills, income |
| `FrequencySelect` | Income/bill frequency enum picker |

### 3.10 Chart Components — 🔲 Planned

| Component | Purpose |
|-----------|---------|
| `CashFlowChart` | Recharts line/area — monthly ending cash |
| `DailyBalanceChart` | 30/90-day projection from overdraft engine |
| `SpendingBreakdown` | Category donut chart |
| `ScenarioChart` | Multi-line scenario comparison |

---

## 4. CSS Utility Classes

Defined in `src/app/globals.css`:

| Class | Purpose |
|-------|---------|
| `.kpi-card` | Standard KPI card styling (border, bg, padding) |
| `.font-mono-amount` | DM Mono with tabular-nums for money |
| `.risk-green` | GREEN risk text color |
| `.risk-yellow` | YELLOW risk text color |
| `.risk-orange` | ORANGE risk text color |
| `.risk-red` | RED risk text color |

### 4.1 Tailwind Theme Tokens

```
fk-navy, fk-charcoal, fk-gold, fk-risk-red, fk-safe-green,
fk-muted, fk-border, fk-card, fk-foreground, fk-background
```

---

## 5. Page → Engine Mapping

| Page | Engine Functions |
|------|------------------|
| `/dashboard` | `buildDashboardSnapshot()` |
| `/calendar` | `projectDailyBalances()`, `getSevenDayRiskReport()` |
| `/credit` | `computeCreditUtilization()`, `computeUtilizationTargets()`, `buildAvalanchePlan()` |
| `/scenarios` | `runAllScenarios()` |
| `/purchases/simulate` | `simulatePurchaseImpact()` |
| `/accounts` | `computeLiquidCash()`, `computeOperatingCash()` |
| `/goals` | `computeProtectedReserves()` |

---

## 6. Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< 768px` (mobile) | Bottom nav, stacked KPI cards, single column |
| `768px–1024px` (tablet) | Collapsed sidebar, 2-column KPI grid |
| `> 1024px` (desktop) | Full sidebar, 3–4 column KPI grid, calendar side panel |

Wireframes:
- Desktop: [`wireframes/dashboard-desktop.md`](./wireframes/dashboard-desktop.md)
- Mobile: [`wireframes/dashboard-mobile.md`](./wireframes/dashboard-mobile.md)

---

## 7. PWA Configuration

From `public/manifest.json`:

| Field | Value |
|-------|-------|
| `start_url` | `/dashboard` |
| `display` | `standalone` |
| `background_color` | `#060d18` |
| `theme_color` | `#0a1628` |
| `orientation` | `portrait-primary` |

---

## 8. Related Documents

- [User Flows](./user-flows.md) — Mermaid journey diagrams
- [Wireframes](./wireframes/) — ASCII mockups
- [Architecture](./architecture.md) — Layer structure
- [PRD](./PRD.md) — Feature requirements
