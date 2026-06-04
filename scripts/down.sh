#!/usr/bin/env bash
# Stop the full platform (containers kept for fast restart).
#   ./scripts/down.sh        stop everything (incl. infra)
#   ./scripts/down.sh -v     ALSO wipe the database volume (fresh start)
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose --profile app down "$@"
