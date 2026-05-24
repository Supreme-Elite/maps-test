#!/bin/sh
set -eu

OM_WORKER_URL="${OM_WORKER_URL:-}"
CUMUL_ENABLED="${CUMUL_ENABLED:-true}"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__OM_CONFIG = {
  OM_WORKER_URL: "${OM_WORKER_URL}",
  CUMUL_ENABLED: "${CUMUL_ENABLED}"
};
EOF

echo "[runtime-env] wrote /runtime-config.js: OM_WORKER_URL=${OM_WORKER_URL} CUMUL_ENABLED=${CUMUL_ENABLED}"
