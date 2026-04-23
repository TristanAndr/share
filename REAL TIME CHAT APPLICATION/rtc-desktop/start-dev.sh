#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Development launcher for the Electron desktop app
# Starts: backend → frontend → Electron
# Usage: cd rtc-desktop && bash start-dev.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../rtc-backend"
FRONTEND_DIR="$SCRIPT_DIR/../rtc-frontend"
DESKTOP_DIR="$SCRIPT_DIR"

cleanup() {
  echo ""
  echo "Stopping all processes..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Install dependencies if needed ──────────────────────────────────────────

if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "[Backend] Installing dependencies..."
  (cd "$BACKEND_DIR" && npm install)
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "[Frontend] Installing dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

if [ ! -d "$DESKTOP_DIR/node_modules" ]; then
  echo "[Desktop] Installing dependencies..."
  (cd "$DESKTOP_DIR" && npm install)
fi

# ── Start backend ────────────────────────────────────────────────────────────

echo "[Backend] Starting on port 3001..."
(cd "$BACKEND_DIR" && npm run dev) &
BACKEND_PID=$!

# ── Wait for backend ─────────────────────────────────────────────────────────

echo "[Backend] Waiting for port 3001..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "[Backend] Ready!"
    break
  fi
  sleep 2
done

# ── Start frontend ───────────────────────────────────────────────────────────

echo "[Frontend] Starting on port 3000..."
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!

# ── Wait for frontend ────────────────────────────────────────────────────────

echo "[Frontend] Waiting for port 3000..."
for i in $(seq 1 40); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "[Frontend] Ready!"
    break
  fi
  sleep 2
done

# ── Start Electron ────────────────────────────────────────────────────────────

echo "[Electron] Building and starting..."
cd "$DESKTOP_DIR"
npm run build
npx electron .

cleanup
