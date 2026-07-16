#!/usr/bin/env bash
set -euo pipefail

KEY="${1:-/workspace/.ssh/finance-king-deploy}"

if [[ ! -f "$KEY" ]]; then
  echo "Missing deploy key: $KEY"
  exit 1
fi

chmod 600 "$KEY"

export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o BatchMode=yes"

echo "Fingerprint: $(ssh-keygen -lf "${KEY}.pub" 2>/dev/null || ssh-keygen -y -f "$KEY" | ssh-keygen -lf -)"
echo "Pushing main to git@github.com:delaney31/finance-king.git ..."
git push -u git@github.com:delaney31/finance-king.git main
echo "Done."
