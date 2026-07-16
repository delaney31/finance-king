# Wireframe: Upload Review

**Route:** `/upload/review/:id`  
**Status:** Document in `REVIEW_REQUIRED` state  
**Theme:** Navy background, gold accents, confidence color coding

---

## Layout Overview (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Uploads          Review Statement          PenFed • Jun 2026              │
├────────────────────────────────────┬─────────────────────────────────────────────────┤
│                                    │                                                 │
│  ORIGINAL DOCUMENT                 │  EXTRACTED DATA                                 │
│                                    │                                                 │
│  ┌────────────────────────────┐    │  Institution          [PenFed          ] 0.95 🟢│
│  │                            │    │  Account Last Four    [1234            ] 0.90 🟢│
│  │                            │    │  Statement Period                                │
│  │                            │    │    Start  [2026-06-01]  0.88 🟢                │
│  │   [Bank Statement Image]   │    │    End    [2026-06-30]  0.88 🟢                │
│  │                            │    │                                                 │
│  │   PENTAGON FEDERAL         │    │  Opening Balance      [$22,800.50    ] 0.85 🟡│
│  │   CREDIT UNION              │    │  Closing Balance      [$24,032.25    ] 0.92 🟢│
│  │                            │    │                                                 │
│  │   Account: ****1234        │    │  ── Transactions (15 found) ──────────────    │
│  │   Statement Period:         │    │                                                 │
│  │   Jun 1 - Jun 30, 2026     │    │  ┌─────────────────────────────────────────┐   │
│  │                            │    │  │ Date       Description         Amount   │   │
│  │   Beginning: $22,800.50    │    │  ├─────────────────────────────────────────┤   │
│  │   Ending:    $24,032.25    │    │  │ Jun 05  DIRECT DEPOSIT       +$5,000.00│   │
│  │                            │    │  │         EMPLOYER           INCOME  0.92🟢│   │
│  │   [transactions...]        │    │  │ Jun 10  MONTHLY TAX PMT      -$900.00 │   │
│  │                            │    │  │                              EXPENSE 0.85🟡│   │
│  │                            │    │  │ Jun 15  AMEX EPAYMENT      -$15,000.00│   │
│  │                            │    │  │                              DEBT   0.88🟢│   │
│  │                            │    │  │ Jun 20  TRUIST TRANSFER     -$6,510.00│   │
│  │                            │    │  │                              TRANSFER0.72🟡│   │
│  │                            │    │  │ Jun 25  CONTRACT DEPOSIT   +$12,090.00│   │
│  │                            │    │  │                              INCOME  0.91🟢│   │
│  │                            │    │  │ ...                                     │   │
│  │                            │    │  └─────────────────────────────────────────┘   │
│  │                            │    │                                                 │
│  │                            │    │  [+ Add Transaction]                              │
│  │                            │    │                                                 │
│  │  [◀ Page 1 of 3 ▶]        │    │  ── Summary ────────────────────────────────    │
│  │                            │    │  Total Deposits:     $17,090.00                  │
│  │  Zoom: [−] 100% [+]       │    │  Total Withdrawals:  $15,858.25                  │
│  │                            │    │  Net Change:          $1,231.75                  │
│  └────────────────────────────┘    │  Transaction Count:  15                          │
│                                    │                                                 │
│                                    │  Link to Account                                 │
│                                    │  [PenFed Personal Checking (****1234)        ▾]  │
│                                    │                                                 │
├────────────────────────────────────┴─────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─ Confidence Legend ──────────────────────────────────────────────────────────────┐ │
│  │  🟢 High (≥90%)    🟡 Medium (70-89%)    🔴 Low (<70%) — requires manual entry  │ │
│  └──────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│         [Reject Upload]                    [Confirm & Import 15 Transactions]        │
│                                              (gold CTA button)                       │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout Overview (Mobile)

```
┌─────────────────────────────────┐
│ ← Back     Review Statement     │
├─────────────────────────────────┤
│                                 │
│  [Document] [Extracted] [Both]  │
│       ●                         │
│                                 │
│  ┌─ Document Preview ──────────┐│
│  │                             ││
│  │  [Statement Image]          ││
│  │                             ││
│  │  Pinch to zoom              ││
│  │  [◀ 1/3 ▶]                  ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─ Key Fields ────────────────┐│
│  │ PenFed • ****1234     0.95🟢││
│  │ Jun 1 – Jun 30, 2026        ││
│  │                             ││
│  │ Opening    $22,800.50  0.85🟡│
│  │ Closing    $24,032.25  0.92🟢││
│  └─────────────────────────────┘│
│                                 │
│  ┌─ Transactions (15) ─────────┐│
│  │                             ││
│  │ Jun 05  DIRECT DEP  +$5,000 ││
│  │         INCOME         0.92🟢│
│  │ ─────────────────────────── ││
│  │ Jun 15  AMEX EPAY  -$15,000 ││
│  │         DEBT_PAY       0.88🟢││
│  │ ─────────────────────────── ││
│  │ Jun 20  TRUIST TR  -$6,510  ││
│  │         TRANSFER       0.72🟡││
│  │ ─────────────────────────── ││
│  │ [Show all 15...]            ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  Account: [PenFed Checking   ▾] │
│                                 │
│  [Reject]    [Confirm Import]   │
│              (gold, full width) │
│                                 │
└─────────────────────────────────┘
```

---

## Component Notes

### Split View (Desktop)
- 50/50 layout: document left, extracted data right
- Document viewer: zoom, pan, page navigation for multi-page PDFs
- Synchronized highlighting: clicking a transaction scrolls document to that line (planned)

### Confidence Indicators
- Per-field confidence score from OCR
- Color-coded badges:
  - 🟢 Green (≥0.90): High confidence, pre-filled
  - 🟡 Yellow (0.70–0.89): Medium, highlighted for review
  - 🔴 Red (<0.70): Low, field left empty for manual entry
- Confidence shown inline next to each field

### Transaction Table
- Editable rows: tap/click to modify date, description, amount, type
- Type selector: INCOME, EXPENSE, TRANSFER, DEBT_PAYMENT, SAVINGS
- Delete row button (✕) per transaction
- Add transaction button for missed items

### Account Linking
- Dropdown to match statement to existing FinancialAccount
- Auto-suggested by institution name + last four digits
- If no match: "Create new account" option

### Action Buttons
- **Reject:** Status → REJECTED; returns to upload list
- **Confirm & Import:** Status → CONFIRMED; creates transactions + balance snapshot
- Confirm button shows transaction count: "Confirm & Import 15 Transactions"
- Gold CTA styling for confirm

---

## Confirmation Flow

```
User clicks "Confirm & Import"
  → Validation: all required fields filled
  → Validation: closing balance is numeric
  → Validation: account selected
  → Create 15 Transaction records (linked to documentId)
  → Create AccountBalanceSnapshot (closing balance, source: OCR)
  → Update FinancialAccount.currentBalance
  → Auto-categorize via CategorizationRule matching
  → Update UploadedDocument.status → CONFIRMED
  → Create AuditLog: UPLOAD_CONFIRM
  → Redirect to /upload with success toast
  → Dashboard safe-to-spend recalculates
```

---

## Error States

```
┌─ OCR Failed ─────────────────────────────────────────┐
│                                                        │
│  ⚠ Could not extract data from this document          │
│                                                        │
│  The image may be too blurry or the format is not      │
│  supported. You can:                                   │
│                                                        │
│  [Retry OCR]  [Enter Manually]  [Upload Different]    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

```
┌─ Duplicate Detected ───────────────────────────────────┐
│                                                        │
│  ℹ This file was already uploaded on Jul 10, 2026      │
│                                                        │
│  [View Previous Upload]  [Upload Anyway]               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Institution-Specific Notes

| Institution | Expected Fields | Common OCR Challenges |
|-------------|----------------|----------------------|
| PenFed | Account last 4, statement period | Dense transaction list |
| Truist | Business account format | Multi-page statements |
| Wells Fargo | Joint account header | Small font size |
| Mercury | Modern layout, clean | Usually high confidence |
| Amex | Credit card format | Payments shown as credits |

---

## Related Documents

- [OCR Ingestion Pipeline](../ocr-ingestion.md)
- [User Flows: Upload](../user-flows.md#4-statement-upload--ocr-review)
- [Security: Document Storage](../security.md#53-document-storage-security)
