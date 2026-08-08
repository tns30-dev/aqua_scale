#!/usr/bin/env bash
# Import the existing monolith/reference Postgres dataset into the local microservice DB.
#
# This is a local-only bridge for second-round validation. It reads from the reference
# public schema and writes to the Docker Compose target schemas. It never modifies the
# source database.
#
# Usage:
#   ALLOW_LOCAL_REFERENCE_IMPORT=yes ./scripts/import-local-reference-db.sh

set -euo pipefail

if [[ "${ALLOW_LOCAL_REFERENCE_IMPORT:-}" != "yes" ]]; then
  cat >&2 <<'EOF'
Refusing to import without ALLOW_LOCAL_REFERENCE_IMPORT=yes.

This script writes to the local microservice target database only. It reads from the
local monolith/reference database and translates public-schema rows into service-owned
schemas for local validation.
EOF
  exit 2
fi

SRC_DB="${SRC_DB:-aquaculture}"
SRC_PSQL="${SRC_PSQL:-psql}"

TARGET_DB_HOST="${TARGET_DB_HOST:-localhost}"
TARGET_DB_PORT="${TARGET_DB_PORT:-5433}"
TARGET_DB_USER="${TARGET_DB_USER:-aquashield}"
TARGET_DB_PASSWORD="${TARGET_DB_PASSWORD:-aquashield_local}"
TARGET_DB_NAME="${TARGET_DB_NAME:-aquashield}"
TARGET_PSQL="${TARGET_PSQL:-psql}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/aquashield-reference-import.XXXXXX")"
cleanup() {
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

say "export reference tables from $SRC_DB"
export_csv profile_types "select profile_type_id, name, code, description, stage_config, key_parameter_indicators, key_growth_indicators, theme, created_at, created_by, updated_at, updated_by from public.profile_types"
export_csv parameter_types "select parameter_id, parameter_name, parameter_code, unit, data_type from public.parameter_types"
export_csv visualisation_types "select visualisation_type_id, name, description, required_parameters, chart_type from public.visualisation_types"
export_csv users "select user_id, email, password_hash, first_name, last_name, mobile_number, role, feature_action_assigned, is_active, created_at, updated_at from public.users"
export_csv projects "select project_id, project_owner_id, profile_type_id, name, description, created_at, created_by, updated_at, updated_by from public.projects"
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
export_csv sensor_types "select sensor_type_id, name, model_number, parameter_ids, manufacturer, description, is_active, created_at, updated_at from public.sensor_types"
export_csv iot_devices "select iot_device_id, device_code, device_name, status, config, is_active, device_key, created_at, created_by, updated_at, updated_by from public.iot_devices"
export_csv project_sensors "select project_sensor_id, project_id, pond_id, sensor_type_id, iot_device_id, port, serial_number, status, installed_at, sensor_location, created_at, created_by, updated_at, updated_by from public.project_sensors"
export_csv sensor_messages "select sm.sensor_message_id, sm.iot_device_id, d.device_code, sm.seq_no, sm.raw_message as payload, sm.received_at from public.sensor_messages sm join public.iot_devices d on d.iot_device_id = sm.iot_device_id"
export_csv sensor_readings "select sr.sensor_reading_id as reading_id, sr.sensor_message_id, coalesce(sr.project_id, ps.project_id) as project_id, coalesce(sr.pond_id, ps.pond_id) as pond_id, sr.project_sensor_id, ps.port, sr.measured_at, jsonb_strip_nulls(jsonb_build_object('temperature', sr.temperature, 'salinity', sr.salinity, 'ph', sr.ph, 'water_level', sr.water_level, 'dissolved_oxygen', sr.dissolved_oxygen, 'turbidity', sr.turbidity, 'electricity', sr.electricity, 'nitrate', sr.nitrate, 'nitrite', sr.nitrite, 'ammonia', sr.ammonia, 'ammonium', sr.ammonium, 'ph_lab', sr.ph_lab, 'carbonate', sr.carbonate, 'bicarbonate', sr.bicarbonate, 'tan', sr.tan, 'alkalinity', sr.alkalinity, 'calcium', sr.calcium, 'magnesium', sr.magnesium, 'phosphate', sr.phosphate, 'total_hardness', sr.total_hardness, 'hydrogen_sulfide', sr.hydrogen_sulfide, 'total_vibrio_count', sr.total_vibrio_count, 'total_bacteria_count', sr.total_bacteria_count)) as reading_values, sr.created_at from public.sensor_readings sr join public.project_sensors ps on ps.project_sensor_id = sr.project_sensor_id"
export_csv alert_log "select al.log_id, al.pond_id, al.project_id, p.name as pond_name, al.timestamp, al.log_type, al.message, al.severity, al.acknowledged, al.acknowledged_by, al.acknowledged_at, al.resolved, al.parameter, al.reading_timestamp, al.resolved_by, al.resolved_at from public.alert_log al left join public.ponds p on p.pond_id = al.pond_id"

say "import into local target $TARGET_DB_HOST:$TARGET_DB_PORT/$TARGET_DB_NAME"
PGPASSWORD="$TARGET_DB_PASSWORD" "$TARGET_PSQL" -X \
  -h "$TARGET_DB_HOST" -p "$TARGET_DB_PORT" -U "$TARGET_DB_USER" -d "$TARGET_DB_NAME" \
  -v ON_ERROR_STOP=1 <<SQL
\pset pager off
\timing off

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
CREATE TEMP TABLE stg_users (
  user_id uuid, email varchar(255), password_hash varchar(255), first_name varchar(120),
  last_name varchar(120), mobile_number varchar(40), role varchar(50),
  feature_action_assigned jsonb, is_active boolean, created_at timestamptz, updated_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE stg_projects (
  project_id uuid, project_owner_id uuid, profile_type_id uuid, name varchar(255),
  description text, created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
) ON COMMIT DROP;
CREATE TEMP TABLE stg_user_projects (
  user_project_id uuid, user_id uuid, project_id uuid, assigned_at timestamptz, assigned_by uuid
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
CREATE TEMP TABLE stg_sensor_messages (
  sensor_message_id uuid, iot_device_id uuid, device_code varchar(64), seq_no bigint,
  payload jsonb, received_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE stg_sensor_readings (
  reading_id uuid, sensor_message_id uuid, project_id uuid, pond_id uuid,
  project_sensor_id uuid, port varchar(32), measured_at timestamptz,
  reading_values jsonb, created_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE stg_alert_log (
  log_id uuid, pond_id uuid, project_id uuid, pond_name varchar(255), "timestamp" timestamptz,
  log_type varchar(50), message text, severity varchar(50), acknowledged boolean,
  acknowledged_by uuid, acknowledged_at timestamptz, resolved boolean, parameter varchar(100),
  reading_timestamp timestamptz, resolved_by uuid, resolved_at timestamptz
) ON COMMIT DROP;

\copy stg_profile_types FROM '$TMP_DIR/profile_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_parameter_types FROM '$TMP_DIR/parameter_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_visualisation_types FROM '$TMP_DIR/visualisation_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_users FROM '$TMP_DIR/users.csv' WITH (FORMAT csv, HEADER true)
\copy stg_projects FROM '$TMP_DIR/projects.csv' WITH (FORMAT csv, HEADER true)
\copy stg_user_projects FROM '$TMP_DIR/user_projects.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_parameter_settings FROM '$TMP_DIR/project_parameter_settings.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_energy_settings FROM '$TMP_DIR/project_energy_settings.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_visualisations FROM '$TMP_DIR/project_visualisations.csv' WITH (FORMAT csv, HEADER true)
\copy stg_ponds FROM '$TMP_DIR/ponds.csv' WITH (FORMAT csv, HEADER true)
\copy stg_cycles FROM '$TMP_DIR/cycles.csv' WITH (FORMAT csv, HEADER true)
\copy stg_cycle_daily_health FROM '$TMP_DIR/cycle_daily_health.csv' WITH (FORMAT csv, HEADER true)
\copy stg_cycle_stage_metrics FROM '$TMP_DIR/cycle_stage_metrics.csv' WITH (FORMAT csv, HEADER true)
\copy stg_feed_types FROM '$TMP_DIR/feed_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_feed_logs FROM '$TMP_DIR/feed_logs.csv' WITH (FORMAT csv, HEADER true)
\copy stg_treatments FROM '$TMP_DIR/treatments.csv' WITH (FORMAT csv, HEADER true)
\copy stg_pond_treatments FROM '$TMP_DIR/pond_treatments.csv' WITH (FORMAT csv, HEADER true)
\copy stg_sensor_types FROM '$TMP_DIR/sensor_types.csv' WITH (FORMAT csv, HEADER true)
\copy stg_iot_devices FROM '$TMP_DIR/iot_devices.csv' WITH (FORMAT csv, HEADER true)
\copy stg_project_sensors FROM '$TMP_DIR/project_sensors.csv' WITH (FORMAT csv, HEADER true)
\copy stg_sensor_messages FROM '$TMP_DIR/sensor_messages.csv' WITH (FORMAT csv, HEADER true)
\copy stg_sensor_readings FROM '$TMP_DIR/sensor_readings.csv' WITH (FORMAT csv, HEADER true)
\copy stg_alert_log FROM '$TMP_DIR/alert_log.csv' WITH (FORMAT csv, HEADER true)

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

INSERT INTO identity_access.user_projects (
  user_project_id, user_id, project_id, assigned_at, assigned_by
)
SELECT user_project_id, user_id, project_id, COALESCE(assigned_at, now()), assigned_by
FROM stg_user_projects
ON CONFLICT (user_id, project_id) DO NOTHING;

INSERT INTO identity_access.user_projects (user_id, project_id, assigned_at, assigned_by)
SELECT admin.user_id, p.project_id, now(), admin.user_id
FROM identity_access.users admin
CROSS JOIN project.projects p
WHERE admin.email = 'admin@aquashield.local'
ON CONFLICT (user_id, project_id) DO NOTHING;

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

INSERT INTO sensor.sensor_types (
  sensor_type_id, name, model_number, parameter_ids, manufacturer, description,
  is_active, created_at, updated_at
)
SELECT
  st.sensor_type_id, st.name, st.model_number,
  ARRAY(
    SELECT tp.parameter_id
    FROM unnest(st.parameter_ids) WITH ORDINALITY u(source_parameter_id, ord)
    JOIN stg_parameter_types sp ON sp.parameter_id = u.source_parameter_id
    JOIN project.parameter_types tp ON tp.parameter_code = sp.parameter_code
    ORDER BY u.ord
  ),
  st.manufacturer, st.description, COALESCE(st.is_active, true),
  COALESCE(st.created_at, now()), COALESCE(st.updated_at, now())
FROM stg_sensor_types st
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

INSERT INTO ingestion.sensor_messages (
  sensor_message_id, iot_device_id, device_code, seq_no, payload, received_at
)
SELECT sensor_message_id, iot_device_id, device_code, seq_no, payload, COALESCE(received_at, now())
FROM stg_sensor_messages
ON CONFLICT (iot_device_id, seq_no) DO UPDATE
SET payload = EXCLUDED.payload,
    received_at = EXCLUDED.received_at;

INSERT INTO ingestion.sensor_readings (
  reading_id, sensor_message_id, project_id, pond_id, project_sensor_id, port,
  measured_at, reading_values, created_at
)
SELECT reading_id, sensor_message_id, project_id, pond_id, project_sensor_id, port,
       measured_at, reading_values, COALESCE(created_at, now())
FROM stg_sensor_readings
ON CONFLICT (reading_id) DO UPDATE
SET sensor_message_id = EXCLUDED.sensor_message_id,
    project_id = EXCLUDED.project_id,
    pond_id = EXCLUDED.pond_id,
    project_sensor_id = EXCLUDED.project_sensor_id,
    port = EXCLUDED.port,
    measured_at = EXCLUDED.measured_at,
    reading_values = EXCLUDED.reading_values,
    created_at = EXCLUDED.created_at;

DO \$\$
BEGIN
  IF to_regclass('ingestion.energy_hourly_readings') IS NOT NULL THEN
    TRUNCATE TABLE ingestion.energy_hourly_readings;

    INSERT INTO ingestion.energy_hourly_readings
        (project_id, hour_start, kwh, sample_count, updated_at)
    SELECT project_id,
           date_trunc('hour', measured_at) AS hour_start,
           sum((reading_values ->> 'electricity')::double precision) AS kwh,
           count(reading_values ->> 'electricity') AS sample_count,
           now()
    FROM ingestion.sensor_readings
    WHERE jsonb_exists(reading_values, 'electricity')
    GROUP BY project_id, date_trunc('hour', measured_at);

    ANALYZE ingestion.energy_hourly_readings;
  END IF;
END \$\$;

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

\echo
\echo '== Imported target counts =='
select *
from (
  values
    ('identity.users', (select count(*)::bigint from identity_access.users)),
    ('identity.user_projects', (select count(*)::bigint from identity_access.user_projects)),
    ('project.projects', (select count(*)::bigint from project.projects)),
    ('project.profile_types', (select count(*)::bigint from project.profile_types)),
    ('pond.ponds', (select count(*)::bigint from pond.ponds)),
    ('pond.cycles', (select count(*)::bigint from pond.cycles)),
    ('pond.cycle_daily_health', (select count(*)::bigint from pond.cycle_daily_health)),
    ('pond.feed_types', (select count(*)::bigint from pond.feed_types)),
    ('pond.feed_logs', (select count(*)::bigint from pond.feed_logs)),
    ('pond.treatments', (select count(*)::bigint from pond.treatments)),
    ('pond.pond_treatments', (select count(*)::bigint from pond.pond_treatments)),
    ('sensor.sensor_types', (select count(*)::bigint from sensor.sensor_types)),
    ('sensor.iot_devices', (select count(*)::bigint from sensor.iot_devices)),
    ('sensor.project_sensors', (select count(*)::bigint from sensor.project_sensors)),
    ('ingestion.sensor_messages', (select count(*)::bigint from ingestion.sensor_messages)),
    ('ingestion.sensor_readings', (select count(*)::bigint from ingestion.sensor_readings)),
    ('notification.alert_log', (select count(*)::bigint from notification.alert_log))
) as counts(table_name, row_count)
order by table_name;
SQL

say "DONE"
