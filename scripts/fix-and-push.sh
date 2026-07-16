#!/usr/bin/env bash
set -euo pipefail

# Fixes OAuth "workflow scope" push rejection, then pushes to origin (finance-king).
# Run from your finance-king clone on your Mac:
#   curl -fsSL https://raw.githubusercontent.com/delaney31/warwick-bethel-retreat/cursor/finance-king-standalone-4c39/scripts/fix-and-push.sh | bash

echo "Removing .github/workflows (OAuth blocks workflow files without workflow scope)..."
rm -rf .github

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "fix: remove GitHub Actions workflow for initial OAuth push"
fi

echo "Pushing to origin main..."
git push -u origin main

echo "Done. Add CI later from docs/ci-workflow.md"
