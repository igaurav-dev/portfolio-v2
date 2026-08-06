#!/usr/bin/env bash
# Roll back to the previous commit and redeploy.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PREV="$(git rev-parse HEAD~1)"
printf '\033[0;33m!\033[0m rolling back to %s — %s\n' "${PREV:0:8}" "$(git log -1 --format=%s "$PREV")"
read -rp "continue? [y/N] " ok
[ "$ok" = "y" ] || exit 1

git checkout "$PREV"
exec ./deploy/deploy.sh
