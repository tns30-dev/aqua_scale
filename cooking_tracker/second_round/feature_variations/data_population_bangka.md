# Data Population And BangKa Demo Seeds

## Source Feature

The updated monolith added a real-first data population plan and seed assets based on
BangKa workbooks. It fills demo readings, electricity, treatments, and feeding data for
more convincing dashboards.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/data_population/overall.md`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/data_population/scripts/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/data_population/sample_data/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/data_population/sample_script/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/data_population/insight/insights.md`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/test_load_sql/`

## Target Ownership

- `scripts/`: microservice-safe seed orchestration.
- `ingestion-service`: telemetry write path or direct local seed path.
- `pond-service`: feed/treatment seed data once schema exists.
- `project-service`: project/profile/energy setting seeds.
- `sensor-service`: devices and mappings.

## Current Target Gap

The microservice target has `scripts/seed-demo.sh`, but it is first-round demo data.
It does not include BangKa workbook-derived data, feeding logs, treatment dose data, or
large-scale load-test SQL.

## Microservice Translation Notes

- Preserve the source principle: measured/replayed real data beats generated data.
- Do not bypass service ownership in cloud runtime. For local demo, direct SQL can be
  acceptable if clearly labelled and idempotent.
- Large load-test data must never run against normal dev/prod databases.
- The target translation uses gateway APIs for project, pond, device, and mapping setup,
  then a guarded local SQL payload for the large historical seed. This is explicitly
  local-demo only and requires `ALLOW_LOCAL_SQL_SEED=yes`.
- The monolith's wide `sensor_readings` SQL was translated to the target ingestion
  JSONB shape: one `ingestion.sensor_messages` row per reading row and one
  `ingestion.sensor_readings.reading_values` object per hour/pond.
- Direct reading inserts bypass the threshold consumer, so the local seed also creates
  sentinel alert-log occurrences for notification and daily-health demos.

## Target Files Changed

- `scripts/seed-bangka-demo.sh`
- `scripts/sql/seed-bangka-demo-local.sql`
- `scripts/inspect-local-reference-db.sh`
- `scripts/import-local-reference-db.sh`

## Sync Plan

1. Done: inventoried BangKa workbook-derived source docs/scripts and the final generated
   Demo Shrimp Farm decision record.
2. Done: mapped source `public` tables to `project`, `pond`, `sensor`, `ingestion`, and
   `notification` schemas.
3. Done: added guarded second-round local seed scripts.
4. Done in script: SQL prints pond/cycle/feed/treatment/reading/message/alert counts plus
   monthly reading coverage; runner also verifies key gateway dashboards.
5. Done: no load-test volume generation is included in this normal demo seed.

## Verification

- `bash -n scripts/seed-bangka-demo.sh`
- `bash -n scripts/inspect-local-reference-db.sh`
- `bash -n scripts/import-local-reference-db.sh`
- `scripts/inspect-local-reference-db.sh` ran against local `aquaculture` in read-only
  mode and reproduced the reference counts/coverage before rolling back.
- `ALLOW_LOCAL_REFERENCE_IMPORT=yes ./scripts/import-local-reference-db.sh` imported the
  local `aquaculture` reference dataset into the local microservice target DB. Target
  counts after import: 5 projects, 20 ponds, 40,507 ingestion readings, 41,217 ingestion
  messages, 3,831 feed logs, 273 pond treatments, 172 alerts, and 1,368 daily-health rows.
- `psql --version`
- `docker ps --format '{{.Names}}'` failed because Docker is not running locally, so the
  SQL seed was not executed against a live Postgres container in this pass.
- `shellcheck scripts/seed-bangka-demo.sh` could not run because `shellcheck` is not
  installed.
- 2026-08-07 local DB inspection: `aquaculture` on local Postgres `5432` already contains
  second-round demo data. Counts observed: 5 projects, 20 ponds, 40,507 sensor readings,
  41,217 sensor messages, 3,831 feed logs, 273 pond treatments, 172 alerts, and 1,368
  daily-health rows.
- `Demo Shrimp Farm` exists with Pond A-E. Each shrimp pond has readings from
  `2026-01-01` through `2026-08-01`, plus feed logs, treatments, alerts, and daily-health
  rows. This means local inspection can query existing Postgres data; do not run the
  BangKa seed just to discover the dataset.
- Detailed local reference evidence is recorded in
  [Local Postgres reference dataset](../local_postgres_reference.md).

## Status

Implemented: first local demo seed slice synced. Existing source/local Postgres data is
available for inspection. Only run the target seed later when a fresh microservice
database needs to be populated.
