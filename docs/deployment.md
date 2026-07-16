# Finance King — Deployment Guide

Docker local development, environment variables, and production deployment on Vercel + Neon.

---

## 1. Deployment Options

| Environment | App | Database | Queue | Storage |
|-------------|-----|----------|-------|---------|
| **Local** | `npm run dev` | Docker PostgreSQL | Docker Redis | Docker MinIO |
| **Docker Compose** | Docker app + worker | Docker PostgreSQL | Docker Redis | Docker MinIO |
| **Production** | Vercel | Neon PostgreSQL | Upstash Redis | AWS S3 / Cloudflare R2 |

---

## 2. Local Development

### 2.1 Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm

### 2.2 Quick Start

```bash
# Clone and install
git clone <repo-url> finance-king
cd finance-king
npm install

# Start infrastructure
docker compose up -d postgres redis minio

# Configure environment
cp .env.example .env
# Edit .env — defaults work for Docker Compose

# Database setup
npm run db:push
npm run db:seed

# Start app
npm run dev          # http://localhost:3000

# Start OCR worker (separate terminal)
npm run worker
```

### 2.3 Login

```
Email:    tim@financeking.local
Password: demo12345
```

---

## 3. Docker Compose

### 3.1 Services

```bash
# Start all services
docker compose up -d

# Start infrastructure only (for local dev)
docker compose up -d postgres redis minio

# View logs
docker compose logs -f app

# Stop all
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v
```

### 3.2 Service Details

| Service | Image | Port | Health Check |
|---------|-------|------|--------------|
| `postgres` | postgres:16-alpine | 5432 | `pg_isready` |
| `redis` | redis:7-alpine | 6379 | `redis-cli ping` |
| `minio` | minio/minio | 9000, 9001 | `/minio/health/live` |
| `minio-init` | minio/mc | — | Creates bucket |
| `app` | Built from Dockerfile | 3000 | — |
| `worker` | Built from Dockerfile | — | `npm run worker` |

### 3.3 Dockerfile

Multi-stage build producing a Next.js standalone server:

```dockerfile
# Build stage: npm ci → prisma generate → next build
# Run stage: node server.js on port 3000
```

Key settings in `next.config.ts`:
- `output: "standalone"` — minimal production bundle
- Security headers on all routes

### 3.4 Docker Environment Overrides

The `app` and `worker` services override these in `docker-compose.yml`:

```yaml
DATABASE_URL: postgresql://financeking:financeking@postgres:5432/finance_king?schema=public
REDIS_URL: redis://redis:6379
STORAGE_ENDPOINT: http://minio:9000
AUTH_URL: http://localhost:3000
```

---

## 4. Environment Variables

### 4.1 Complete Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | — | NextAuth JWT secret (32+ bytes) |
| `AUTH_URL` | Yes | — | App URL for auth callbacks |
| `REDIS_URL` | Yes* | — | Redis for BullMQ (*required for OCR) |
| `STORAGE_ENDPOINT` | Yes* | — | S3/MinIO endpoint |
| `STORAGE_REGION` | No | `us-east-1` | S3 region |
| `STORAGE_ACCESS_KEY` | Yes* | — | S3 access key |
| `STORAGE_SECRET_KEY` | Yes* | — | S3 secret key |
| `STORAGE_BUCKET` | No | `finance-king-uploads` | Upload bucket name |
| `STORAGE_FORCE_PATH_STYLE` | No | `true` | Required for MinIO |
| `ENCRYPTION_KEY` | Yes | — | 32-byte base64 for document encryption |
| `OCR_MODE` | No | `local` | OCR processing mode |
| `NEXT_PUBLIC_APP_NAME` | No | `Finance King` | Display name |
| `NEXT_PUBLIC_APP_URL` | No | — | Public app URL |

*Required for OCR upload functionality.

### 4.2 Generate Secrets

```bash
# AUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY (must be exactly 32 bytes)
openssl rand -base64 32
```

### 4.3 Local `.env.example`

```env
DATABASE_URL="postgresql://financeking:financeking@localhost:5432/finance_king?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"
REDIS_URL="redis://localhost:6379"
STORAGE_ENDPOINT="http://localhost:9000"
STORAGE_REGION="us-east-1"
STORAGE_ACCESS_KEY="minioadmin"
STORAGE_SECRET_KEY="minioadmin"
STORAGE_BUCKET="finance-king-uploads"
STORAGE_FORCE_PATH_STYLE="true"
ENCRYPTION_KEY="generate-with-openssl-rand-base64-32"
OCR_MODE="local"
NEXT_PUBLIC_APP_NAME="Finance King"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 5. Production: Vercel + Neon

### 5.1 Architecture

```
Users → Vercel (Next.js standalone)
           ├── Neon PostgreSQL (pooled)
           ├── Upstash Redis (BullMQ)
           └── AWS S3 / Cloudflare R2 (documents)
```

### 5.2 Step 1: Create Neon Database

1. Open [console.neon.tech](https://console.neon.tech)
2. **New project** → name: `finance-king`
3. Copy the **pooled** connection string:
   ```
   postgresql://user:pass@ep-xxxx-pooler.us-east-2.aws.neon.tech/finance_king?sslmode=require
   ```
4. Use the `production` branch for production deploys

### 5.3 Step 2: Apply Schema

```bash
# From local machine with Neon URL
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Seed demo data (optional, staging only)
DATABASE_URL="postgresql://..." npm run db:seed
```

**Do not seed production** with demo credentials.

### 5.4 Step 3: Create Vercel Project

1. [vercel.com/new](https://vercel.com/new) → Import GitHub repo
2. **Framework:** Next.js
3. **Root Directory:** `.` (repo root)
4. **Build Command:** `npm run build` (includes `prisma generate`)
5. **Install Command:** `npm ci`

### 5.5 Step 4: Vercel Environment Variables

Set in Vercel → Settings → Environment Variables → Production:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon pooled URL (`-pooler` hostname) |
| `AUTH_SECRET` | `openssl rand -base64 32` output |
| `AUTH_URL` | `https://your-domain.vercel.app` |
| `REDIS_URL` | Upstash Redis URL |
| `STORAGE_ENDPOINT` | S3/R2 endpoint |
| `STORAGE_ACCESS_KEY` | S3 access key |
| `STORAGE_SECRET_KEY` | S3 secret key |
| `STORAGE_BUCKET` | `finance-king-uploads` |
| `STORAGE_REGION` | `us-east-1` |
| `ENCRYPTION_KEY` | 32-byte base64 |
| `OCR_MODE` | `local` |
| `NEXT_PUBLIC_APP_NAME` | `Finance King` |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` |

**Important:** Redeploy after setting environment variables.

### 5.6 Step 5: Deploy

```bash
# Via Git push (auto-deploy)
git push origin main

# Or manual
npx vercel --prod
```

### 5.7 Step 6: Run Migrations on Deploy

Add to `package.json` build script or use Vercel build command:

```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

Or run migrations manually after each schema change:

```bash
DATABASE_URL="neon-url" npx prisma migrate deploy
```

---

## 6. Production: Redis (Upstash)

### 6.1 Setup

1. [console.upstash.com](https://console.upstash.com) → Create Redis database
2. Copy the Redis URL (starts with `rediss://` for TLS)
3. Set as `REDIS_URL` on Vercel

### 6.2 Worker on Vercel

Options for running the OCR worker in production:

| Option | Pros | Cons |
|--------|------|------|
| Vercel Cron + API route | Simple, serverless | 60s timeout limit |
| Separate Render/Railway container | No timeout, always on | Additional cost |
| AWS ECS/Fargate task | Scalable | Complex setup |

**Recommended for MVP:** Deploy worker as a separate container on Render:

```yaml
# render.yaml (worker service)
services:
  - type: worker
    name: finance-king-worker
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerCommand: npm run worker
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
```

---

## 7. Production: Object Storage

### 7.1 AWS S3

```bash
aws s3 mb s3://finance-king-uploads
aws s3api put-bucket-encryption --bucket finance-king-uploads \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket finance-king-uploads \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

Vercel env:
```
STORAGE_ENDPOINT=https://s3.us-east-1.amazonaws.com
STORAGE_REGION=us-east-1
STORAGE_FORCE_PATH_STYLE=false
```

### 7.2 Cloudflare R2 (Alternative)

```
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_FORCE_PATH_STYLE=false
```

---

## 8. Custom Domain

### 8.1 Vercel Domain Setup

1. Vercel → Project → Settings → Domains
2. Add `financeking.app` (or your domain)
3. Configure DNS per Vercel instructions
4. Update environment variables:
   - `AUTH_URL=https://financeking.app`
   - `NEXT_PUBLIC_APP_URL=https://financeking.app`
5. Redeploy

### 8.2 SSL

Vercel provides automatic SSL. Neon requires `sslmode=require` in connection string.

---

## 9. CI/CD

### 9.1 GitHub → Vercel Auto-Deploy

| Branch | Vercel Environment |
|--------|-------------------|
| `main` | Production |
| PR branches | Preview |

### 9.2 Build Checks

```bash
npm run type-check    # TypeScript
npm run lint          # ESLint
npm run test          # Vitest unit tests
npm run build         # Production build
```

Recommended GitHub Actions workflow:

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test
      - run: npm run build
        env:
          DATABASE_URL: "postgresql://fake:fake@localhost:5432/fake"
          AUTH_SECRET: "test-secret-for-ci-build-only-32chars"
```

---

## 10. Database Management

### 10.1 Commands

```bash
npm run db:generate   # Regenerate Prisma client
npm run db:migrate    # Create + apply migration (dev)
npm run db:push       # Push schema without migration (dev)
npm run db:studio     # Prisma Studio GUI
npm run db:seed       # Run seed script
```

### 10.2 Production Migrations

```bash
# Always use migrate deploy in production (not migrate dev)
DATABASE_URL="neon-pooled-url" npx prisma migrate deploy
```

### 10.3 Neon Branching (Staging)

Neon supports database branches for preview environments:

1. Create branch `staging` in Neon console
2. Set preview Vercel deploys to use staging branch URL
3. Run migrations on staging before production

---

## 11. Monitoring & Health

### 11.1 Health Check Endpoint (Planned)

```
GET /api/health
→ { status: "ok", database: "connected", redis: "connected" }
```

### 11.2 Vercel Analytics

Enable Vercel Analytics and Speed Insights for production monitoring.

### 11.3 Neon Monitoring

Neon dashboard provides:
- Connection count
- Query performance
- Storage usage
- Branch management

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `PrismaClientInitializationError` | Wrong DATABASE_URL | Check Neon pooled URL, sslmode=require |
| Auth redirect loop | AUTH_URL mismatch | Set AUTH_URL to exact production URL |
| OCR jobs not processing | Worker not running | Start worker process; check REDIS_URL |
| Upload fails | MinIO/S3 not reachable | Check STORAGE_* env vars; bucket exists |
| Build fails on Vercel | Missing env vars | Set all required vars; redeploy |
| `too many connections` | Neon connection limit | Use pooled URL (`-pooler` hostname) |
| Session not persisting | AUTH_SECRET changed | Keep AUTH_SECRET stable across deploys |

---

## 13. Security Checklist (Production)

- [ ] Unique `AUTH_SECRET` (not the example value)
- [ ] Unique `ENCRYPTION_KEY` (not the example value)
- [ ] Neon pooled connection with SSL
- [ ] S3 bucket has no public access
- [ ] No demo seed data in production database
- [ ] `AUTH_URL` matches production domain exactly
- [ ] All `NEXT_PUBLIC_*` vars reviewed for sensitive data
- [ ] `.env` files in `.gitignore`

---

## 14. Related Documents

- [Architecture](./architecture.md) — System topology
- [Security](./security.md) — Secret management
- [OCR Ingestion](./ocr-ingestion.md) — Worker and storage setup
