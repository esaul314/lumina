#!/bin/bash

# --- LUMINA AUTOMATED SERVER LAUNCHER ---
echo "Starting Lumina Ambient Server..."

# 1. Navigate to project root
cd /home/alex/work/lumina

# 2. Launch Express + Vite server in the background
npm run server > /home/alex/work/lumina/server.log 2>&1 &
SERVER_PID=$!

echo "Lumina server initiated in background (PID: $SERVER_PID)."
echo "System idle daemon is active. Kiosk screensaver will automatically open after 10 minutes of inactivity."
echo "Moving the mouse or typing will instantly close the screensaver."
echo "Lumina launched successfully. Logs at /home/alex/work/lumina/server.log"
wait $SERVER_PID

