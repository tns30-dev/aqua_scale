#!/usr/bin/env bash
# Guarded local growth-data helper for second-round performance testing.
#
# This appends synthetic ingestion rows for Demo Shrimp Farm so C1-C6 style
# growth tests measure the current microservice endpoints over denser data.
#
# Usage:
#   ALLOW_LOCAL_PERF_GROWTH=yes TARGET_READING_ROWS=1000000 ./scripts/grow-local-performance-data.sh

set -euo pipefail

if [[ "${ALLOW_LOCAL_PERF_GROWTH:-}" != "yes" ]]; then
  cat >&2 <<'EOF'
Refusing to add local performance growth data without ALLOW_LOCAL_PERF_GROWTH=yes.

This script writes directly to the local AquaShield database. Use it only for
performance rehearsal/evidence databases, not for hand-curated demo data.
EOF
  exit 2
fi

DB_CONTAINER="${DB_CONTAINER:-aq-postgres}"
DB_USER="${DB_USER:-aquashield}"
DB_NAME="${DB_NAME:-aquashield}"
PROJECT_NAME="${PROJECT_NAME:-Demo Shrimp Farm}"
TARGET_READING_ROWS="${TARGET_READING_ROWS:-1000000}"
MEASURE_END_DATE="${MEASURE_END_DATE:-2026-07-31}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-30}"
SQL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sql/grow-ingestion-readings-local.sql"

docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 \
  -v ALLOW_AQUASHIELD_PERF_GROWTH=1 \
  -v project_name="$PROJECT_NAME" \
  -v target_rows="$TARGET_READING_ROWS" \
  -v measure_end_date="$MEASURE_END_DATE" \
  -v interval_seconds="$INTERVAL_SECONDS" \
  -U "$DB_USER" -d "$DB_NAME" < "$SQL_FILE"
