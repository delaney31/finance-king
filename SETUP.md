# Finance King repository

**Repository:** https://github.com/delaney31/finance-king

Finance King is a **standalone repository**, separate from `warwick-bethel-retreat`.

## Publish `main` (if the GitHub repo is still empty)

Grant your GitHub account write access, then from this project root:

```bash
chmod +x scripts/push-to-github.sh
./scripts/push-to-github.sh
```

Or manually:

```bash
git remote add finance-king https://github.com/delaney31/finance-king.git 2>/dev/null || true
git push -u finance-king main
```

> **OAuth note:** If push fails with `refusing to allow an OAuth App to create or update workflow`, the repo intentionally omits `.github/workflows/` on first push. Add CI later from [docs/ci-workflow.md](docs/ci-workflow.md), or run `gh auth refresh -s workflow` before pushing workflow files.

**Alternative** — import from the backup branch (no local clone):

1. Open https://github.com/delaney31/finance-king/import
2. Source: `https://github.com/delaney31/warwick-bethel-retreat`
3. Branch: `cursor/finance-king-standalone-4c39`
4. Start import

## Step 3 — Local development

```bash
cp .env.example .env
docker compose up -d postgres redis minio minio-init
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

**Demo login:** `tim@financeking.local` / `demo12345`

## Cloud agent note

The Cursor cloud agent can push to `warwick-bethel-retreat` but needs the **Cursor GitHub App** installed on `finance-king` (repo Settings → Integrations) to push directly to this repo.
