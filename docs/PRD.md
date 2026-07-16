# Finance King — Product Requirements Document

**Version:** 0.1.0  
**Last updated:** July 2026  
**Status:** Active development

---

## 1. Executive Summary

Finance King is a premium personal financial command center for high-complexity households that manage personal, joint, and multi-entity business finances across many institutions. Unlike generic budgeting apps, Finance King centers on a **safe-to-spend engine** that answers one question with confidence: *How much can I actually spend today without breaking bills, reserves, debt plans, or protected goals?*

The initial user profile (seed data) reflects Timothy Delaney's real financial topology: PenFed personal accounts, Wells Fargo joint NY property accounts, Truist JadeSystems business accounts, Mercury Pacific Luxe accounts, Amex credit card payoff planning, ESOP scenario modeling, and committed lifestyle purchases (Car Week, family trips, vehicle wrap).

---

## 2. Problem Statement

### 2.1 User Pain

| Pain | Description |
|------|-------------|
| Fragmented visibility | Cash is spread across 10+ accounts at 5+ institutions with different purposes (personal, business, joint, tax reserve, emergency). |
| False confidence | Bank balances include money already spoken for (mortgage, rent, Amex payoff, tax reserve). |
| Timing risk | Large income (contract payments, W-2, rental) and large outflows (Amex $15k payment) don't align on a simple monthly budget. |
| Business/personal bleed | Contract income must be split 65/35 between operating and tax reserve without manual spreadsheet work. |
| Credit complexity | $30k Amex balance at 85.7% utilization with a staged payoff plan that competes with lifestyle spending. |
| Scenario uncertainty | ESOP liquidity event ($105k in Strong scenario) and new contract timing materially change year-end buffer. |

### 2.2 Why Existing Tools Fail

- **Mint/YNAB:** Treat all account balances as spendable; weak business entity separation.
- **Spreadsheets:** Accurate but stale, no OCR ingestion, no real-time safe-to-spend horizons.
- **Personal Capital:** Good net worth, poor cash-flow timing and purchase-impact simulation.

---

## 3. Product Vision

> A navy-and-gold financial command center that protects reserves, routes income correctly, and tells you exactly what is safe to spend — today, this week, this month, and by next payday.

### 3.1 Design Principles

1. **Conservative by default** — Safe-to-spend subtracts committed obligations before showing a number.
2. **Provisional when uncertain** — Missing due dates or provisional income flag results as incomplete.
3. **Entity-aware** — Personal, joint, and business cash are never silently commingled.
4. **Privacy-first OCR** — Local OCR mode keeps statement images off third-party APIs by default.
5. **Actionable, not advisory** — Show math and recommendations; never claim to be a fiduciary.

---

## 4. Target Users

### 4.1 Primary Persona: "Timothy" (Seed User)

- W-2 employee + independent contractor (JadeSystems LLC)
- Side business (Pacific Luxe / Turo rental income via Mercury)
- Joint property owner (NY rental via Wells Fargo)
- High fixed obligations (~$26k/month housing + vehicle)
- Active debt payoff plan (Amex)
- ESOP-eligible with optional liquidity modeling

### 4.2 Secondary Personas (Future)

| Persona | Need |
|---------|------|
| ADVISOR role | Read-only household view for CPA/financial advisor |
| EMPIRE tier | Multi-household, white-label, API access |

---

## 5. Goals & Success Metrics

### 5.1 Product Goals (MVP)

| Goal | Metric |
|------|--------|
| Accurate safe-to-spend | Engine unit tests pass; dashboard STS within $1 of manual spreadsheet |
| Onboarding < 15 min | User can enter accounts + income routing and see dashboard |
| OCR upload → review | Statement uploaded, extracted, reviewed, confirmed in < 5 min |
| Amex payoff visibility | Calendar shows staged payments; credit page shows utilization targets |
| Scenario comparison | Conservative / Base / Strong year-end buffer displayed side-by-side |

### 5.2 Business Goals

| Tier | Price (planned) | Features |
|------|-----------------|----------|
| FREE | $0 | Manual entry, 5 OCR pages/month |
| KING | $19/mo | Full engine, 50 OCR pages/month, scenarios |
| EMPIRE | $49/mo | Multi-entity, advisor seats, 200 OCR pages/month |

---

## 6. Core Features

### 6.1 Safe-to-Spend Engine (P0)

The flagship feature. Computes spendable cash across four horizons:

- **Today** — obligations due today only
- **This week** — through Sunday
- **This month** — through month-end
- **Next payday** — through next W-2 deposit

Formula documented in [`safe-to-spend.md`](./safe-to-spend.md).

### 6.2 Account Topology (P0)

Support the full account map:

| Institution | Accounts | Routing Tag |
|-------------|----------|-------------|
| PenFed | Personal Checking, Premium Online Savings | PERSONAL, EMERGENCY |
| Wells Fargo | Joint Checking, Joint Savings | NY_PROPERTY |
| Truist | JadeSystems Checking, Tax Reserve | JADESYSTEMS, TAX_RESERVE |
| Mercury | Pacific Luxe Checking, Savings | PACIFIC_LUXE |
| Current | Checking, Savings | PERSONAL |
| American Express | Credit Card | PERSONAL (liability) |

### 6.3 Income Routing Rules (P0)

Automated allocation on income recognition:

| Income Source Key | Target | Allocation |
|-------------------|--------|------------|
| `w2` | PenFed Personal Checking | 100% |
| `contract` | Truist JadeSystems Checking | 65% |
| `contract` | Truist Tax Reserve | 35% |
| `turo` | Mercury Pacific Luxe Checking | 100% |
| `ny_rent` | Wells Fargo Joint Checking | 100% |

### 6.4 Cash Flow Calendar (P0)

Unified calendar for bills, paydays, debt payments, statement closes, planned purchases, and transfers. Color-coded risk levels (GREEN → RED).

### 6.5 OCR Statement Ingestion (P1)

Upload bank/credit statements → local Tesseract OCR → field extraction → human review → confirmed transactions. See [`ocr-ingestion.md`](./ocr-ingestion.md).

### 6.6 Credit & Debt Planning (P1)

- Utilization targets at 30%, 10%, 5%
- Avalanche and snowball payoff projections
- Amex staged payoff: $15k (Jul 25), $5k (Aug 15), $5k (Sep 15), $5k (Oct 15)
- Educational disclaimers (not credit counseling)

### 6.7 Scenario Modeling (P1)

| Scenario | Income | Expenses | ESOP | New Contract (post-Oct) |
|----------|--------|----------|------|-------------------------|
| Conservative | ×0.9 | ×1.1 | No | No |
| Base | ×1.0 | ×1.0 | No | No |
| Strong | ×1.0 | ×1.0 | $105,000 | Yes |

### 6.8 Purchase Impact Simulator (P2)

"What if I buy X?" — simulates effect on safe-to-spend, protected reserves, month-end buffer, and year-end buffer. Returns recommendation: proceed / reduce / delay / decline.

### 6.9 Alerts & Recommendations (P2)

Proactive notifications:

- Upcoming Amex payment before PenFed is funded
- Low balance / overdraft risk
- High utilization
- Unreviewed uploads
- Tax reserve shortfall

---

## 7. User Stories

### 7.1 Onboarding

```
AS A new user
I WANT to set up my accounts, income sources, and routing rules
SO THAT the dashboard reflects my real financial topology on first load
```

**Acceptance criteria:**
- Step 1: Create account (email/password)
- Step 2: Add financial accounts (institution, type, balance, routing tag)
- Step 3: Configure income sources + routing rules
- Step 4: Set safety margin preferences ($500 flat default)
- Step 5: Review dashboard with provisional flags for incomplete data

### 7.2 Dashboard

```
AS A logged-in user
I WANT to see safe-to-spend, liquid cash, and risk indicators
SO THAT I know what I can spend without checking five bank apps
```

**Acceptance criteria:**
- Hero KPI: Safe to Spend (today) in gold monospace
- Secondary: This week / This month / Next payday
- Protected reserves bar (emergency $40k, tax reserve $30k target)
- 7-day risk strip (GREEN/YELLOW/ORANGE/RED)
- Scenario cards: year-end buffer with/without ESOP

### 7.3 Upload Statement

```
AS A user
I WANT to photograph a bank statement and have transactions extracted
SO THAT I don't manually enter every line item
```

**Acceptance criteria:**
- Drag-drop or camera capture
- Duplicate detection via file hash
- Review screen with confidence scores per field
- Confirm → creates transactions linked to document

### 7.4 Amex Payoff

```
AS A user with high credit utilization
I WANT to see my staged payoff plan and utilization targets
SO THAT I can track progress toward <30% utilization
```

**Acceptance criteria:**
- Current utilization: 85.7% ($30k / $35k)
- Payment schedule on calendar
- Alert when PenFed balance insufficient for upcoming $15k payment

---

## 8. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Dashboard loads < 2s on 4G; engine snapshot < 200ms |
| Security | JWT sessions, bcrypt passwords, encrypted document storage, tenant isolation |
| Privacy | `localOcrOnly` default true; optional auto-delete uploads |
| Availability | 99.5% uptime target on Vercel + Neon |
| Accessibility | WCAG 2.1 AA for core flows; tabular nums for amounts |
| Mobile | PWA manifest; responsive dashboard; portrait-primary |
| Theme | Navy (#0a1628) / gold (#c9a227) dark-first design system |

---

## 9. Out of Scope (v0.1)

- Live bank aggregation (Plaid/Finicity)
- Tax filing or CPA workflow
- Investment portfolio rebalancing
- Multi-user household editing (read-only advisor later)
- Automated bill pay execution
- Cryptocurrency tracking

---

## 10. Release Phases

### Phase 1 — Engine + Seed (current)

- [x] Prisma schema
- [x] Financial engine (safe-to-spend, overdraft, credit, scenarios)
- [x] Seed data for Timothy's profile
- [x] Auth middleware
- [x] Theme system (navy/gold)
- [ ] Dashboard UI
- [ ] Onboarding wizard

### Phase 2 — Ingestion + Calendar

- [ ] OCR upload pipeline
- [ ] Transaction review UI
- [ ] Cash flow calendar
- [ ] Alerts engine

### Phase 3 — Planning Tools

- [ ] Purchase impact simulator UI
- [ ] Credit payoff planner UI
- [ ] Scenario comparison charts
- [ ] Stripe subscription billing

---

## 11. Open Questions

1. Should provisional income (Diminished Value $4k) be included in safe-to-spend by default or opt-in?
2. When contract income splits 65/35, should the engine model the split at deposit time or at safe-to-spend calculation time?
3. Should ESOP appear only in Strong scenario or as a toggle on Base?
4. Wells Fargo joint accounts: does Timothy have signatory authority for safe-to-spend, or view-only?

---

## 12. References

- Engine implementation: `src/lib/engine/`
- Database schema: `prisma/schema.prisma`
- Seed profile: `prisma/seed.ts`
- Architecture: [`architecture.md`](./architecture.md)
- Safe-to-spend formula: [`safe-to-spend.md`](./safe-to-spend.md)
