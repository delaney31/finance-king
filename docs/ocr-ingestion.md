# Finance King — OCR Ingestion Pipeline

Design document for bank statement and document upload, OCR extraction, human review, and transaction confirmation.

---

## 1. Overview

Finance King ingests financial documents (bank statements, credit card statements) via a privacy-first pipeline:

1. User uploads document (PDF/image)
2. File stored in S3-compatible object storage (encrypted)
3. Background worker runs Tesseract.js OCR locally
4. Extracted fields presented for human review
5. User confirms → transactions and balance snapshots created

**Default mode:** `localOcrOnly: true` — no cloud OCR APIs, no third-party ML services.

---

## 2. Pipeline Architecture

```
┌──────────┐    presign     ┌─────────┐    PUT      ┌──────────┐
│  Client  │───────────────►│ API     │────────────►│ S3/MinIO │
│ (Browser)│               │ Route   │             │ (private)│
└────┬─────┘               └────┬────┘             └────┬─────┘
     │                          │                       │
     │  POST /process           │                       │
     │─────────────────────────►│                       │
     │                          │ enqueue               │
     │                          ▼                       │
     │                    ┌──────────┐                  │
     │                    │  Redis   │                  │
     │                    │ (BullMQ) │                  │
     │                    └────┬─────┘                  │
     │                          │                       │
     │                    ┌─────▼─────┐    download     │
     │                    │  Worker   │◄────────────────┘
     │                    │ process-  │
     │                    │ upload.ts │
     │                    └─────┬─────┘
     │                          │
     │                    ┌─────▼─────┐
     │                    │ Tesseract │
     │                    │ .js OCR   │
     │                    └─────┬─────┘
     │                          │
     │                    ┌─────▼──────────┐
     │                    │ Field Parser   │
     │                    │ + Confidence   │
     │                    └─────┬──────────┘
     │                          │
     │                    ┌─────▼──────────┐
     │                    │ ExtractionResult│
     │                    │ (PostgreSQL)   │
     │                    └────────────────┘
     │
     │  GET /upload/review/:id
     │◄─────────────────────────
     │
     │  POST /confirm
     │─────────────────────────► Transactions created
```

---

## 3. Document Lifecycle

### 3.1 Status State Machine

```
                    ┌──────────┐
         upload ──► │ PENDING  │
                    └────┬─────┘
                         │ enqueue
                    ┌────▼─────┐
                    │PROCESSING│
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼────┐ ┌───▼────┐ ┌──▼──────┐
         │ FAILED  │ │REVIEW_ │ │DUPLICATE│
         └─────────┘ │REQUIRED│ └─────────┘
                     └───┬────┘
                         │
              ┌──────────┼──────────┐
              │                     │
         ┌────▼────┐          ┌────▼────┐
         │REJECTED │          │CONFIRMED│
         └─────────┘          └─────────┘
```

| Status | Meaning | User Action |
|--------|---------|-------------|
| `PENDING` | Uploaded, awaiting processing | Wait |
| `PROCESSING` | Worker running OCR | Wait |
| `REVIEW_REQUIRED` | Extraction complete, needs review | Review & confirm |
| `CONFIRMED` | User approved, transactions created | View transactions |
| `REJECTED` | User rejected extraction | Re-upload or manual entry |
| `DUPLICATE` | Same file hash already uploaded | View original |
| `FAILED` | OCR or parsing error | Retry or re-upload |

### 3.2 Database Records

**UploadedDocument:**

| Field | Purpose |
|-------|---------|
| `fileName` | Original filename |
| `mimeType` | application/pdf, image/png, image/jpeg |
| `fileSize` | Bytes (max 10MB) |
| `fileHash` | SHA-256 for deduplication |
| `storageKey` | S3 object key |
| `encryptionIv` | Per-document encryption IV |
| `institution` | Detected or user-specified bank |
| `documentType` | statement, receipt, invoice |
| `retentionDays` | Auto-delete after N days (optional) |

**ExtractionResult:**

| Field | Purpose |
|-------|---------|
| `rawText` | Full OCR text output |
| `extractedData` | Structured JSON (see §4) |
| `fieldConfidence` | Per-field confidence scores (0.0–1.0) |
| `institution` | Detected institution name |
| `reviewedAt` | Timestamp of user review |
| `reviewedBy` | User ID who reviewed |

---

## 4. Extraction Schema

### 4.1 extractedData JSON Structure

```json
{
  "documentType": "bank_statement",
  "institution": "PenFed",
  "accountLastFour": "1234",
  "statementPeriod": {
    "start": "2026-06-01",
    "end": "2026-06-30"
  },
  "openingBalance": 22800.50,
  "closingBalance": 24032.25,
  "transactions": [
    {
      "date": "2026-06-05",
      "description": "DIRECT DEPOSIT EMPLOYER",
      "amount": 5000.00,
      "type": "INCOME",
      "confidence": 0.92
    },
    {
      "date": "2026-06-15",
      "description": "AMEX EPAYMENT",
      "amount": -15000.00,
      "type": "DEBT_PAYMENT",
      "confidence": 0.88
    }
  ],
  "summary": {
    "totalDeposits": 25000.00,
    "totalWithdrawals": 23768.25,
    "transactionCount": 15
  }
}
```

### 4.2 fieldConfidence JSON Structure

```json
{
  "institution": 0.95,
  "accountLastFour": 0.90,
  "openingBalance": 0.85,
  "closingBalance": 0.92,
  "statementPeriod.start": 0.88,
  "statementPeriod.end": 0.88,
  "transactions[0].date": 0.92,
  "transactions[0].amount": 0.94,
  "transactions[0].description": 0.78
}
```

### 4.3 Confidence Thresholds

| Range | Display | Behavior |
|-------|---------|----------|
| ≥ 0.90 | Green "High" | Auto-filled, user can override |
| 0.70–0.89 | Yellow "Medium" | Highlighted for review |
| < 0.70 | Red "Low" | Empty field, user must enter |

---

## 5. OCR Processing

### 5.1 Technology

| Component | Choice | Rationale |
|-----------|--------|-----------|
| OCR Engine | Tesseract.js 6.x | Runs in Node.js worker; no external API |
| Queue | BullMQ 5.x | Reliable job processing with retries |
| Image preprocessing | Sharp (planned) | Deskew, contrast, grayscale for better OCR |
| PDF parsing | pdf-parse (planned) | Extract pages from PDF before OCR |

### 5.2 Worker Process

```bash
# package.json
"worker": "tsx src/workers/process-upload.ts"
```

**Job payload:**

```typescript
interface ProcessUploadJob {
  documentId: string;
  userId: string;
  storageKey: string;
  mimeType: string;
}
```

**Worker steps:**

1. Download file from S3/MinIO
2. If PDF → extract pages as images
3. Preprocess image (grayscale, contrast, deskew)
4. Run Tesseract OCR with financial vocabulary
5. Parse OCR text into structured fields
6. Match institution from known patterns (PenFed, Truist, Wells Fargo, Mercury, Amex)
7. Extract transactions via regex patterns
8. Compute per-field confidence scores
9. Save `ExtractionResult` with status `COMPLETE`
10. Update `UploadedDocument.status` → `REVIEW_REQUIRED`

### 5.3 Institution Detection Patterns

| Institution | Header Pattern | Account Pattern |
|-------------|---------------|-----------------|
| PenFed | `PENTAGON FEDERAL` | `Account.*\d{4}` |
| Truist | `TRUIST BANK` | `Account Number.*\d{4}` |
| Wells Fargo | `WELLS FARGO` | `Account number.*\d{4}` |
| Mercury | `MERCURY` | `••••\d{4}` |
| Amex | `AMERICAN EXPRESS` | `Account Ending.*\d{5}` |

### 5.4 Transaction Parsing Rules

| Pattern | Type | Example |
|---------|------|---------|
| `DIRECT DEP`, `PAYROLL`, `ACH CREDIT` | INCOME | W-2 deposit |
| `AMEX`, `EPAYMENT`, `PAYMENT TO` | DEBT_PAYMENT | Credit card payment |
| `TRANSFER TO`, `TRANSFER FROM` | TRANSFER | Inter-account transfer |
| `WITHDRAWAL`, `DEBIT`, `PURCHASE` | EXPENSE | General spending |
| Positive amount in credit card stmt | EXPENSE | Card charge |
| Negative amount in credit card stmt | DEBT_PAYMENT | Payment received |

---

## 6. Review & Confirmation Flow

### 6.1 Review Screen

User sees side-by-side:
- **Left:** Original document image (rendered from S3)
- **Right:** Extracted fields with confidence badges

Editable fields:
- Institution, account last four
- Statement period dates
- Opening/closing balance
- Transaction table (date, description, amount, type)

### 6.2 Confirmation Actions

**On confirm:**

1. Update `UploadedDocument.status` → `CONFIRMED`
2. Set `ExtractionResult.reviewedAt` and `reviewedBy`
3. For each confirmed transaction:
   - Create `Transaction` record with `documentId` link
   - Set `confidence` from extraction
   - Auto-categorize via `CategorizationRule` matching
4. Create `AccountBalanceSnapshot` with closing balance, source `OCR`
5. Update `FinancialAccount.currentBalance` to closing balance
6. Create `AuditLog` entry: `UPLOAD_CONFIRM`
7. Engine recalculates safe-to-spend

**On reject:**

1. Update status → `REJECTED`
2. Audit log: `UPLOAD_REJECT`
3. Optionally delete file from S3 (if `autoDeleteUploadDays` set)

---

## 7. Duplicate Detection

Before upload:

```typescript
const existing = await prisma.uploadedDocument.findUnique({
  where: { userId_fileHash: { userId, fileHash } },
});
if (existing) return { status: "DUPLICATE", existingId: existing.id };
```

File hash computed client-side (SHA-256 of file bytes) and verified server-side.

---

## 8. Quota & Rate Limiting

| Plan | Monthly OCR Pages | Storage |
|------|-------------------|---------|
| FREE | 5 | 100 MB |
| KING | 50 | 500 MB |
| EMPIRE | 200 | 2000 MB |

Enforced at presign time:

```typescript
const subscription = await prisma.subscription.findUnique({ where: { userId } });
if (pagesUsedThisMonth >= subscription.ocrQuotaMonthly) {
  throw new Error("OCR quota exceeded");
}
```

---

## 9. Error Handling & Retries

| Error | Handling |
|-------|----------|
| S3 download failure | Retry 3× with exponential backoff |
| OCR timeout (>60s) | Mark FAILED, allow manual retry |
| Unparseable document | Status FAILED, suggest manual entry |
| Low confidence (<0.5 avg) | Status REVIEW_REQUIRED with warning banner |
| Worker crash | BullMQ automatic retry (3 attempts) |

---

## 10. Privacy Controls

| Control | Setting | Default |
|---------|---------|---------|
| Local OCR only | `UserPreference.localOcrOnly` | `true` |
| Auto-delete uploads | `UserPreference.autoDeleteUploadDays` | `null` (keep) |
| OCR consent | `UserConsent.OCR_PROCESSING` | Required before first upload |

When `autoDeleteUploadDays` is set (e.g., 30):
- Cron job deletes S3 objects and `UploadedDocument` records after retention period
- `ExtractionResult` and linked `Transaction` records are preserved

---

## 11. Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `OCR_MODE` | Processing mode | `local` |
| `REDIS_URL` | BullMQ connection | `redis://localhost:6379` |
| `STORAGE_ENDPOINT` | S3/MinIO endpoint | `http://localhost:9000` |
| `STORAGE_BUCKET` | Upload bucket | `finance-king-uploads` |
| `STORAGE_ACCESS_KEY` | S3 access key | `minioadmin` |
| `STORAGE_SECRET_KEY` | S3 secret key | `minioadmin` |
| `ENCRYPTION_KEY` | Document encryption | 32-byte base64 |

---

## 12. Monitoring

| Metric | Alert Threshold |
|--------|-----------------|
| OCR processing time | > 30s average |
| OCR failure rate | > 10% |
| Queue depth | > 50 pending jobs |
| Review backlog | > 5 unreviewed per user |
| Storage usage | > 80% of quota |

---

## 13. Future Enhancements

- **CSV/OFX import** — Skip OCR for machine-readable formats
- **Multi-page PDF** — Process all pages, merge transactions
- **Auto-match account** — Link to FinancialAccount by last four + institution
- **Recurring detection** — Auto-create RecurringTransaction from patterns
- **Cloud OCR fallback** — Optional AWS Textract for EMPIRE tier (opt-in only)

---

## 14. Related Documents

- [Security](./security.md) — Document encryption and privacy
- [User Flows](./user-flows.md) — Upload journey diagram
- [Wireframe: Upload Review](./wireframes/upload-review.md) — Review screen layout
- [Database Schema](./database-schema.md) — UploadedDocument, ExtractionResult tables
