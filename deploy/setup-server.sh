#!/usr/bin/env bash
#
# One-time server preparation. Run as a normal user with sudo, not as root.
set -euo pipefail

log() { printf '\033[0;32m→\033[0m %s\n' "$*"; }

log "installing pm2"
sudo npm install -g pm2

log "adding log rotation (10MB per file, 14 retained, compressed)"
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

log "enabling pm2 on boot"
pm2 startup | tail -1
echo
echo "Run the 'sudo env PATH=...' line printed above, then:"
echo "  ./deploy/deploy.sh"
echo "  pm2 save"
