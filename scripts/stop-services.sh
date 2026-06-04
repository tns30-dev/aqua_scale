#!/usr/bin/env bash
# Stop everything started by run-services.sh.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDS="$ROOT/local/run/pids"
[[ -d "$PIDS" ]] || { echo "nothing to stop"; exit 0; }
for f in "$PIDS"/*.pid; do
  [[ -e "$f" ]] || continue
  name="$(basename "$f" .pid)"
  pid="$(cat "$f")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" && echo "stopped $name ($pid)"
  else
    echo "$name not running"
  fi
  rm -f "$f"
done
