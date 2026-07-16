# Finance King on Render (development / staging)

Host the full stack on [Render](https://render.com) for a stable URL you can open from any machine — no tunnels or local Docker required.

## What gets deployed

| Resource | Render type | Purpose |
|----------|-------------|---------|
| `finance-king` | Web service (Node) | Next.js app |
| `finance-king-worker` | Background worker | OCR upload queue |
| `finance-king-db` | PostgreSQL | App database |
| `finance-king-redis` | Key Value (Redis) | BullMQ job queue |

**Estimated dev cost:** ~$7–14/mo (Postgres `basic-256mb` + optional worker `starter`). Web and Redis free tiers are available; free web spins down after inactivity (~50s cold start).

---

## 1. One-click Blueprint deploy

1. Push this repo to GitHub (`delaney31/finance-king`).
2. Open [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect the `finance-king` repository, branch `main`.
4. Render reads `render.yaml` at the repo root and provisions all services.
5. Wait for the first deploy to finish (migrations run during the build step).

> **Note:** Render's free web tier does not support `preDeployCommand`, so `prisma migrate deploy` runs inside `npm run render-build` instead.

Your app URL will look like: `https://finance-king.onrender.com`

---

## 2. Object storage (required for uploads)

Render does not include S3-compatible storage. Use **Cloudflare R2** (free tier works for dev):

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → Create bucket `finance-king-uploads`
2. **Manage R2 API tokens** → Create token with Object Read & Write
3. In Render → **finance-king** web service → **Environment** → set:

| Variable | Example |
|----------|---------|
| `STORAGE_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | `auto` |
| `STORAGE_ACCESS_KEY` | R2 access key id |
| `STORAGE_SECRET_KEY` | R2 secret |
| `STORAGE_BUCKET` | `finance-king-uploads` |
| `STORAGE_FORCE_PATH_STYLE` | `false` |

4. Copy the same `STORAGE_*` values to **finance-king-worker**.
5. **Manual Deploy** both services after saving env vars.

> Dashboard, accounts, scenarios, and credit tools work without storage. Uploads/OCR require these variables.

---

## 3. Seed demo data (one time)

After the first successful deploy:

1. Render → **finance-king** → **Shell**
2. Run:

```bash
npm run db:seed
```

**Demo login:** `tim@financeking.local` / `demo12345`

---

## 4. Health check

```
GET https://finance-king.onrender.com/api/health
```

Returns database and Redis status. Render uses this for deploy health checks.

---

## 5. Manual deploy (without Blueprint)

If you prefer creating services by hand:

### Web service

- **Runtime:** Node
- **Build:** `npm ci --include=dev && npm run render-build` (includes `prisma migrate deploy`)
- **Start:** `npm run render:start`
- **Health check path:** `/api/health`

### Worker

- **Runtime:** Node
- **Build:** `npm ci --include=dev && npx prisma generate`
- **Start:** `npm run worker`

Wire `DATABASE_URL` and `REDIS_URL` from your Render Postgres and Key Value instances. Copy `ENCRYPTION_KEY` from the web service to the worker.

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails on Prisma | Ensure `DATABASE_URL` is set from the linked Postgres instance |
| Auth redirect loop | Confirm `AUTH_URL` matches `RENDER_EXTERNAL_URL` (set automatically by Blueprint) |
| Uploads hang | Check worker is running; verify `REDIS_URL` and `STORAGE_*` on both services |
| Cold start slow | Free web tier sleeps after ~15 min idle — upgrade to `starter` for always-on |
| `ENCRYPTION_KEY` errors | Re-copy the same key from web → worker env |

---

## Related

- [Deployment guide](./deployment.md) — Vercel + Neon production path
- [Architecture](./architecture.md) — system overview
