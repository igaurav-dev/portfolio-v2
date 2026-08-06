#!/usr/bin/env bash
#
# Build and reload the portfolio under PM2.
#   ./deploy/deploy.sh            build from the current working tree
#   ./deploy/deploy.sh --pull     git pull first
#
# The build happens before the reload, so a broken build leaves the running
# process untouched instead of taking the site down.

set -euo pipefail

APP_NAME="portfolio"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '\033[0;32m→\033[0m %s\n' "$*"; }
die() { printf '\033[0;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || die "node is not installed"
command -v pm2  >/dev/null || die "pm2 is not installed — npm i -g pm2"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "node 18+ required, found $(node -v)"

if [ "${1:-}" = "--pull" ]; then
  log "pulling"
  git pull --ff-only
fi

[ -f .env.local ] || log "warning: no .env.local — the site will run, but /admin and synthesis stay disabled"

log "installing dependencies"
if [ -f package-lock.json ]; then
  npm ci --omit=dev --include=dev
else
  npm install
fi

log "type checking"
npm run typecheck

log "building"
npm run build

# Writable dirs for uploads, the JSON store, and pm2 logs.
mkdir -p data/uploads logs

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  log "reloading $APP_NAME"
  pm2 reload ecosystem.config.cjs --update-env
else
  log "starting $APP_NAME"
  pm2 start ecosystem.config.cjs
fi

pm2 save >/dev/null

log "waiting for the health endpoint"
for i in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8008/api/health >/dev/null 2>&1; then
    STATUS="$(curl -fsS http://127.0.0.1:8008/api/health \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(`status=${j.status} store=${j.store.backend} degraded=[${j.degraded}] unconfigured=[${j.unconfigured}]`)})')"
    log "up on 127.0.0.1:8008 — $STATUS"
    exit 0
  fi
  sleep 1
done

pm2 logs "$APP_NAME" --lines 40 --nostream || true
die "health check never passed — see the logs above"
