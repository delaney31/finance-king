#!/usr/bin/env bash
set -euo pipefail

# Pushes Finance King to https://github.com/delaney31/finance-king
# Prerequisite: create an empty private repo named "finance-king" on GitHub first.
#   https://github.com/new → name: finance-king → Private → Create (no README)

REPO_URL="${1:-https://github.com/delaney31/finance-king.git}"

if git remote get-url finance-king >/dev/null 2>&1; then
  git remote set-url finance-king "$REPO_URL"
else
  git remote add finance-king "$REPO_URL"
fi

echo "Pushing main to $REPO_URL ..."
git push -u finance-king main

echo "Done. Repository: $REPO_URL"
