# Finance King

Premium personal financial dashboard — your financial command center.

> **Standalone repository:** https://github.com/delaney31/finance-king  
> See [SETUP.md](SETUP.md) to publish if you cloned from a monorepo or agent workspace.

## Features

- **Safe-to-Spend Engine** — Real-time calculation excluding protected reserves, bills, and commitments
- **Overdraft Guardian** — 90-day balance forecasting with risk alerts
- **Account Routing** — Enforce income routing rules across personal, business, and property accounts
- **OCR Upload Center** — Upload bank screenshots and statements with mandatory review
- **Scenario Planning** — Conservative, base, and strong projections with optional ESOP upside
- **Credit Payoff Planner** — Avalanche/snowball strategies with educational disclaimers
- **Can I Afford It?** — Purchase impact simulator with proceed/reduce/delay/decline recommendations

## Tech Stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS 4, shadcn/ui
- PostgreSQL, Prisma ORM
- NextAuth v5
- BullMQ + Redis (background jobs)
- MinIO/S3 (file storage)
- Tesseract.js (local OCR)
- Vitest + Playwright

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### Local Development

```bash
# Copy environment
cp .env.example .env

# Start infrastructure
docker compose up -d postgres redis minio minio-init

# Install dependencies
npm install

# Run migrations and seed
npx prisma migrate dev --name init
npm run db:seed

# Start dev server
npm run dev
```

Open http://localhost:3000

**Demo login:** `tim@financeking.local` / `demo12345`

### Render (dev/staging — accessible from any machine)

Deploy to Render with the included Blueprint:

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** → connect this repo
2. Add Cloudflare R2 (or S3) credentials for uploads — see [docs/render.md](docs/render.md)
3. Seed once in the Render shell: `npm run db:seed`

Your app will be at `https://finance-king.onrender.com` (or similar).

### Docker (full stack)

```bash
cp .env.example .env
docker compose up --build
```

### Tests

```bash
npm test              # Vitest unit tests (financial engine)
npx playwright test   # E2E tests
```

## Documentation

See [`docs/`](docs/) for:

- Product requirements (`PRD.md`)
- Architecture (`architecture.md`)
- Database schema (`database-schema.md`)
- Safe-to-spend formula (`safe-to-spend.md`)
- Security model (`security.md`)
- Deployment guide (`deployment.md`)

## Project Structure

```
src/
├── app/              # Next.js App Router pages & API
├── components/       # UI components
├── lib/
│   ├── engine/       # Pure financial calculation engine
│   ├── ocr/          # OCR abstraction
│   ├── storage/      # Object storage abstraction
│   ├── auth/         # NextAuth configuration
│   └── services/     # DB-backed services
└── workers/          # Background job processors
```

## License

Private — personal use. Architected for future SaaS expansion.
