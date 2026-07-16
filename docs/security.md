# Finance King — Security Model

Threat model, authentication, authorization, data protection, and compliance posture for Finance King.

---

## 1. Security Principles

1. **Tenant isolation** — Every financial query is scoped by `userId`. No cross-user data access.
2. **Defense in depth** — Auth middleware + server-side session checks + Prisma query scoping.
3. **Privacy by default** — Local OCR mode; encrypted document storage; optional auto-delete.
4. **Least privilege** — Role-based access (USER, ADMIN, ADVISOR) with minimal default permissions.
5. **No secrets in client** — All sensitive keys server-side only; `NEXT_PUBLIC_*` vars are non-sensitive.

---

## 2. Threat Model

### 2.1 Assets

| Asset | Sensitivity | Storage |
|-------|-------------|---------|
| User credentials | Critical | `User.passwordHash` (bcrypt) |
| Financial account data | Critical | PostgreSQL (Neon) |
| Bank statements / documents | Critical | S3/MinIO (encrypted) |
| Transaction history | High | PostgreSQL |
| Session tokens | High | JWT (HTTP-only cookie) |
| OCR extracted text | High | `ExtractionResult.rawText` |
| Audit logs | Medium | PostgreSQL |

### 2.2 Threat Actors

| Actor | Motivation | Mitigation |
|-------|------------|------------|
| External attacker | Data theft, account takeover | Auth, encryption, rate limiting |
| Malicious user | Access other users' data | Tenant isolation, query scoping |
| Insider (ADVISOR role) | Read household financials | Read-only role, audit logging |
| Supply chain | Compromised dependency | Lock file, `npm audit`, minimal deps |

### 2.3 STRIDE Analysis

| Threat | Category | Control |
|--------|----------|---------|
| Session hijacking | Spoofing | HTTP-only secure cookies, AUTH_SECRET rotation |
| Brute force login | Spoofing | bcrypt (cost 12), rate limiting (planned) |
| IDOR on accounts | Tampering | `userId` check on every query |
| SQL injection | Tampering | Prisma parameterized queries |
| XSS in transaction descriptions | Tampering | React auto-escaping, CSP headers (planned) |
| Financial data exfiltration | Information disclosure | Auth required, no public API |
| Denial of service (upload flood) | DoS | File size limits, OCR quota per plan tier |
| Audit log tampering | Repudiation | Append-only AuditLog, no user delete |
| Privilege escalation | Elevation | Role check middleware (planned) |

---

## 3. Authentication

### 3.1 Implementation

| Component | Technology |
|-----------|------------|
| Framework | NextAuth v5 (beta) |
| Strategy | JWT sessions (not database sessions for API speed) |
| Provider | Credentials (email + password) |
| Password hashing | bcryptjs, cost factor 12 |
| Adapter | PrismaAdapter (for user/account tables) |

### 3.2 Auth Flow

```
POST /api/auth/callback/credentials
  → Validate email format (Zod)
  → Require password ≥ 8 characters
  → Lookup User by email
  → bcrypt.compare(password, passwordHash)
  → Issue JWT with user.id
  → Set HTTP-only session cookie
```

### 3.3 Session Configuration

| Setting | Value |
|---------|-------|
| `AUTH_SECRET` | 32+ byte random (openssl rand -base64 32) |
| `AUTH_URL` | Production app URL (e.g., https://financeking.app) |
| Session strategy | JWT |
| Token contents | `id`, `email`, `name` |

### 3.4 Middleware Protection

```typescript
// src/middleware.ts
const publicPaths = ["/", "/login", "/register", "/privacy", "/terms", "/api/auth"];

// Unauthenticated → redirect to /login?callbackUrl=...
// Authenticated on /login → redirect to /dashboard
```

---

## 4. Authorization

### 4.1 Role Model

| Role | Permissions |
|------|-------------|
| `USER` | Full CRUD on own financial data |
| `ADVISOR` | Read-only on assigned household (planned) |
| `ADMIN` | Platform administration (planned) |

### 4.2 Tenant Isolation Pattern

Every server-side data access follows this pattern:

```typescript
// src/lib/services/snapshot.ts
const accounts = await prisma.financialAccount.findMany({
  where: { userId },  // Always scoped
});
```

**Rule:** Never query financial tables without `where: { userId }`.

### 4.3 Resource-Level Checks

For single-resource operations (update account, confirm upload):

```typescript
const account = await prisma.financialAccount.findFirst({
  where: { id: accountId, userId },
});
if (!account) throw new Error("Not found");
```

---

## 5. Data Protection

### 5.1 Encryption at Rest

| Data | Encryption |
|------|------------|
| PostgreSQL (Neon) | AES-256 (Neon managed) |
| S3/MinIO documents | Server-side encryption (SSE-S3) |
| Per-document IV | `UploadedDocument.encryptionIv` for field-level encryption |
| Passwords | bcrypt hash (one-way) |

### 5.2 Encryption in Transit

| Path | Protocol |
|------|----------|
| Client → Vercel | TLS 1.3 (HTTPS) |
| Vercel → Neon | TLS (sslmode=require) |
| Vercel → S3 | TLS |
| Vercel → Redis | TLS (Upstash) |

### 5.3 Sensitive Field Encryption

The `ENCRYPTION_KEY` environment variable (32 bytes, base64) encrypts:

- Document storage keys
- OCR raw text (optional, when `localOcrOnly` is false)

### 5.4 Document Storage Security

| Control | Implementation |
|---------|----------------|
| Private bucket | No public ACL on `finance-king-uploads` |
| Presigned URLs | Time-limited PUT/GET (15 min expiry) |
| Per-user paths | `uploads/{userId}/{documentId}/{filename}` |
| Duplicate prevention | `@@unique([userId, fileHash])` |
| Auto-delete | `UserPreference.autoDeleteUploadDays` (optional) |

---

## 6. HTTP Security Headers

Configured in `next.config.ts`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unnecessary APIs |

**Planned additions:**
- `Content-Security-Policy` (strict-src for scripts)
- `Strict-Transport-Security` (HSTS, 1 year)

---

## 7. Input Validation

| Input | Validation |
|-------|------------|
| Email | Zod `z.string().email()` |
| Password | Min 8 characters |
| Money amounts | `decimal.js` parsing, no floats |
| File uploads | MIME type whitelist (PDF, PNG, JPG), max 10MB |
| File hash | SHA-256 before upload |

---

## 8. OCR Privacy

| Setting | Default | Behavior |
|---------|---------|----------|
| `UserPreference.localOcrOnly` | `true` | Tesseract.js runs in worker process; no cloud OCR |
| `OCR_MODE` env | `local` | No external OCR API calls |

When `localOcrOnly` is true:
- Statement images never leave the infrastructure
- Raw OCR text stored only in user's database row
- No third-party ML service processes financial documents

---

## 9. Audit Logging

The `AuditLog` model records security-relevant actions:

| Field | Purpose |
|-------|---------|
| `action` | e.g., `LOGIN`, `UPLOAD_CONFIRM`, `BALANCE_UPDATE` |
| `entityType` | e.g., `FinancialAccount`, `UploadedDocument` |
| `entityId` | Affected record ID |
| `metadata` | JSON context (no PII in metadata) |
| `ipAddress` | Request origin (optional) |

**Retention:** Indefinite (no user-facing delete). Admin purge only.

---

## 10. Consent Management

`UserConsent` tracks explicit user consent:

| Consent Type | Purpose |
|--------------|---------|
| `TERMS_OF_SERVICE` | Platform terms acceptance |
| `PRIVACY_POLICY` | Privacy policy acceptance |
| `OCR_PROCESSING` | Permission to process uploaded documents |
| `EMAIL_NOTIFICATIONS` | Marketing/alert emails |
| `DATA_RETENTION` | Agreement to data retention policy |

Each consent has `granted`, `grantedAt`, and optional `revokedAt`.

---

## 11. Subscription & Quota Enforcement

| Plan | OCR Quota | Storage Quota |
|------|-----------|---------------|
| FREE | 5 pages/month | 100 MB |
| KING | 50 pages/month | 500 MB |
| EMPIRE | 200 pages/month | 2000 MB |

Enforced at:
- Presign endpoint (check quota before generating URL)
- Worker (count pages processed against monthly quota)

---

## 12. Environment Variable Security

| Variable | Exposure | Rotation |
|----------|----------|----------|
| `AUTH_SECRET` | Server only | Quarterly |
| `DATABASE_URL` | Server only | On credential change |
| `ENCRYPTION_KEY` | Server only | Annually (requires re-encryption) |
| `STORAGE_SECRET_KEY` | Server only | On compromise |
| `NEXT_PUBLIC_*` | Client (safe) | N/A |

**Never commit:** `.env`, `.env.local`, `.env.deploy`  
**Template only:** `.env.example` (placeholder values)

---

## 13. Incident Response

| Severity | Example | Response |
|----------|---------|----------|
| P1 — Critical | Database breach | Rotate all secrets, notify users within 72h |
| P2 — High | Auth bypass discovered | Hotfix deploy, force session invalidation |
| P3 — Medium | XSS in user input | Patch, review audit logs |
| P4 — Low | Dependency CVE | Update package, verify no exploit |

---

## 14. Compliance Posture

Finance King is **not** a registered investment advisor, credit counselor, or bank. Security documentation emphasizes:

- Educational credit score estimates only
- No PCI DSS scope (no card data stored — Stripe handles payments)
- GDPR-ready architecture (user data export/delete planned)
- CCPA: user can request data deletion via `User.deletedAt` soft delete

---

## 15. Security Checklist (Pre-Production)

- [ ] `AUTH_SECRET` is unique 32+ byte random value
- [ ] `ENCRYPTION_KEY` is unique 32-byte random value
- [ ] `DATABASE_URL` uses Neon pooled connection with SSL
- [ ] S3 bucket has no public access
- [ ] All API routes verify `userId` from session
- [ ] File upload size limited to 10MB
- [ ] Rate limiting on `/api/auth` endpoints
- [ ] CSP headers configured
- [ ] HSTS enabled
- [ ] Dependency audit clean (`npm audit`)
- [ ] No secrets in git history

---

## 16. Related Documents

- [Architecture](./architecture.md) — System layers and boundaries
- [OCR Ingestion](./ocr-ingestion.md) — Document processing privacy
- [Deployment](./deployment.md) — Environment variable setup
