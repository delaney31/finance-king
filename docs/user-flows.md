# Finance King — User Flows

Mermaid flowcharts for core user journeys. All flows assume navy/gold themed UI with risk color coding (GREEN → RED).

---

## 1. Authentication & First Visit

```mermaid
flowchart TD
    A[Visit financeking.app] --> B{Authenticated?}
    B -->|No| C[Landing Page /]
    C --> D{Has account?}
    D -->|No| E[/register]
    D -->|Yes| F[/login]
    E --> G[Create email + password]
    G --> H[Auto sign-in]
    F --> I[Enter credentials]
    I --> J{Valid?}
    J -->|No| K[Show error]
    K --> F
    J -->|Yes| L{onboardingComplete?}
    B -->|Yes| L
    L -->|No| M[/onboarding]
    L -->|Yes| N[/dashboard]
    H --> M
```

**Middleware rules:**
- Unauthenticated users on protected paths → redirect to `/login?callbackUrl=...`
- Authenticated users on `/login` or `/register` → redirect to `/dashboard`

---

## 2. Onboarding Wizard

Five-step wizard to configure financial topology before first dashboard view.

```mermaid
flowchart TD
    START[Start Onboarding] --> S1[Step 1: Welcome]
    S1 --> S2[Step 2: Add Accounts]
    S2 --> S2A{Add account}
    S2A --> S2B[Institution + type + balance + routing tag]
    S2B --> S2C{More accounts?}
    S2C -->|Yes| S2A
    S2C -->|No| S3[Step 3: Income & Routing]
    
    S3 --> S3A[Add income sources]
    S3A --> S3B[Configure routing rules]
    S3B --> S3C["Example: contract → 65% Truist / 35% Tax Reserve"]
    S3C --> S4[Step 4: Bills & Obligations]
    
    S4 --> S4A[Add recurring bills]
    S4A --> S4B[Set due days + amounts]
    S4B --> S5[Step 5: Preferences]
    
    S5 --> S5A[Safety margin: $500 flat default]
    S5A --> S5B[Theme: dark navy/gold]
    S5B --> S5C[Privacy: local OCR only ✓]
    S5C --> REVIEW[Review Summary]
    
    REVIEW --> CONFIRM{Confirm?}
    CONFIRM -->|Edit| S2
    CONFIRM -->|Launch| DASH[Dashboard — may show provisional flags]
    DASH --> DONE[Set onboardingComplete = true]
```

### 2.1 Onboarding Step 3 Detail (Income & Routing)

This is the most complex step. See wireframe: [`wireframes/onboarding-step3.md`](./wireframes/onboarding-step3.md).

```mermaid
flowchart LR
    subgraph Income Sources
        W2[W-2 Income<br/>$10,000/mo]
        CONTRACT[Contract Income<br/>$18,600/mo]
        TURO[Turo/Pacific Luxe<br/>$5,000/mo]
        RENT[NY Rental<br/>$4,300/mo]
    end

    subgraph Routing Rules
        R1[w2 → 100% PenFed Checking]
        R2[contract → 65% Truist Checking]
        R3[contract → 35% Truist Tax Reserve]
        R4[turo → 100% Mercury Checking]
        R5[ny_rent → 100% Wells Fargo Joint]
    end

    W2 --> R1
    CONTRACT --> R2
    CONTRACT --> R3
    TURO --> R4
    RENT --> R5
```

---

## 3. Dashboard Daily Use

```mermaid
flowchart TD
    LOGIN[User opens app] --> DASH[/dashboard]
    DASH --> LOAD[Server: getEngineSnapshot + buildDashboardSnapshot]
    LOAD --> RENDER[Render KPI cards]
    
    RENDER --> STS[Safe to Spend — TODAY<br/>Gold monospace hero]
    RENDER --> HORIZONS[Week / Month / Payday horizons]
    RENDER --> RESERVES[Protected: Emergency $40k | Tax $30k]
    RENDER --> RISK[7-Day Risk Strip]
    RENDER --> SCENARIOS[Scenario cards: Base vs Strong+ESOP]
    
    STS --> PROV{isProvisional?}
    PROV -->|Yes| WARN[⚠ Provisional badge<br/>provisional_income, bill_due_dates]
    PROV -->|No| CLEAR[✓ Confident number]
    
    RENDER --> ACTIONS{User action}
    ACTIONS --> CAL[/calendar]
    ACTIONS --> UPLOAD[/upload]
    ACTIONS --> CREDIT[/credit]
    ACTIONS --> SIM[Simulate Purchase modal]
    ACTIONS --> ACCT[/accounts]
    
    RENDER --> ALERTS{Unread alerts?}
    ALERTS -->|Yes| ALERT_MODAL[Amex Payment Due warning]
    ALERTS -->|No| DONE[Continue browsing]
```

---

## 4. Statement Upload & OCR Review

```mermaid
flowchart TD
    START[User navigates to /upload] --> CHOOSE{Upload method}
    CHOOSE --> DRAG[Drag & drop PDF/image]
    CHOOSE --> CAMERA[Camera capture — mobile]
    
    DRAG --> VALIDATE{Valid file?}
    CAMERA --> VALIDATE
    VALIDATE -->|Too large| ERR_SIZE[Error: max 10MB]
    VALIDATE -->|Invalid type| ERR_TYPE[Error: PDF/PNG/JPG only]
    VALIDATE -->|OK| HASH[Compute file hash]
    
    HASH --> DUP{Duplicate hash?}
    DUP -->|Yes| DUP_MSG[Status: DUPLICATE<br/>Show previous upload]
    DUP -->|No| PRESIGN[POST /api/uploads/presign]
    
    PRESIGN --> S3[Client PUT to S3/MinIO]
    S3 --> QUEUE[Enqueue OCR job — BullMQ]
    QUEUE --> STATUS_P[Status: PROCESSING]
    
    STATUS_P --> WORKER[Worker: Tesseract OCR]
    WORKER --> EXTRACT[Parse transactions + balances]
    EXTRACT --> FAIL{Success?}
    
    FAIL -->|No| STATUS_F[Status: FAILED<br/>Retry option]
    FAIL -->|Yes| STATUS_R[Status: REVIEW_REQUIRED]
    
    STATUS_R --> REVIEW[/upload/review/:id]
    REVIEW --> SHOW[Show extracted fields + confidence scores]
    SHOW --> EDIT[User edits incorrect fields]
    EDIT --> DECIDE{Confirm?}
    
    DECIDE -->|Reject| REJECT[Status: REJECTED]
    DECIDE -->|Confirm| CONFIRM[Status: CONFIRMED]
    CONFIRM --> TXN[Create Transaction records]
    TXN --> SNAP[Create AccountBalanceSnapshot]
    SNAP --> REFRESH[Dashboard recalculates safe-to-spend]
```

See wireframe: [`wireframes/upload-review.md`](./wireframes/upload-review.md).

---

## 5. Purchase Impact Simulation

```mermaid
flowchart TD
    START[User clicks 'Can I afford this?'] --> FORM[Enter: name, amount, date, account]
    FORM --> SIM[simulatePurchaseImpact]
    
    SIM --> CHECK_EMERG{From EMERGENCY account?}
    CHECK_EMERG -->|Yes| DECLINE[Recommendation: DECLINE<br/>Cannot spend protected reserves]
    
    CHECK_EMERG -->|No| COMPUTE[Compute STS before vs after]
    COMPUTE --> CHECKS{Checks}
    
    CHECKS --> C1[Protected reserves intact?]
    CHECKS --> C2[Above minimum floor?]
    CHECKS --> C3[STS >= 0 after purchase?]
    CHECKS --> C4[Amount <= maxSafeBudget?]
    
    C1 & C2 & C3 & C4 --> REC{Recommendation}
    REC -->|amount > 1.5× budget| DECLINE2[DECLINE]
    REC -->|amount > budget| DELAY[DELAY]
    REC -->|amount > 0.8× budget| REDUCE[REDUCE]
    REC -->|All clear| PROCEED[PROCEED]
    
    PROCEED --> SHOW[Show: month-end buffer, year-end buffer, affected accounts]
    DELAY --> SHOW
    REDUCE --> SHOW
    DECLINE2 --> SHOW
```

**Example:** Monterey Car Week ($2,500) from PenFed Checking — engine checks if $15k Amex payment still fundable.

---

## 6. Amex Payoff Flow

```mermaid
flowchart TD
    START[User visits /credit] --> LOAD[Load Amex: $30k / $35k limit]
    LOAD --> UTIL[Show utilization: 85.7%]
    UTIL --> TARGETS[Utilization targets: 30% / 10% / 5%]
    
    TARGETS --> T30["30% → pay $19,500"]
    TARGETS --> T10["10% → pay $26,500"]
    TARGETS --> T05["5% → pay $28,250"]
    
    LOAD --> PLAN[Staged Payoff Plan]
    PLAN --> P1["Jul 25: $15,000"]
    PLAN --> P2["Aug 15: $5,000"]
    PLAN --> P3["Sep 15: $5,000"]
    PLAN --> P4["Oct 15: $5,000"]
    
    PLAN --> STRAT{Strategy comparison}
    STRAT --> AV[Avalanche: highest APR first]
    STRAT --> SB[Snowball: smallest balance first]
    
    LOAD --> ALERT{PenFed balance sufficient?}
    ALERT -->|No| WARN["⚠ Fund Amex Payoff recommendation<br/>Schedule $15k transfer before Jul 25"]
    ALERT -->|Yes| OK[Green status]
```

---

## 7. Scenario Comparison

```mermaid
flowchart TD
    START[User visits /scenarios] --> LOAD[runAllScenarios]
    LOAD --> THREE[Three scenario cards]
    
    THREE --> CON[Conservative<br/>Income ×0.9, Expenses ×1.1]
    THREE --> BASE[Base<br/>Actual projections]
    THREE --> STR[Strong<br/>+ ESOP $105k, new contract]
    
    CON --> METRICS[Monthly ending cash chart]
    BASE --> METRICS
    STR --> METRICS
    
    METRICS --> COMPARE[Side-by-side comparison]
    COMPARE --> YEB[Year-end buffer]
    COMPARE --> YEBE[Year-end buffer + ESOP]
    COMPARE --> STS[Safe-to-spend this month]
    COMPARE --> DEBT[Remaining debt balance]
```

---

## 8. Calendar Day Detail

```mermaid
flowchart TD
    START[User taps day on /calendar] --> DETAIL[Day Detail Panel]
    
    DETAIL --> SUMMARY[Date + risk level color]
    SUMMARY --> EVENTS[List events for day]
    
    EVENTS --> E1[BILL: NY Mortgage $8,200]
    EVENTS --> E2[PAYDAY: W-2 $10,000]
    EVENTS --> E3[DEBT_PAYMENT: Amex $15,000]
    EVENTS --> E4[PURCHASE: Car Week $2,500]
    
    DETAIL --> BALANCES[Account balances end-of-day]
    BALANCES --> PENFED[PenFed Checking: $X]
    BALANCES --> TRUIST[Truist Checking: $Y]
    
    DETAIL --> STS[Safe-to-spend on this day]
    DETAIL --> RISK[Risk level: GREEN/YELLOW/ORANGE/RED]
    
    RISK --> ACTION{Suggested action?}
    ACTION -->|Overdraft risk| TRANSFER[Suggest transfer from emergency]
    ACTION -->|Low STS| WARN[Delay discretionary spending]
    ACTION -->|GREEN| OK[No action needed]
```

See wireframe: [`wireframes/calendar-day-detail.md`](./wireframes/calendar-day-detail.md).

---

## 9. Alert Lifecycle

```mermaid
flowchart TD
    ENGINE[Engine runs on dashboard load] --> CHECK{Conditions met?}
    
    CHECK --> C1[Upcoming bill within 7 days]
    CHECK --> C2[PenFed < Amex payment amount]
    CHECK --> C3[Utilization > 30%]
    CHECK --> C4[Unreviewed upload > 24h]
    CHECK --> C5[Tax reserve shortfall]
    
    C1 --> CREATE[Create Alert record]
    C2 --> CREATE
    C3 --> CREATE
    C4 --> CREATE
    C5 --> CREATE
    
    CREATE --> NOTIFY[Show in dashboard alert banner]
    NOTIFY --> READ{User reads?}
    READ -->|Yes| MARK[isRead = true]
    READ -->|Dismiss| DISMISS[Archive]
    
    C2 --> REC[Create Recommendation<br/>actionUrl: /credit]
```

---

## 10. Account Balance Update

```mermaid
flowchart TD
    START[User updates account balance] --> METHOD{Update method}
    
    METHOD --> MANUAL[Manual entry on /accounts]
    METHOD --> OCR[OCR upload confirms balance]
    METHOD --> IMPORT[CSV import — future]
    
    MANUAL --> SAVE[Update FinancialAccount.currentBalance]
    OCR --> SAVE
    IMPORT --> SAVE
    
    SAVE --> SNAP[Create AccountBalanceSnapshot]
    SNAP --> ENGINE[Engine recalculates]
    ENGINE --> DASH[Dashboard refreshes]
    ENGINE --> ALERTS[Alerts re-evaluated]
```

---

## Related Documents

- [PRD](./PRD.md) — Feature requirements
- [Pages & Components](./pages-and-components.md) — Route inventory
- [Wireframes](./wireframes/) — ASCII UI mockups
- [OCR Ingestion](./ocr-ingestion.md) — Upload pipeline details
