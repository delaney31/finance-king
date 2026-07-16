#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding demo data if database is empty..."
npx tsx scripts/seed-if-empty.ts

echo "Starting Next.js on port ${PORT:-3000}..."
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
