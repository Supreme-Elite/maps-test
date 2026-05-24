#!/bin/sh
set -eu

ROOT=/usr/share/nginx/html
OM_WORKER_URL="${OM_WORKER_URL:-}"
CUMUL_ENABLED="${CUMUL_ENABLED:-false}"

find "$ROOT" -type f \( -name '*.js' -o -name '*.html' -o -name '*.css' \) -exec sed -i \
  -e "s|__OM_WORKER_URL__|${OM_WORKER_URL}|g" \
  -e "s|__CUMUL_ENABLED__|${CUMUL_ENABLED}|g" \
  {} +

echo "[runtime-env] OM_WORKER_URL=${OM_WORKER_URL} CUMUL_ENABLED=${CUMUL_ENABLED}"
