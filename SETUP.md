# Publish Finance King to its own GitHub repository

Finance King is designed as a **standalone repository**, separate from `warwick-bethel-retreat`.

## Step 1 — Create the empty repo on GitHub

1. Open **https://github.com/new**
2. Repository name: **`finance-king`**
3. Visibility: **Private** (recommended)
4. **Do not** add a README, `.gitignore`, or license (the project already has these)
5. Click **Create repository**

## Step 2 — Push this codebase

From the project root:

```bash
chmod +x scripts/push-to-github.sh
./scripts/push-to-github.sh
```

Or manually:

```bash
git remote add finance-king https://github.com/delaney31/finance-king.git
git push -u finance-king main
```

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

## Repository URL

After publishing: **https://github.com/delaney31/finance-king**
