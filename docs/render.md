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
5. Wait for the first deploy to finish. Migrations run at **startup** via `scripts/render-start.sh` (not during build — avoids DB timing issues on first deploy).

Your app URL will look like: `https://finance-king.onrender.com`

---

## 2. Enable uploads (Cloudflare R2)

Uploads need S3-compatible storage. Render does not provide this — use **Cloudflare R2** (free tier is fine for dev).

### Step A — Create R2 bucket

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) → **R2**
2. **Create bucket** → name: `finance-king-uploads`
3. Note your **Account ID** (right sidebar on R2 overview)

### Step B — Create API token

1. R2 → **Manage R2 API tokens** → **Create API token**
2. Permissions: **Object Read & Write**
3. Scope: this bucket only (or all buckets for dev)
4. Copy the **Access Key ID** and **Secret Access Key** (secret shown once)

### Step C — Set Render environment variables

On **both** `finance-king` (web) and `finance-king-worker`:

| Variable | Value |
|----------|-------|
| `STORAGE_ENDPOINT` | `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | `auto` |
| `STORAGE_ACCESS_KEY` | R2 access key ID |
| `STORAGE_SECRET_KEY` | R2 secret access key |
| `STORAGE_BUCKET` | `finance-king-uploads` |
| `STORAGE_FORCE_PATH_STYLE` | `false` |

> Do **not** put the bucket name in the endpoint URL.

### Step D — Redeploy and verify

1. **Manual Deploy** web + worker after saving env vars
2. Web service **Shell**:

```bash
npm run test:storage
```

3. Browser: `https://YOUR-APP.onrender.com/api/health` → `"storage": "ok"`
4. Confirm **finance-king-worker** status is **Live**

### Step E — Test an upload

1. Go to **Uploads** in the app
2. Upload a bank screenshot (PNG/JPG)
3. Status should move `PROCESSING` → `REVIEW_REQUIRED` within ~30s
4. Click **Review** → **Confirm & Save**

> Dashboard and other pages work without storage. Only uploads need R2.

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

Returns database, Redis, and storage status. Render uses this for deploy health checks.

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
| Upload fails immediately | Run `npm run test:storage` in Shell; check `STORAGE_*` on web + worker |
| Upload stuck on PROCESSING | Confirm worker is **Live**; check worker logs for OCR errors |
| Cold start slow | Free web tier sleeps after ~15 min idle — upgrade to `starter` for always-on |
| `ENCRYPTION_KEY` errors | Re-copy the same key from web → worker env |

---

## Related

- [Deployment guide](./deployment.md) — Vercel + Neon production path
- [Architecture](./architecture.md) — system overview
