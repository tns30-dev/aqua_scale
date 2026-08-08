#!/usr/bin/env bash
set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-aquashield-ms-dev-20260808}"
BIGQUERY_DATASET_ID="${BIGQUERY_DATASET_ID:-aquashield_dev_analytics}"
BIGQUERY_TABLE_NAME="${BIGQUERY_TABLE_NAME:-readings}"
LOCAL_POSTGRES_CONTAINER="${LOCAL_POSTGRES_CONTAINER:-aq-postgres}"
LOCAL_DB_USER="${LOCAL_DB_USER:-aquashield}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-aquashield}"
LOAD_LIMIT="${LOAD_LIMIT:-4000000}"
EXPORT_FILE="${EXPORT_FILE:-/private/tmp/aquashield-bigquery-readings-${LOAD_LIMIT}.ndjson.gz}"

if ! [[ "$LOAD_LIMIT" =~ ^[0-9]+$ ]]; then
  echo "LOAD_LIMIT must be numeric" >&2
  exit 2
fi

echo "Exporting ${LOAD_LIMIT} telemetry facts from local Postgres to ${EXPORT_FILE}"
docker exec "$LOCAL_POSTGRES_CONTAINER" psql \
  -U "$LOCAL_DB_USER" \
  -d "$LOCAL_DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -At \
  -c "copy (
    select json_build_object(
      'event_ts', r.measured_at,
      'project_id', r.project_id::text,
      'pond_id', coalesce(r.pond_id::text, 'project'),
      'device_id', coalesce(m.device_code, m.iot_device_id::text),
      'parameter_key', 'electricity',
      'numeric_value', (r.reading_values ->> 'electricity')::double precision,
      'quality', 'observed',
      'correlation_id', r.reading_id::text,
      'ingested_at', coalesce(m.received_at, r.created_at, r.measured_at)
    )::text
    from ingestion.sensor_readings r
    join ingestion.sensor_messages m on m.sensor_message_id = r.sensor_message_id
    where r.reading_values ? 'electricity'
    order by r.project_id, r.pond_id, r.measured_at, r.reading_id
    limit ${LOAD_LIMIT}
  ) to stdout" | gzip -c > "$EXPORT_FILE"

echo "Loading ${EXPORT_FILE} into ${GCP_PROJECT_ID}:${BIGQUERY_DATASET_ID}.${BIGQUERY_TABLE_NAME}"
bq --project_id="$GCP_PROJECT_ID" load \
  --replace \
  --source_format=NEWLINE_DELIMITED_JSON \
  "${BIGQUERY_DATASET_ID}.${BIGQUERY_TABLE_NAME}" \
  "$EXPORT_FILE"

bq --project_id="$GCP_PROJECT_ID" query --nouse_legacy_sql \
  "select count(*) as readings_count from \`${GCP_PROJECT_ID}.${BIGQUERY_DATASET_ID}.${BIGQUERY_TABLE_NAME}\`"
