#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
PORT="43127"
URL="http://127.0.0.1:${PORT}/"

cd "$SCRIPT_DIR"

echo "Resort IT Service Desk design preview"
echo ""

if /usr/bin/curl -fsS "$URL" 2>/dev/null | /usr/bin/grep -q "<title>Resort IT Service Desk — Design Prototype</title>"; then
  echo "The preview is already running. Opening it now."
  open "$URL"
  sleep 2
  exit 0
fi

echo "The preview will open in your browser."
echo "Keep this window open while reviewing the design."
echo "Close this window or press Control-C when you are finished."
echo ""

(sleep 1; open "$URL") &
exec /usr/bin/python3 -m http.server "$PORT" --bind 127.0.0.1
