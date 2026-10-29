#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! npx vercel whoami >/dev/null 2>&1; then
  echo "请在浏览器中完成 Vercel 登录（只需一次）…"
  npx vercel login
fi
npx vercel deploy --prod --yes
echo ""
echo "部署完成后，终端会打印 Production 地址（*.vercel.app），可直接分享。"
