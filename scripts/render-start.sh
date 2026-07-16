#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting Next.js on port ${PORT:-3000}..."
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
