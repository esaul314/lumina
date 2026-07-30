#!/bin/bash

# --- LUMINA AUTOMATED SERVER LAUNCHER ---
echo "Starting Lumina Ambient Server..."

# 1. Navigate to project root
cd "$(dirname "$0")"

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

# 2. Launch Express + Vite server in the background
npm run server > server.log 2>&1 &
SERVER_PID=$!

echo "Lumina server initiated in background (PID: $SERVER_PID)."
echo "System idle daemon is active. Kiosk screensaver will automatically open after 10 minutes of inactivity."
echo "Moving the mouse or typing will instantly close the screensaver."
echo "Lumina launched successfully. Logs at server.log"
wait $SERVER_PID
