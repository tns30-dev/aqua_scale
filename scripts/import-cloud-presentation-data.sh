#!/usr/bin/env bash
# Import second-round presentation data into the managed Cloud SQL runtime.
#
# Data rule:
#   - Monolith/local reference DB `aquaculture` is source of truth for business data.
#   - Cloud SQL is kept for transactional service schemas. High-volume telemetry is
#     intentionally not imported into Cloud SQL for second-round cloud evidence.
#   - The 4M telemetry evidence belongs in Bigtable/BigQuery:
#       Bigtable: aquashield-dev-telemetry/telemetry_readings
#       BigQuery: aquashield_dev_analytics.readings
#
# The target remains one Cloud SQL database with service-owned schemas. This script
# uses one temporary psql pod per service user and does not expose DB passwords.
#
# Usage:
#   ALLOW_CLOUD_PRESENTATION_IMPORT=yes ./scripts/import-cloud-presentation-data.sh
#
# Optional compatibility/demo override only:
#   IMPORT_CLOUD_SQL_TELEMETRY=yes ALLOW_CLOUD_PRESENTATION_IMPORT=yes ./scripts/import-cloud-presentation-data.sh

set -euo pipefail

if [[ "${ALLOW_CLOUD_PRESENTATION_IMPORT:-}" != "yes" ]]; then
  cat >&2 <<'EOF'
Refusing to import without ALLOW_CLOUD_PRESENTATION_IMPORT=yes.

This writes into the managed Cloud SQL database used by the GKE dev runtime.
EOF
  exit 2
fi

NAMESPACE="${NAMESPACE:-aquashield-dev}"
IMAGE="${IMPORT_IMAGE:-postgres:16-alpine}"
SRC_DB="${SRC_DB:-aquaculture}"
SRC_PSQL="${SRC_PSQL:-psql}"
LOCAL_TARGET_DB_HOST="${LOCAL_TARGET_DB_HOST:-localhost}"
LOCAL_TARGET_DB_PORT="${LOCAL_TARGET_DB_PORT:-5433}"
LOCAL_TARGET_DB_USER="${LOCAL_TARGET_DB_USER:-aquashield}"
LOCAL_TARGET_DB_PASSWORD="${LOCAL_TARGET_DB_PASSWORD:-aquashield_local}"
LOCAL_TARGET_DB_NAME="${LOCAL_TARGET_DB_NAME:-aquashield}"
TARGET_PSQL="${TARGET_PSQL:-psql}"
READING_CHUNK_DAYS="${READING_CHUNK_DAYS:-7}"
READING_CHUNK_RETRIES="${READING_CHUNK_RETRIES:-3}"
RESUME_READINGS="${RESUME_READINGS:-no}"
IMPORT_CLOUD_SQL_TELEMETRY="${IMPORT_CLOUD_SQL_TELEMETRY:-no}"

if ! [[ "$READING_CHUNK_DAYS" =~ ^[0-9]+$ ]] || (( READING_CHUNK_DAYS < 1 )); then
  echo "READING_CHUNK_DAYS must be a positive integer" >&2
  exit 2
fi

if ! [[ "$READING_CHUNK_RETRIES" =~ ^[0-9]+$ ]] || (( READING_CHUNK_RETRIES < 1 )); then
  echo "READING_CHUNK_RETRIES must be a positive integer" >&2
  exit 2
fi

case "$IMPORT_CLOUD_SQL_TELEMETRY" in
  yes|no) ;;
  *)
    echo "IMPORT_CLOUD_SQL_TELEMETRY must be yes or no" >&2
    exit 2
    ;;
esac

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/aquashield-cloud-import.XXXXXX")"
PODS=()

cleanup() {
  for pod in "${PODS[@]:-}"; do
    kubectl delete pod "$pod" -n "$NAMESPACE" --ignore-not-found=true --wait=false >/dev/null 2>&1 || true
  done
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

say() { printf '\n>> %s\n' "$*"; }

export_csv() {
  local name="$1"
  local query="$2"
  "$SRC_PSQL" -X -d "$SRC_DB" -v ON_ERROR_STOP=1 -c \
    "\\copy ($query) TO '$TMP_DIR/$name.csv' WITH (FORMAT csv, HEADER true)"
}

make_schema_dir() {
  local schema="$1"
  mkdir -p "$TMP_DIR/$schema"
}

stage_file() {
  local schema="$1"
  local file="$2"
  cp "$TMP_DIR/$file.csv" "$TMP_DIR/$schema/$file.csv"
}

create_client_pod() {
  local pod="$1"
  local user="$2"
  local secret_key="$3"
  local pod_yaml="$TMP_DIR/$pod.yaml"

  kubectl delete pod "$pod" -n "$NAMESPACE" --ignore-not-found=true --wait=true >/dev/null 2>&1 || true

  cat > "$pod_yaml" <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: $pod
  namespace: $NAMESPACE
  annotations:
    sidecar.istio.io/inject: "false"
spec:
  restartPolicy: Never
  containers:
    - name: psql
      image: $IMAGE
      command: ["sleep", "1800"]
      env:
        - name: PGHOST
          valueFrom:
            configMapKeyRef:
              name: managed-gcp-runtime
              key: CLOUD_SQL_PRIVATE_IP
        - name: PGPORT
          value: "5432"
        - name: PGDATABASE
          valueFrom:
            configMapKeyRef:
              name: managed-gcp-runtime
              key: CLOUD_SQL_DATABASE_NAME
        - name: PGUSER
          value: "$user"
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: managed-db-passwords
              key: $secret_key
      resources:
        requests:
          cpu: 100m
          memory: 256Mi
        limits:
          cpu: "1"
          memory: 2Gi
YAML

  kubectl apply -f "$pod_yaml" >/dev/null
  kubectl wait -n "$NAMESPACE" --for=condition=Ready "pod/$pod" --timeout=180s >/dev/null
  PODS+=("$pod")
}

copy_schema_dir_to_pod() {
  local schema="$1"
  local pod="$2"
  kubectl exec -n "$NAMESPACE" "$pod" -- mkdir -p /work >/dev/null
  tar -C "$TMP_DIR/$schema" -cf - . | kubectl exec -i -n "$NAMESPACE" "$pod" -- tar -C /work -xf -
}

run_schema_import() {
  local schema="$1"
  local pod="$2"
  copy_schema_dir_to_pod "$schema" "$pod"
  kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -v ON_ERROR_STOP=1 -f /work/import.sql
}

local_target_scalar() {
  local query="$1"
  PGPASSWORD="$LOCAL_TARGET_DB_PASSWORD" "$TARGET_PSQL" -X -q -A -t \
    -h "$LOCAL_TARGET_DB_HOST" -p "$LOCAL_TARGET_DB_PORT" -U "$LOCAL_TARGET_DB_USER" -d "$LOCAL_TARGET_DB_NAME" \
    -c "$query" | tr -d '[:space:]'
}

cloud_scalar() {
  local pod="$1"
  local query="$2"
  kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -q -A -t -c "$query" | tr -d '[:space:]'
}

write_project_sql() {
  cat > "$TMP_DIR/project/import.sql" <<'SQL'
\pset pager off
\timing on
BEGIN;

CREATE TEMP TABLE stg_profile_types (
  profile_type_id uuid, name varchar(100), code varchar(100), description text,
  stage_config jsonb, key_parameter_indicators text[], key_growth_indicators text[],
  theme jsonb, created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_parameter_types (
  parameter_id uuid, parameter_name varchar(100), parameter_code varchar(100),
  unit varchar(50), data_type varchar(50)
) ON COMMIT DROP;
CREATE TEMP TABLE stg_visualisation_types (
  visualisation_type_id uuid, name varchar(255), description text,
  required_parameters uuid[], chart_type varchar(100)
) ON COMMIT DROP;
CREATE TEMP TABLE stg_projects (
  project_id uuid, project_owner_id uuid, profile_type_id uuid, name varchar(255),
  description text, created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_project_parameter_settings (
  project_parameter_setting_id uuid, project_id uuid, parameter_id uuid,
  min_threshold double precision, max_threshold double precision, is_key_parameter boolean
) ON COMMIT DROP;
CREATE TEMP TABLE stg_project_energy_settings (
  project_energy_setting_id uuid, project_id uuid, type varchar(30), unit varchar(10),
  tariff_per_unit numeric(10,4), currency varchar(3), high_hourly_threshold numeric(10,3),
  high_daily_threshold numeric(10,3), notes text, created_at timestamptz, created_by uuid,
  updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_project_visualisations (
  project_visualisation_id uuid, project_id uuid, visualisation_type_id uuid,
  enabled boolean, flag integer, x_parameters uuid[], y_parameters uuid[], title varchar(255)
) ON COMMIT DROP;

\copy stg_profile_types FROM '/work/profile_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_parameter_types FROM '/work/parameter_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_visualisation_types FROM '/work/visualisation_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_projects FROM '/work/projects.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_parameter_settings FROM '/work/project_parameter_settings.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_energy_settings FROM '/work/project_energy_settings.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_visualisations FROM '/work/project_visualisations.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO project.profile_types (
  profile_type_id, name, code, description, stage_config, key_parameter_indicators,
  key_growth_indicators, theme, created_at, created_by, updated_at, updated_by
)
SELECT s.profile_type_id, s.name, s.code, s.description, s.stage_config,
       s.key_parameter_indicators, s.key_growth_indicators,
       COALESCE(s.theme, '{"primary":"#888888","gradient":{"from":"#888888","to":"#cccccc"}}'::jsonb),
       COALESCE(s.created_at, now()), s.created_by, COALESCE(s.updated_at, now()), s.updated_by
FROM stg_profile_types s
WHERE s.code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project.profile_types t WHERE t.code = s.code);

UPDATE project.profile_types t
SET name = s.name,
    description = s.description,
    stage_config = s.stage_config,
    key_parameter_indicators = s.key_parameter_indicators,
    key_growth_indicators = s.key_growth_indicators,
    theme = COALESCE(s.theme, t.theme),
    updated_at = COALESCE(s.updated_at, now()),
    updated_by = s.updated_by
FROM stg_profile_types s
WHERE t.code = s.code;

INSERT INTO project.parameter_types (parameter_id, parameter_name, parameter_code, unit, data_type)
SELECT s.parameter_id, s.parameter_name, s.parameter_code, s.unit, COALESCE(s.data_type, 'float')
FROM stg_parameter_types s
WHERE NOT EXISTS (
  SELECT 1 FROM project.parameter_types t WHERE t.parameter_code = s.parameter_code
)
ON CONFLICT (parameter_id) DO NOTHING;

UPDATE project.parameter_types t
SET parameter_name = s.parameter_name,
    unit = s.unit,
    data_type = COALESCE(s.data_type, t.data_type)
FROM stg_parameter_types s
WHERE t.parameter_code = s.parameter_code;

WITH mapped AS (
  SELECT
    s.visualisation_type_id, s.name, s.description, s.chart_type,
    ARRAY(
      SELECT t.parameter_id
      FROM unnest(s.required_parameters) WITH ORDINALITY u(source_parameter_id, ord)
      JOIN stg_parameter_types sp ON sp.parameter_id = u.source_parameter_id
      JOIN project.parameter_types t ON t.parameter_code = sp.parameter_code
      ORDER BY u.ord
    ) AS required_parameters
  FROM stg_visualisation_types s
)
UPDATE project.visualisation_types t
SET description = m.description,
    required_parameters = NULLIF(m.required_parameters, ARRAY[]::uuid[]),
    chart_type = m.chart_type
FROM mapped m
WHERE t.name = m.name;

WITH mapped AS (
  SELECT
    s.visualisation_type_id, s.name, s.description, s.chart_type,
    ARRAY(
      SELECT t.parameter_id
      FROM unnest(s.required_parameters) WITH ORDINALITY u(source_parameter_id, ord)
      JOIN stg_parameter_types sp ON sp.parameter_id = u.source_parameter_id
      JOIN project.parameter_types t ON t.parameter_code = sp.parameter_code
      ORDER BY u.ord
    ) AS required_parameters
  FROM stg_visualisation_types s
)
INSERT INTO project.visualisation_types (
  visualisation_type_id, name, description, required_parameters, chart_type
)
SELECT m.visualisation_type_id, m.name, m.description,
       NULLIF(m.required_parameters, ARRAY[]::uuid[]), m.chart_type
FROM mapped m
WHERE NOT EXISTS (SELECT 1 FROM project.visualisation_types t WHERE t.name = m.name);

INSERT INTO project.projects (
  project_id, project_owner_id, profile_type_id, name, description,
  created_at, created_by, updated_at, updated_by
)
SELECT p.project_id, p.project_owner_id, tp.profile_type_id, p.name, p.description,
       COALESCE(p.created_at, now()), p.created_by, COALESCE(p.updated_at, now()), p.updated_by
FROM stg_projects p
JOIN stg_profile_types sp ON sp.profile_type_id = p.profile_type_id
JOIN project.profile_types tp ON tp.code = sp.code
ON CONFLICT (project_id) DO UPDATE
SET project_owner_id = EXCLUDED.project_owner_id,
    profile_type_id = EXCLUDED.profile_type_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

INSERT INTO project.project_parameter_settings (
  project_parameter_setting_id, project_id, parameter_id, min_threshold, max_threshold, is_key_parameter
)
SELECT s.project_parameter_setting_id, s.project_id, tp.parameter_id,
       s.min_threshold, s.max_threshold, COALESCE(s.is_key_parameter, false)
FROM stg_project_parameter_settings s
JOIN stg_parameter_types sp ON sp.parameter_id = s.parameter_id
JOIN project.parameter_types tp ON tp.parameter_code = sp.parameter_code
ON CONFLICT (project_id, parameter_id) DO UPDATE
SET min_threshold = EXCLUDED.min_threshold,
    max_threshold = EXCLUDED.max_threshold,
    is_key_parameter = EXCLUDED.is_key_parameter;

INSERT INTO project.project_energy_settings (
  project_energy_setting_id, project_id, type, unit, tariff_per_unit, currency,
  high_hourly_threshold, high_daily_threshold, notes, created_at, created_by, updated_at, updated_by
)
SELECT project_energy_setting_id, project_id, COALESCE(type, 'electricity'), COALESCE(unit, 'kWh'),
       COALESCE(tariff_per_unit, 0), COALESCE(currency, 'USD'), high_hourly_threshold,
       high_daily_threshold, notes, COALESCE(created_at, now()), created_by,
       COALESCE(updated_at, now()), updated_by
FROM stg_project_energy_settings
ON CONFLICT (project_id, type) DO UPDATE
SET unit = EXCLUDED.unit,
    tariff_per_unit = EXCLUDED.tariff_per_unit,
    currency = EXCLUDED.currency,
    high_hourly_threshold = EXCLUDED.high_hourly_threshold,
    high_daily_threshold = EXCLUDED.high_daily_threshold,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

INSERT INTO project.project_visualisations (
  project_visualisation_id, project_id, visualisation_type_id, enabled, flag,
  x_parameters, y_parameters, title
)
SELECT
  pv.project_visualisation_id, pv.project_id, tv.visualisation_type_id,
  COALESCE(pv.enabled, true), pv.flag,
  ARRAY(
    SELECT tp.parameter_id
    FROM unnest(pv.x_parameters) WITH ORDINALITY u(source_parameter_id, ord)
    JOIN stg_parameter_types sp ON sp.parameter_id = u.source_parameter_id
    JOIN project.parameter_types tp ON tp.parameter_code = sp.parameter_code
    ORDER BY u.ord
  ),
  ARRAY(
    SELECT tp.parameter_id
    FROM unnest(pv.y_parameters) WITH ORDINALITY u(source_parameter_id, ord)
    JOIN stg_parameter_types sp ON sp.parameter_id = u.source_parameter_id
    JOIN project.parameter_types tp ON tp.parameter_code = sp.parameter_code
    ORDER BY u.ord
  ),
  pv.title
FROM stg_project_visualisations pv
JOIN stg_visualisation_types sv ON sv.visualisation_type_id = pv.visualisation_type_id
JOIN project.visualisation_types tv ON tv.name = sv.name
ON CONFLICT (project_visualisation_id) DO UPDATE
SET visualisation_type_id = EXCLUDED.visualisation_type_id,
    enabled = EXCLUDED.enabled,
    flag = EXCLUDED.flag,
    x_parameters = EXCLUDED.x_parameters,
    y_parameters = EXCLUDED.y_parameters,
    title = EXCLUDED.title;

COMMIT;

select *
from (
  values
    ('project.projects', (select count(*)::bigint from project.projects)),
    ('project.profile_types', (select count(*)::bigint from project.profile_types)),
    ('project.parameter_types', (select count(*)::bigint from project.parameter_types)),
    ('project.project_parameter_settings', (select count(*)::bigint from project.project_parameter_settings)),
    ('project.project_energy_settings', (select count(*)::bigint from project.project_energy_settings)),
    ('project.project_visualisations', (select count(*)::bigint from project.project_visualisations))
) as counts(table_name, row_count)
order by table_name;
SQL
}

write_identity_sql() {
  cat > "$TMP_DIR/identity/import.sql" <<'SQL'
\pset pager off
\timing on
BEGIN;

CREATE TEMP TABLE stg_users (
  user_id uuid, email varchar(255), password_hash varchar(255), first_name varchar(120),
  last_name varchar(120), mobile_number varchar(40), role varchar(50),
  feature_action_assigned jsonb, is_active boolean, created_at timestamptz, updated_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE stg_user_projects (
  user_project_id uuid, user_id uuid, project_id uuid, assigned_at timestamptz, assigned_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_projects (project_id uuid) ON COMMIT DROP;

\copy stg_users FROM '/work/users.csv' WITH (FORMAT csv, HEADER true)
\copy stg_user_projects FROM '/work/user_projects.csv' WITH (FORMAT csv, HEADER true)
\copy stg_projects FROM '/work/projects_for_identity.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO identity_access.users (
  user_id, email, password_hash, first_name, last_name, mobile_number, role,
  feature_action_assigned, is_active, created_at, updated_at
)
SELECT user_id, email, password_hash, first_name, last_name, mobile_number, role,
       COALESCE(feature_action_assigned, '[]'::jsonb), COALESCE(is_active, true),
       COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM stg_users
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    mobile_number = EXCLUDED.mobile_number,
    role = EXCLUDED.role,
    feature_action_assigned = EXCLUDED.feature_action_assigned,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;

INSERT INTO identity_access.user_projects (
  user_project_id, user_id, project_id, assigned_at, assigned_by
)
SELECT user_project_id, user_id, project_id, COALESCE(assigned_at, now()), assigned_by
FROM stg_user_projects
ON CONFLICT (user_id, project_id) DO NOTHING;

INSERT INTO identity_access.user_projects (user_id, project_id, assigned_at, assigned_by)
SELECT admin.user_id, p.project_id, now(), admin.user_id
FROM identity_access.users admin
CROSS JOIN stg_projects p
WHERE admin.email = 'admin@aquashield.local'
ON CONFLICT (user_id, project_id) DO NOTHING;

COMMIT;

select *
from (
  values
    ('identity.users', (select count(*)::bigint from identity_access.users)),
    ('identity.user_projects', (select count(*)::bigint from identity_access.user_projects))
) as counts(table_name, row_count)
order by table_name;
SQL
}

write_pond_sql() {
  cat > "$TMP_DIR/pond/import.sql" <<'SQL'
\pset pager off
\timing on
BEGIN;

CREATE TEMP TABLE stg_ponds (
  pond_id uuid, project_id uuid, name varchar(255), description text, metadata jsonb,
  status varchar(20), photo_url text, created_at timestamptz, updated_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE stg_cycles (
  cycle_id uuid, pond_id uuid, start_date date, end_date date, status varchar(20),
  created_at timestamptz, updated_at timestamptz, created_by uuid, updated_by uuid,
  stocking_biomass_kg numeric(12,2), harvest_biomass_kg numeric(12,2)
) ON COMMIT DROP;
CREATE TEMP TABLE stg_cycle_daily_health (
  health_id uuid, cycle_id uuid, day_number integer, date date, health_status varchar(20),
  alert_count integer, created_at timestamptz, updated_at timestamptz, created_by uuid, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_cycle_stage_metrics (
  metric_id uuid, cycle_id uuid, stage_name varchar(100), metrics jsonb, calculated_at timestamptz,
  created_at timestamptz, updated_at timestamptz, created_by uuid, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_feed_types (
  feed_type_id uuid, project_id uuid, name varchar(255), pack_kg numeric(10,2),
  pack_price numeric(12,2), currency varchar(3), active boolean, created_at timestamptz,
  created_by uuid, updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_feed_logs (
  feed_log_id uuid, pond_id uuid, feed_type_id uuid, fed_on date, fed_time time,
  amount_kg numeric(10,3), pack_kg numeric(10,2), pack_price numeric(12,2),
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_treatments (
  treatment_id uuid, project_id uuid, code text, name text, description text,
  target_parameters jsonb, unit_price numeric(12,2), price_unit varchar(32),
  is_active boolean, created_at timestamptz, updated_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE stg_pond_treatments (
  pond_treatment_id uuid, pond_id uuid, treatment_id uuid, started_at date, ended_at date,
  notes text, amount numeric(12,3), unit varchar(32), unit_price numeric(12,2),
  price_unit varchar(32), created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;

\copy stg_ponds FROM '/work/ponds.csv' WITH (FORMAT csv, HEADER true)
\copy stg_cycles FROM '/work/cycles.csv' WITH (FORMAT csv, HEADER true)
\copy stg_cycle_daily_health FROM '/work/cycle_daily_health.csv' WITH (FORMAT csv, HEADER true)
\copy stg_cycle_stage_metrics FROM '/work/cycle_stage_metrics.csv' WITH (FORMAT csv, HEADER true)
\copy stg_feed_types FROM '/work/feed_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_feed_logs FROM '/work/feed_logs.csv' WITH (FORMAT csv, HEADER true)
\copy stg_treatments FROM '/work/treatments.csv' WITH (FORMAT csv, HEADER true)
\copy stg_pond_treatments FROM '/work/pond_treatments.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO pond.ponds (
  pond_id, project_id, name, description, metadata, status, photo_url, created_at, updated_at
)
SELECT pond_id, project_id, name, description, COALESCE(metadata, '{}'::jsonb),
       COALESCE(status, 'active'), photo_url, COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM stg_ponds
ON CONFLICT (pond_id) DO UPDATE
SET project_id = EXCLUDED.project_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    status = EXCLUDED.status,
    photo_url = EXCLUDED.photo_url,
    updated_at = EXCLUDED.updated_at;

INSERT INTO pond.cycles (
  cycle_id, pond_id, start_date, end_date, status, created_at, updated_at,
  created_by, updated_by, stocking_biomass_kg, harvest_biomass_kg
)
SELECT cycle_id, pond_id, start_date, end_date, COALESCE(status, 'ongoing'),
       COALESCE(created_at, now()), COALESCE(updated_at, now()), created_by, updated_by,
       stocking_biomass_kg, harvest_biomass_kg
FROM stg_cycles
ON CONFLICT (cycle_id) DO UPDATE
SET pond_id = EXCLUDED.pond_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    stocking_biomass_kg = EXCLUDED.stocking_biomass_kg,
    harvest_biomass_kg = EXCLUDED.harvest_biomass_kg;

INSERT INTO pond.cycle_daily_health (
  health_id, cycle_id, day_number, date, health_status, alert_count,
  created_at, updated_at, created_by, updated_by
)
SELECT health_id, cycle_id, day_number, date, health_status, COALESCE(alert_count, 0),
       COALESCE(created_at, now()), COALESCE(updated_at, now()), created_by, updated_by
FROM stg_cycle_daily_health
ON CONFLICT (cycle_id, day_number) DO UPDATE
SET date = EXCLUDED.date,
    health_status = EXCLUDED.health_status,
    alert_count = EXCLUDED.alert_count,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

INSERT INTO pond.cycle_stage_metrics (
  metric_id, cycle_id, stage_name, metrics, calculated_at, created_at, updated_at, created_by, updated_by
)
SELECT metric_id, cycle_id, stage_name, metrics, COALESCE(calculated_at, now()),
       COALESCE(created_at, now()), COALESCE(updated_at, now()), created_by, updated_by
FROM stg_cycle_stage_metrics
ON CONFLICT (cycle_id, stage_name) DO UPDATE
SET metrics = EXCLUDED.metrics,
    calculated_at = EXCLUDED.calculated_at,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

INSERT INTO pond.feed_types (
  feed_type_id, project_id, name, pack_kg, pack_price, currency, active,
  created_at, created_by, updated_at, updated_by
)
SELECT feed_type_id, project_id, name, pack_kg, pack_price, COALESCE(currency, 'USD'),
       COALESCE(active, true), COALESCE(created_at, now()), created_by,
       COALESCE(updated_at, now()), updated_by
FROM stg_feed_types
ON CONFLICT (project_id, name) DO UPDATE
SET pack_kg = EXCLUDED.pack_kg,
    pack_price = EXCLUDED.pack_price,
    currency = EXCLUDED.currency,
    active = EXCLUDED.active,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

INSERT INTO pond.feed_logs (
  feed_log_id, pond_id, feed_type_id, fed_on, fed_time, amount_kg, pack_kg, pack_price,
  created_at, created_by, updated_at, updated_by
)
SELECT fl.feed_log_id, fl.pond_id, ft.feed_type_id, fl.fed_on, fl.fed_time, fl.amount_kg,
       fl.pack_kg, fl.pack_price, COALESCE(fl.created_at, now()), fl.created_by,
       COALESCE(fl.updated_at, now()), fl.updated_by
FROM stg_feed_logs fl
JOIN stg_feed_types sft ON sft.feed_type_id = fl.feed_type_id
JOIN pond.feed_types ft ON ft.project_id = sft.project_id AND ft.name = sft.name
ON CONFLICT (feed_log_id) DO UPDATE
SET pond_id = EXCLUDED.pond_id,
    feed_type_id = EXCLUDED.feed_type_id,
    fed_on = EXCLUDED.fed_on,
    fed_time = EXCLUDED.fed_time,
    amount_kg = EXCLUDED.amount_kg,
    pack_kg = EXCLUDED.pack_kg,
    pack_price = EXCLUDED.pack_price,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

INSERT INTO pond.treatments (
  treatment_id, project_id, code, name, description, target_parameters,
  unit_price, price_unit, is_active, created_at, updated_at
)
SELECT treatment_id, project_id, code, name, description, COALESCE(target_parameters, '[]'::jsonb),
       unit_price, price_unit, COALESCE(is_active, true),
       COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM stg_treatments
ON CONFLICT (project_id, code) WHERE project_id IS NOT NULL DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    target_parameters = EXCLUDED.target_parameters,
    unit_price = EXCLUDED.unit_price,
    price_unit = EXCLUDED.price_unit,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;

INSERT INTO pond.pond_treatments (
  pond_treatment_id, pond_id, treatment_id, started_at, ended_at, notes,
  amount, unit, unit_price, price_unit, created_at, created_by, updated_at, updated_by
)
SELECT pt.pond_treatment_id, pt.pond_id, t.treatment_id, pt.started_at, pt.ended_at, pt.notes,
       pt.amount, pt.unit, pt.unit_price, pt.price_unit, COALESCE(pt.created_at, now()),
       pt.created_by, COALESCE(pt.updated_at, now()), pt.updated_by
FROM stg_pond_treatments pt
JOIN stg_treatments st ON st.treatment_id = pt.treatment_id
JOIN pond.treatments t ON t.project_id = st.project_id AND t.code = st.code
ON CONFLICT (pond_treatment_id) DO UPDATE
SET pond_id = EXCLUDED.pond_id,
    treatment_id = EXCLUDED.treatment_id,
    started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at,
    notes = EXCLUDED.notes,
    amount = EXCLUDED.amount,
    unit = EXCLUDED.unit,
    unit_price = EXCLUDED.unit_price,
    price_unit = EXCLUDED.price_unit,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

COMMIT;

select *
from (
  values
    ('pond.ponds', (select count(*)::bigint from pond.ponds)),
    ('pond.cycles', (select count(*)::bigint from pond.cycles)),
    ('pond.cycle_daily_health', (select count(*)::bigint from pond.cycle_daily_health)),
    ('pond.feed_types', (select count(*)::bigint from pond.feed_types)),
    ('pond.feed_logs', (select count(*)::bigint from pond.feed_logs)),
    ('pond.treatments', (select count(*)::bigint from pond.treatments)),
    ('pond.pond_treatments', (select count(*)::bigint from pond.pond_treatments))
) as counts(table_name, row_count)
order by table_name;
SQL
}

write_sensor_sql() {
  cat > "$TMP_DIR/sensor/import.sql" <<'SQL'
\pset pager off
\timing on
BEGIN;

CREATE TEMP TABLE stg_sensor_types (
  sensor_type_id uuid, name varchar(255), model_number varchar(100), parameter_ids uuid[],
  manufacturer varchar(120), description text, is_active boolean, created_at timestamptz, updated_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE stg_iot_devices (
  iot_device_id uuid, device_code varchar(64), device_name varchar(255), status varchar(50),
  config jsonb, is_active boolean, device_key text, created_at timestamptz, created_by uuid,
  updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_project_sensors (
  project_sensor_id uuid, project_id uuid, pond_id uuid, sensor_type_id uuid, iot_device_id uuid,
  port varchar(32), serial_number varchar(255), status varchar(50), installed_at date,
  sensor_location text, created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;

\copy stg_sensor_types FROM '/work/sensor_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_iot_devices FROM '/work/iot_devices.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_sensors FROM '/work/project_sensors.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO sensor.sensor_types (
  sensor_type_id, name, model_number, parameter_ids, manufacturer, description,
  is_active, created_at, updated_at
)
SELECT
  sensor_type_id, name, model_number, parameter_ids, manufacturer, description,
  COALESCE(is_active, true), COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM stg_sensor_types
ON CONFLICT (model_number) DO UPDATE
SET name = EXCLUDED.name,
    parameter_ids = EXCLUDED.parameter_ids,
    manufacturer = EXCLUDED.manufacturer,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;

INSERT INTO sensor.iot_devices (
  iot_device_id, device_code, device_name, status, config, is_active, device_key,
  created_at, created_by, updated_at, updated_by
)
SELECT iot_device_id, device_code, device_name, COALESCE(status, 'offline'),
       COALESCE(config, '{}'::jsonb), COALESCE(is_active, true), device_key,
       COALESCE(created_at, now()), created_by, COALESCE(updated_at, now()), updated_by
FROM stg_iot_devices
ON CONFLICT (device_code) DO UPDATE
SET device_name = EXCLUDED.device_name,
    status = EXCLUDED.status,
    config = EXCLUDED.config,
    is_active = EXCLUDED.is_active,
    device_key = EXCLUDED.device_key,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

INSERT INTO sensor.project_sensors (
  project_sensor_id, project_id, pond_id, sensor_type_id, iot_device_id, port,
  serial, serial_number, status, installed_at, sensor_location, created_at,
  created_by, updated_at, updated_by
)
SELECT ps.project_sensor_id, ps.project_id, ps.pond_id, st.sensor_type_id, iot.iot_device_id,
       ps.port, ps.serial_number, ps.serial_number, COALESCE(ps.status, 'active'),
       ps.installed_at, ps.sensor_location, COALESCE(ps.created_at, now()), ps.created_by,
       COALESCE(ps.updated_at, now()), ps.updated_by
FROM stg_project_sensors ps
JOIN stg_sensor_types sst ON sst.sensor_type_id = ps.sensor_type_id
JOIN sensor.sensor_types st ON st.model_number = sst.model_number
JOIN stg_iot_devices siot ON siot.iot_device_id = ps.iot_device_id
JOIN sensor.iot_devices iot ON iot.device_code = siot.device_code
ON CONFLICT (project_sensor_id) DO UPDATE
SET project_id = EXCLUDED.project_id,
    pond_id = EXCLUDED.pond_id,
    sensor_type_id = EXCLUDED.sensor_type_id,
    iot_device_id = EXCLUDED.iot_device_id,
    port = EXCLUDED.port,
    serial = EXCLUDED.serial,
    serial_number = EXCLUDED.serial_number,
    status = EXCLUDED.status,
    installed_at = EXCLUDED.installed_at,
    sensor_location = EXCLUDED.sensor_location,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

COMMIT;

select *
from (
  values
    ('sensor.sensor_types', (select count(*)::bigint from sensor.sensor_types)),
    ('sensor.iot_devices', (select count(*)::bigint from sensor.iot_devices)),
    ('sensor.project_sensors', (select count(*)::bigint from sensor.project_sensors))
) as counts(table_name, row_count)
order by table_name;
SQL
}

write_notification_sql() {
  cat > "$TMP_DIR/notification/import.sql" <<'SQL'
\pset pager off
\timing on
BEGIN;

CREATE TEMP TABLE stg_alert_log (
  log_id uuid, pond_id uuid, project_id uuid, pond_name varchar(255), "timestamp" timestamptz,
  log_type varchar(50), message text, severity varchar(50), acknowledged boolean,
  acknowledged_by uuid, acknowledged_at timestamptz, resolved boolean, parameter varchar(100),
  reading_timestamp timestamptz, resolved_by uuid, resolved_at timestamptz
) ON COMMIT DROP;

\copy stg_alert_log FROM '/work/alert_log.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO notification.alert_log (
  log_id, pond_id, project_id, pond_name, "timestamp", log_type, message, severity,
  acknowledged, acknowledged_by, acknowledged_at, resolved, parameter,
  reading_timestamp, resolved_by, resolved_at
)
SELECT log_id, pond_id, project_id, pond_name, COALESCE("timestamp", now()),
       log_type, message, severity, COALESCE(acknowledged, false), acknowledged_by,
       acknowledged_at, COALESCE(resolved, false), parameter, reading_timestamp,
       resolved_by, resolved_at
FROM stg_alert_log
ON CONFLICT DO NOTHING;

COMMIT;

select *
from (
  values
    ('notification.alert_log', (select count(*)::bigint from notification.alert_log))
) as counts(table_name, row_count)
order by table_name;
SQL
}

write_ingestion_finalize_sql() {
  cat > "$TMP_DIR/ingestion-finalize.sql" <<'SQL'
\pset pager off
\timing on
SET statement_timeout = 0;

INSERT INTO ingestion.energy_hourly_readings
    (project_id, hour_start, kwh, sample_count, updated_at)
SELECT project_id,
       date_trunc('hour', measured_at) AS hour_start,
       sum((reading_values ->> 'electricity')::double precision) AS kwh,
       count(reading_values ->> 'electricity') AS sample_count,
       now()
FROM ingestion.sensor_readings
WHERE jsonb_exists(reading_values, 'electricity')
GROUP BY project_id, date_trunc('hour', measured_at)
ON CONFLICT (project_id, hour_start) DO UPDATE
SET kwh = EXCLUDED.kwh,
    sample_count = EXCLUDED.sample_count,
    updated_at = EXCLUDED.updated_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'ingestion.sensor_readings'::regclass
      AND conname = 'sensor_readings_pkey'
  ) THEN
    ALTER TABLE ingestion.sensor_readings
      ADD CONSTRAINT sensor_readings_pkey PRIMARY KEY (reading_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'ingestion.sensor_readings'::regclass
      AND conname = 'sensor_readings_sensor_message_id_fkey'
  ) THEN
    ALTER TABLE ingestion.sensor_readings
      ADD CONSTRAINT sensor_readings_sensor_message_id_fkey
      FOREIGN KEY (sensor_message_id)
      REFERENCES ingestion.sensor_messages (sensor_message_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE ingestion.sensor_readings
  VALIDATE CONSTRAINT sensor_readings_sensor_message_id_fkey;

CREATE INDEX IF NOT EXISTS ix_readings_pond_time
    ON ingestion.sensor_readings (pond_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS ix_readings_project_time
    ON ingestion.sensor_readings (project_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS ix_readings_project_pond_time
    ON ingestion.sensor_readings (project_id, pond_id, measured_at DESC);

ANALYZE ingestion.sensor_messages;
ANALYZE ingestion.sensor_readings;
ANALYZE ingestion.energy_hourly_readings;

select *
from (
  values
    ('ingestion.sensor_messages', (select count(*)::bigint from ingestion.sensor_messages)),
    ('ingestion.sensor_readings', (select count(*)::bigint from ingestion.sensor_readings)),
    ('ingestion.energy_hourly_readings', (select count(*)::bigint from ingestion.energy_hourly_readings))
) as counts(table_name, row_count)
order by table_name;
SQL
}

export_business_data() {
  say "export monolith business/reference data from $SRC_DB"
  export_csv profile_types "select profile_type_id, name, code, description, stage_config, key_parameter_indicators, key_growth_indicators, theme, created_at, created_by, updated_at, updated_by from public.profile_types"
  export_csv parameter_types "select parameter_id, parameter_name, parameter_code, unit, data_type from public.parameter_types"
  export_csv visualisation_types "select visualisation_type_id, name, description, required_parameters, chart_type from public.visualisation_types"
  export_csv users "select user_id, email, password_hash, first_name, last_name, mobile_number, role, feature_action_assigned, is_active, created_at, updated_at from public.users"
  export_csv projects "select project_id, project_owner_id, profile_type_id, name, description, created_at, created_by, updated_at, updated_by from public.projects"
  "$SRC_PSQL" -X -d "$SRC_DB" -v ON_ERROR_STOP=1 -c \
    "\\copy (select project_id from public.projects) TO '$TMP_DIR/projects_for_identity.csv' WITH (FORMAT csv, HEADER true)"
  export_csv user_projects "select user_project_id, user_id, project_id, assigned_at, assigned_by from public.user_projects"
  export_csv project_parameter_settings "select project_parameter_setting_id, project_id, parameter_id, min_threshold, max_threshold, is_key_parameter from public.project_parameter_settings"
  export_csv project_energy_settings "select project_energy_setting_id, project_id, type, unit, tariff_per_unit, currency, high_hourly_threshold, high_daily_threshold, notes, created_at, created_by, updated_at, updated_by from public.project_energy_settings"
  export_csv project_visualisations "select project_visualisation_id, project_id, visualisation_type_id, enabled, flag, x_parameters, y_parameters, title from public.project_visualisations"
  export_csv ponds "select pond_id, project_id, name, description, metadata, status, photo_url, created_at, updated_at from public.ponds"
  export_csv cycles "select cycle_id, pond_id, start_date, end_date, status, created_at, updated_at, created_by, updated_by, stocking_biomass_kg, harvest_biomass_kg from public.cycles"
  export_csv cycle_daily_health "select health_id, cycle_id, day_number, date, health_status, alert_count, created_at, updated_at, created_by, updated_by from public.cycle_daily_health"
  export_csv cycle_stage_metrics "select metric_id, cycle_id, stage_name, metrics, calculated_at, created_at, updated_at, created_by, updated_by from public.cycle_stage_metrics"
  export_csv feed_types "select feed_type_id, project_id, name, pack_kg, pack_price, currency, active, created_at, created_by, updated_at, updated_by from public.feed_types"
  export_csv feed_logs "select feed_log_id, pond_id, feed_type_id, fed_on, fed_time, amount_kg, pack_kg, pack_price, created_at, created_by, updated_at, updated_by from public.feed_logs"
  export_csv treatments "select treatment_id, project_id, code, name, description, target_parameters, unit_price, price_unit, is_active, created_at, updated_at from public.treatments"
  export_csv pond_treatments "select pond_treatment_id, pond_id, treatment_id, started_at, ended_at, notes, amount, unit, unit_price, price_unit, created_at, created_by, updated_at, updated_by from public.pond_treatments"
  export_csv iot_devices "select iot_device_id, device_code, device_name, status, config, is_active, device_key, created_at, created_by, updated_at, updated_by from public.iot_devices"
  export_csv project_sensors "select project_sensor_id, project_id, pond_id, sensor_type_id, iot_device_id, port, serial_number, status, installed_at, sensor_location, created_at, created_by, updated_at, updated_by from public.project_sensors"
  export_csv alert_log "select al.log_id, al.pond_id, al.project_id, p.name as pond_name, al.timestamp, al.log_type, al.message, al.severity, al.acknowledged, al.acknowledged_by, al.acknowledged_at, al.resolved, al.parameter, al.reading_timestamp, al.resolved_by, al.resolved_at from public.alert_log al left join public.ponds p on p.pond_id = al.pond_id"
}

prepare_project_files() {
  make_schema_dir project
  for file in profile_types parameter_types visualisation_types projects project_parameter_settings project_energy_settings project_visualisations; do
    stage_file project "$file"
  done
  write_project_sql
}

prepare_identity_files() {
  make_schema_dir identity
  for file in users user_projects projects_for_identity; do
    stage_file identity "$file"
  done
  write_identity_sql
}

prepare_pond_files() {
  make_schema_dir pond
  for file in ponds cycles cycle_daily_health cycle_stage_metrics feed_types feed_logs treatments pond_treatments; do
    stage_file pond "$file"
  done
  write_pond_sql
}

prepare_sensor_files() {
  make_schema_dir sensor
  stage_file sensor iot_devices
  stage_file sensor project_sensors
  write_sensor_sql
}

prepare_notification_files() {
  make_schema_dir notification
  stage_file notification alert_log
  write_notification_sql
}

fetch_cloud_project_parameter_map() {
  local pod="$1"
  say "fetch cloud project parameter id map for sensor metadata"
  kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -q -v ON_ERROR_STOP=1 \
    -c "COPY (select parameter_code, parameter_id from project.parameter_types order by parameter_code) TO STDOUT WITH (FORMAT csv, HEADER true)" \
    > "$TMP_DIR/project_parameter_map.csv"
}

export_mapped_sensor_types() {
  say "export monolith sensor types mapped to cloud project parameter ids"
  "$SRC_PSQL" -X -d "$SRC_DB" -v ON_ERROR_STOP=1 <<SQL
CREATE TEMP TABLE cloud_parameter_map (
  parameter_code varchar(100),
  parameter_id uuid
);
\copy cloud_parameter_map FROM '$TMP_DIR/project_parameter_map.csv' WITH (FORMAT csv, HEADER true)
\copy (SELECT st.sensor_type_id, st.name, st.model_number, ARRAY(SELECT m.parameter_id FROM unnest(st.parameter_ids) WITH ORDINALITY u(source_parameter_id, ord) JOIN public.parameter_types sp ON sp.parameter_id = u.source_parameter_id JOIN cloud_parameter_map m ON m.parameter_code = sp.parameter_code ORDER BY u.ord) AS parameter_ids, st.manufacturer, st.description, st.is_active, st.created_at, st.updated_at FROM public.sensor_types st) TO '$TMP_DIR/sensor/sensor_types.csv' WITH (FORMAT csv, HEADER true)
SQL
}

stream_ingestion_tables() {
  local pod="$1"
  local source_messages
  local source_readings
  local target_messages
  local target_readings

  source_messages="$(local_target_scalar "select count(*) from ingestion.sensor_messages")"
  source_readings="$(local_target_scalar "select count(*) from ingestion.sensor_readings")"
  target_messages="$(cloud_scalar "$pod" "select count(*) from ingestion.sensor_messages")"

  say "replace cloud ingestion history with local 4M source"
  if [[ "$target_messages" == "$source_messages" ]]; then
    say "skip ingestion.sensor_messages; cloud already has $target_messages rows"
    if [[ "$RESUME_READINGS" == "yes" ]]; then
      say "resume ingestion.sensor_readings; keep existing reading chunks"
      kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -v ON_ERROR_STOP=1 \
        -c "SET statement_timeout = 0" \
        -c "TRUNCATE ingestion.energy_hourly_readings" >/dev/null
    else
      kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -v ON_ERROR_STOP=1 \
        -c "SET statement_timeout = 0" \
        -c "TRUNCATE ingestion.energy_hourly_readings, ingestion.sensor_readings" >/dev/null
    fi
  else
    kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -v ON_ERROR_STOP=1 \
      -c "SET statement_timeout = 0" \
      -c "TRUNCATE ingestion.energy_hourly_readings, ingestion.sensor_readings, ingestion.sensor_messages" >/dev/null

    say "stream ingestion.sensor_messages ($source_messages rows)"
    PGPASSWORD="$LOCAL_TARGET_DB_PASSWORD" "$TARGET_PSQL" -X -q \
      -h "$LOCAL_TARGET_DB_HOST" -p "$LOCAL_TARGET_DB_PORT" -U "$LOCAL_TARGET_DB_USER" -d "$LOCAL_TARGET_DB_NAME" \
      -c "COPY (select sensor_message_id, iot_device_id, device_code, seq_no, payload, received_at from ingestion.sensor_messages) TO STDOUT WITH (FORMAT csv, HEADER true)" \
      | kubectl exec -i -n "$NAMESPACE" "$pod" -- psql -X -q -v ON_ERROR_STOP=1 \
          -c "SET statement_timeout = 0" \
          -c "\copy ingestion.sensor_messages (sensor_message_id, iot_device_id, device_code, seq_no, payload, received_at) FROM STDIN WITH (FORMAT csv, HEADER true)"
  fi

  say "drop readings constraints/indexes for bulk load"
  kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -q -v ON_ERROR_STOP=1 \
    -c "ALTER TABLE ingestion.sensor_readings DROP CONSTRAINT IF EXISTS sensor_readings_sensor_message_id_fkey" \
    -c "ALTER TABLE ingestion.sensor_readings DROP CONSTRAINT IF EXISTS sensor_readings_pkey" \
    -c "DROP INDEX IF EXISTS ingestion.ix_readings_pond_time" \
    -c "DROP INDEX IF EXISTS ingestion.ix_readings_project_time" \
    -c "DROP INDEX IF EXISTS ingestion.ix_readings_project_pond_time" >/dev/null

  say "build project/time chunks for ingestion.sensor_readings ($source_readings rows)"
  PGPASSWORD="$LOCAL_TARGET_DB_PASSWORD" "$TARGET_PSQL" -X -q -A -t -F $'\t' \
    -h "$LOCAL_TARGET_DB_HOST" -p "$LOCAL_TARGET_DB_PORT" -U "$LOCAL_TARGET_DB_USER" -d "$LOCAL_TARGET_DB_NAME" \
    -c "
      WITH bounds AS (
        SELECT project_id, min(measured_at) AS min_at, max(measured_at) AS max_at
        FROM ingestion.sensor_readings
        GROUP BY project_id
      ),
      chunks AS (
        SELECT
          b.project_id,
          gs AS chunk_start,
          gs + interval '$READING_CHUNK_DAYS days' AS chunk_end
        FROM bounds b
        CROSS JOIN LATERAL generate_series(
          date_trunc('day', b.min_at),
          date_trunc('day', b.max_at),
          interval '$READING_CHUNK_DAYS days'
        ) AS gs
      )
      SELECT c.project_id, c.chunk_start, c.chunk_end, count(r.reading_id)
      FROM chunks c
      JOIN ingestion.sensor_readings r
        ON r.project_id = c.project_id
       AND r.measured_at >= c.chunk_start
       AND r.measured_at < c.chunk_end
      GROUP BY c.project_id, c.chunk_start, c.chunk_end
      ORDER BY c.chunk_start, c.project_id
    " > "$TMP_DIR/reading_chunks.tsv"

  local total_chunks
  local chunk_no=0
  total_chunks="$(wc -l < "$TMP_DIR/reading_chunks.tsv" | tr -d '[:space:]')"

  while IFS=$'\t' read -r project_id chunk_start chunk_end row_count; do
    chunk_no=$((chunk_no + 1))
    say "stream ingestion.sensor_readings chunk $chunk_no/$total_chunks ($row_count rows)"

    if [[ "$RESUME_READINGS" == "yes" ]]; then
      local existing_count
      existing_count="$(cloud_scalar "$pod" "select count(*) from ingestion.sensor_readings where project_id = '$project_id'::uuid and measured_at >= '$chunk_start'::timestamptz and measured_at < '$chunk_end'::timestamptz")"
      if [[ "$existing_count" == "$row_count" ]]; then
        say "skip ingestion.sensor_readings chunk $chunk_no/$total_chunks; cloud already has $existing_count rows"
        continue
      fi
    fi

    local attempt=1
    while (( attempt <= READING_CHUNK_RETRIES )); do
      local chunk_file="$TMP_DIR/readings-chunk-$chunk_no.csv.gz"
      rm -f "$chunk_file"

      kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -q -v ON_ERROR_STOP=1 \
        -c "SET statement_timeout = 0" \
        -c "DELETE FROM ingestion.sensor_readings WHERE project_id = '$project_id'::uuid AND measured_at >= '$chunk_start'::timestamptz AND measured_at < '$chunk_end'::timestamptz" >/dev/null

      set +e
      PGPASSWORD="$LOCAL_TARGET_DB_PASSWORD" "$TARGET_PSQL" -X -q \
        -h "$LOCAL_TARGET_DB_HOST" -p "$LOCAL_TARGET_DB_PORT" -U "$LOCAL_TARGET_DB_USER" -d "$LOCAL_TARGET_DB_NAME" \
        -c "COPY (select reading_id, sensor_message_id, project_id, pond_id, project_sensor_id, port, measured_at, reading_values, created_at from ingestion.sensor_readings where project_id = '$project_id'::uuid and measured_at >= '$chunk_start'::timestamptz and measured_at < '$chunk_end'::timestamptz order by measured_at, reading_id) TO STDOUT WITH (FORMAT csv, HEADER true)" \
        | gzip -1 > "$chunk_file"
      local status=$?
      if [[ "$status" -eq 0 ]]; then
        kubectl cp "$chunk_file" "$NAMESPACE/$pod:/work/readings-chunk.csv.gz" >/dev/null
        status=$?
      fi
      if [[ "$status" -eq 0 ]]; then
        kubectl exec -n "$NAMESPACE" "$pod" -- sh -c "gzip -dc /work/readings-chunk.csv.gz | psql -X -q -v ON_ERROR_STOP=1 -c 'SET statement_timeout = 0' -c '\\copy ingestion.sensor_readings (reading_id, sensor_message_id, project_id, pond_id, project_sensor_id, port, measured_at, reading_values, created_at) FROM STDIN WITH (FORMAT csv, HEADER true)'"
        status=$?
      fi
      kubectl exec -n "$NAMESPACE" "$pod" -- rm -f /work/readings-chunk.csv.gz >/dev/null 2>&1 || true
      rm -f "$chunk_file"
      set -e

      if [[ "$status" -eq 0 ]]; then
        break
      fi

      if (( attempt == READING_CHUNK_RETRIES )); then
        echo "Failed to stream readings chunk $chunk_no/$total_chunks after $READING_CHUNK_RETRIES attempts" >&2
        exit "$status"
      fi

      say "retry ingestion.sensor_readings chunk $chunk_no/$total_chunks after stream failure"
      attempt=$((attempt + 1))
      sleep 5
    done
  done < "$TMP_DIR/reading_chunks.tsv"

  target_readings="$(cloud_scalar "$pod" "select count(*) from ingestion.sensor_readings")"
  if [[ "$target_readings" != "$source_readings" ]]; then
    echo "Expected $source_readings ingestion.sensor_readings rows, found $target_readings" >&2
    exit 1
  fi

  write_ingestion_finalize_sql
  kubectl cp "$TMP_DIR/ingestion-finalize.sql" "$NAMESPACE/$pod:/work/ingestion-finalize.sql" >/dev/null
  kubectl exec -n "$NAMESPACE" "$pod" -- psql -X -v ON_ERROR_STOP=1 -f /work/ingestion-finalize.sql
}

say "prepare export workspace: $TMP_DIR"
export_business_data

prepare_project_files
create_client_pod aq-import-project project_svc PROJECT_DB_PASSWORD
say "import project schema"
run_schema_import project aq-import-project
fetch_cloud_project_parameter_map aq-import-project

prepare_identity_files
create_client_pod aq-import-identity identity_access_svc IDENTITY_ACCESS_DB_PASSWORD
say "import identity_access schema"
run_schema_import identity aq-import-identity

prepare_pond_files
create_client_pod aq-import-pond pond_svc POND_DB_PASSWORD
say "import pond schema"
run_schema_import pond aq-import-pond

prepare_sensor_files
export_mapped_sensor_types
create_client_pod aq-import-sensor sensor_svc SENSOR_DB_PASSWORD
say "import sensor schema"
run_schema_import sensor aq-import-sensor

prepare_notification_files
create_client_pod aq-import-notification notification_svc NOTIFICATION_DB_PASSWORD
say "import notification schema"
run_schema_import notification aq-import-notification

if [[ "$IMPORT_CLOUD_SQL_TELEMETRY" == "yes" ]]; then
  create_client_pod aq-import-ingestion ingestion_svc INGESTION_DB_PASSWORD
  kubectl exec -n "$NAMESPACE" aq-import-ingestion -- mkdir -p /work >/dev/null
  stream_ingestion_tables aq-import-ingestion
else
  say "skip Cloud SQL telemetry import; 4M evidence belongs in Bigtable/BigQuery"
fi

say "DONE"
