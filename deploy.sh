#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "==> Roomzo deploy started"

if [ ! -f .env ]; then
  echo "ERROR: .env missing. Copy .env.example to .env and fill production values first."
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Building frontend + Nitro backend"
npm run build

echo "==> Restarting PM2 app"
if pm2 describe roomzo >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo "==> Done. App should be live behind Nginx on port 3000."
echo "    Test: curl -I http://127.0.0.1:3000"
