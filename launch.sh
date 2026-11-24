#!/bin/bash
set -euo pipefail

# --- LUMINA AUTOMATED SERVER LAUNCHER ---
echo "Starting Lumina Ambient Server..."

# 1. Navigate to project root
cd "$(dirname "$0")"

NODE_BIN="${NODE_BIN:-$(command -v node)}"
NODE_VERSION="$(<.nvmrc)"
ACTUAL_NODE_VERSION="$("$NODE_BIN" --version)"
if [[ "$ACTUAL_NODE_VERSION" != "v$NODE_VERSION" ]]; then
  echo "Node runtime mismatch: expected v$NODE_VERSION, got $ACTUAL_NODE_VERSION." >&2
  exit 1
fi

# Do not create a second daemon when the systemd-managed instance already owns
# the public port. A duplicate daemon also creates a shared Chromium singleton
# handoff, which looks like a browser crash loop.
if ss -ltn 2>/dev/null | awk '$4 ~ /:5000$/ { found = 1 } END { exit found ? 0 : 1 }'; then
  echo "Lumina is already listening on port 5000; refusing duplicate launch."
  exit 1
fi

LOCK_FILE="${XDG_RUNTIME_DIR:-/tmp}/lumina-launch.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another Lumina launch wrapper is already active; refusing duplicate launch."
  exit 1
fi

# ponytail: exec the pinned runtime directly; no npm/child supervisor wrapper.
echo "Lumina starting. Logs at server.log"
exec "$NODE_BIN" server.js > server.log 2>&1
