# Finance King — System Architecture

**Version:** 0.1.0  
**Stack:** Next.js 15 · Prisma 6 · PostgreSQL · Redis · MinIO/S3 · BullMQ · Tesseract.js

---

## 1. Architecture Overview

Finance King is a **monolithic Next.js application** with a pure TypeScript financial engine, background OCR workers, and object storage for document uploads. There is no separate API server — all server logic runs as Next.js Route Handlers, Server Actions, and standalone worker processes.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser / PWA)                        │
│  Next.js App Router · React 19 · Tailwind 4 · Recharts · Radix UI      │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼───────────────────────────────────────┐
│                         NEXT.JS APPLICATION                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Middleware   │  │ Route        │  │ Server       │  │ API Routes │ │
│  │ (Auth guard) │  │ Handlers     │  │ Actions      │  │ /api/*     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                 │                 │        │
│  ┌──────▼─────────────────▼─────────────────▼─────────────────▼──────┐ │
│  │                        SERVICE LAYER                               │ │
│  │  snapshot.ts · upload service · alert service · auth               │ │
│  └──────┬──────────────────────────────────────────────────┬─────────┘ │
│         │                                                  │           │
│  ┌──────▼──────────────────────┐    ┌─────────────────────▼────────┐ │
│  │     FINANCIAL ENGINE         │    │     INGESTION PIPELINE         │ │
│  │  safe-to-spend · overdraft   │    │  upload → queue → OCR → review │ │
│  │  credit · scenarios          │    │                                │ │
│  │  purchase-impact             │    │                                │ │
│  └──────────────────────────────┘    └────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼───────┐       ┌─────────▼─────────┐     ┌────────▼────────┐
│  PostgreSQL   │       │      Redis         │     │  MinIO / S3     │
│  (Neon prod)  │       │  (BullMQ queues)   │     │  (documents)    │
└───────────────┘       └───────────────────┘     └─────────────────┘
        ▲
        │  npm run worker (separate process)
        └──────────────────────────────────────
```

---

## 2. Layer Diagram

### 2.1 Presentation Layer

| Path | Responsibility |
|------|----------------|
| `src/app/` | App Router pages and layouts |
| `src/components/ui/` | Radix-based design system (Button, Card, Badge, etc.) |
| `src/components/theme-provider.tsx` | Dark/light theme via `next-themes` |
| `src/app/globals.css` | Finance King design tokens (navy, gold, risk colors) |

**Design tokens:**

| Token | Value | Usage |
|-------|-------|-------|
| `--fk-navy` | `#0a1628` | Primary brand, headers |
| `--fk-gold` | `#c9a227` | KPI highlights, CTAs |
| `--fk-background` | `#060d18` | Page background |
| `--fk-card` | `#12182a` | Card surfaces |
| `--fk-safe-green` | `#2ecc71` | GREEN risk |
| `--fk-risk-red` | `#e74c3c` | RED risk |

Fonts: **DM Sans** (UI), **DM Mono** (amounts, tabular-nums).

### 2.2 Application Layer

| Path | Responsibility |
|------|----------------|
| `src/middleware.ts` | Auth gate; public paths; redirect to `/dashboard` |
| `src/lib/auth/` | NextAuth v5 credentials provider, JWT sessions |
| `src/lib/services/snapshot.ts` | Prisma → `EngineSnapshot` adapter |
| `src/lib/db.ts` | Prisma client singleton |

### 2.3 Domain / Engine Layer

Pure functions with no I/O. All money math uses `decimal.js` via `src/lib/utils/money.ts`.

| Module | File | Exports |
|--------|------|---------|
| Types | `types.ts` | `EngineSnapshot`, `SafeToSpendResult`, etc. |
| Dates | `dates.ts` | Horizon boundaries, day iteration |
| Liquid Cash | `liquid-cash.ts` | `computeLiquidCash`, `computeProtectedReserves`, utilization |
| Safe to Spend | `safe-to-spend.ts` | `computeSafeToSpend`, `computeAllHorizons` |
| Overdraft | `overdraft.ts` | `projectDailyBalances`, `computeOverdraftRisk` |
| Scenarios | `scenarios.ts` | `runScenarioForecast`, `runAllScenarios` |
| Credit | `credit.ts` | Utilization targets, avalanche/snowball plans |
| Purchase Impact | `purchase-impact.ts` | `simulatePurchaseImpact`, health score |
| Dashboard | `index.ts` | `buildDashboardSnapshot` — aggregates all engine outputs |

**Key design decision:** The engine operates on an `EngineSnapshot` plain object, not live Prisma queries. This enables:

- Deterministic unit tests (Vitest)
- Scenario simulation without DB writes
- Purchase impact simulation by cloning snapshot

### 2.4 Data Layer

| Component | Technology |
|-----------|------------|
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Migrations | `prisma migrate` |
| Seed | `prisma/seed.ts` |

See [`database-schema.md`](./database-schema.md) for entity relationships.

### 2.5 Infrastructure Layer

| Component | Local (Docker) | Production |
|-----------|----------------|------------|
| App | `docker-compose` app service | Vercel (standalone Next.js) |
| Worker | `docker-compose` worker service | Vercel Cron or separate container |
| Database | PostgreSQL 16 container | Neon serverless Postgres |
| Queue | Redis 7 container | Upstash Redis or Render Redis |
| Storage | MinIO container | AWS S3 or Cloudflare R2 |

---

## 3. Module Dependency Graph

```
middleware.ts
    └── auth/index.ts
            └── db.ts (Prisma)

pages (dashboard, etc.)
    └── services/snapshot.ts
            └── engine/index.ts
                    ├── safe-to-spend.ts
                    │       └── liquid-cash.ts
                    ├── overdraft.ts
                    │       └── safe-to-spend.ts
                    ├── scenarios.ts
                    │       ├── liquid-cash.ts
                    │       └── safe-to-spend.ts
                    ├── credit.ts
                    └── purchase-impact.ts
                            ├── safe-to-spend.ts
                            └── scenarios.ts

upload flow
    └── API route → S3 presign → BullMQ job
            └── worker/process-upload.ts
                    └── tesseract.js → ExtractionResult
```

---

## 4. Request Flows

### 4.1 Dashboard Load

```
Browser GET /dashboard
  → middleware.ts (auth check)
  → Dashboard page (Server Component)
  → requireUser() → getEngineSnapshot(userId)
  → buildDashboardSnapshot(snapshot)
  → Render KPI cards, risk strip, scenario cards
```

### 4.2 Document Upload

```
Browser POST /api/uploads/presign
  → Validate auth + quota
  → Generate S3 presigned PUT URL
  → Create UploadedDocument (status: PENDING)

Browser PUT → S3/MinIO

Browser POST /api/uploads/{id}/process
  → Enqueue BullMQ job on Redis
  → Update status: PROCESSING

Worker: process-upload.ts
  → Download from S3
  → Tesseract OCR (local mode)
  → Parse transactions
  → Save ExtractionResult
  → Update status: REVIEW_REQUIRED
```

### 4.3 Purchase Simulation

```
Browser POST /api/simulate-purchase
  → getEngineSnapshot(userId)
  → simulatePurchaseImpact(snapshot, purchase)
  → Return recommendation + warnings (no DB write)
```

---

## 5. Deployment Topology

### 5.1 Local Development

```bash
docker compose up -d          # postgres, redis, minio
cp .env.example .env
npm run db:push && npm run db:seed
npm run dev                   # :3000
npm run worker                # OCR worker (separate terminal)
```

### 5.2 Production (Vercel + Neon)

```
                    ┌──────────────┐
    Users ─────────►│   Vercel     │
                    │  Next.js app │
                    │  (standalone)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
       │ Neon       │ │ Upstash │ │ S3 / R2   │
       │ PostgreSQL │ │ Redis   │ │ Storage   │
       └────────────┘ └─────────┘ └───────────┘
```

See [`deployment.md`](./deployment.md) for environment variables and setup steps.

### 5.3 Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgres:16-alpine | 5432 | Primary database |
| `redis` | redis:7-alpine | 6379 | BullMQ job queue |
| `minio` | minio/minio | 9000, 9001 | S3-compatible document storage |
| `minio-init` | minio/mc | — | Creates `finance-king-uploads` bucket |
| `app` | Built from Dockerfile | 3000 | Next.js application |
| `worker` | Built from Dockerfile | — | `npm run worker` OCR processor |

---

## 6. Security Boundaries

| Boundary | Mechanism |
|----------|-----------|
| Authentication | NextAuth JWT; bcrypt password hashes |
| Authorization | All Prisma queries scoped by `userId` |
| Document storage | Per-user encryption IV; S3 private bucket |
| HTTP headers | X-Frame-Options DENY, nosniff, strict referrer |
| Tenant isolation | No cross-user queries; `userId` on every financial table |

See [`security.md`](./security.md).

---

## 7. Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15 App Router | SSR for dashboard, API routes, Vercel deploy |
| Auth | NextAuth v5 credentials | Simple email/password; no OAuth dependency for MVP |
| Money | decimal.js | Avoid floating-point errors in financial math |
| OCR | Tesseract.js | Local-first privacy; no cloud OCR cost |
| Queue | BullMQ + Redis | Reliable background processing with retries |
| Charts | Recharts | React-native charting for cash flow projections |
| Testing | Vitest + Playwright | Unit tests for engine; E2E for critical flows |

---

## 8. Scalability Considerations

| Concern | Current | Future |
|---------|---------|--------|
| Engine compute | In-process, <50ms | Edge caching of snapshot; Redis cache |
| OCR throughput | Single worker | Horizontal worker scaling |
| Database | Neon free tier | Connection pooling via `-pooler` URL |
| File storage | MinIO local / S3 | Lifecycle policies for auto-delete |
| Multi-tenant | Single-user seed | Row-level `userId` already in schema |

---

## 9. File Structure

```
finance-king/
├── prisma/
│   ├── schema.prisma          # Full data model
│   └── seed.ts                # Timothy's financial profile
├── src/
│   ├── app/                   # Next.js pages & API routes
│   ├── components/
│   │   └── ui/                # Design system primitives
│   ├── lib/
│   │   ├── auth/              # NextAuth config
│   │   ├── engine/            # Pure financial engine
│   │   ├── services/          # DB → engine adapters
│   │   └── utils/             # money, cn helpers
│   ├── workers/               # Background job processors
│   └── middleware.ts          # Auth middleware
├── docker-compose.yml
├── Dockerfile                 # Multi-stage standalone build
└── docs/                      # This documentation
```

---

## 10. Related Documents

- [PRD](./PRD.md) — Product requirements
- [Database Schema](./database-schema.md) — ERD and table reference
- [Deployment](./deployment.md) — Docker, Vercel, Neon setup
- [OCR Ingestion](./ocr-ingestion.md) — Upload pipeline design
- [Security](./security.md) — Threat model and controls
