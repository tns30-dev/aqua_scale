# Local Postgres Reference Dataset

## Purpose

The local Postgres `aquaculture` database is the current read-only reference dataset for
second-round feature verification. It already contains the monolith/public-schema data
that the updated application uses for dashboards, alerts, feeding, treatments, cycles,
and health calculations.

Do not run the BangKa seed only to discover this data. Use local read-only queries first.
Run the target microservice seed later only when a fresh microservice Postgres instance
needs to be populated.

## Connection Notes

- Reference database: `aquaculture`
- Local Postgres endpoint observed: local socket / port `5432`
- Compose target database check: `localhost:5433/aquashield` refused connection during
  inspection, so the microservice Compose Postgres was not running at that time.
- Treat the reference database as read-only. Do not modify users, passwords, project
  ownership, or source history tables from the sync workflow.

Useful read-only pattern:

```sh
psql -d aquaculture -c "select count(*) from public.projects;"
```

Reusable repo helper:

```sh
scripts/inspect-local-reference-db.sh
```

Reusable local target importer:

```sh
ALLOW_LOCAL_REFERENCE_IMPORT=yes ./scripts/import-local-reference-db.sh
```

The importer reads the source `aquaculture` database and writes to the local Docker
Compose target database only. It maps monolith `public` rows into service-owned target
schemas and converts wide `sensor_readings` columns into ingestion JSONB
`reading_values`.

## Observed Row Counts

Inspection date: `2026-08-07`

| Table | Count |
|---|---:|
| `projects` | 5 |
| `ponds` | 20 |
| `users` | 4 |
| `profile_types` | 6 |
| `cycles` | 36 |
| `cycle_daily_health` | 1368 |
| `cycle_stage_metrics` | 0 |
| `feed_types` | 27 |
| `feed_logs` | 3831 |
| `treatments` | 28 |
| `pond_treatments` | 273 |
| `sensor_types` | 2 |
| `iot_devices` | 2 |
| `project_sensors` | 18 |
| `sensor_readings` | 40507 |
| `sensor_messages` | 41217 |
| `alert_log` | 172 |
| `project_energy_settings` | 1 |
| `project_parameter_settings` | 45 |
| `project_visualisations` | 14 |

## Reference Projects

| Project | Project ID |
|---|---|
| Demo Shrimp Farm | `3fabfb66-f6d0-4aa8-a7b5-95b5c757cc78` |
| Demo Fish Farm | `65edce67-ed84-4396-acc6-0083763c1665` |
| Demo Crab Hatchery | `5f80aefc-ffd4-480c-bbb7-33d094d79f9a` |
| Demo Octopus Farm | `26cf396d-f995-4b2b-a9c7-883c5ddc3b21` |
| Demo Frog Farm | `59acc28a-9bb9-4d58-be4e-1a2bb7db734d` |

## Demo Shrimp Farm Coverage

Project ID: `3fabfb66-f6d0-4aa8-a7b5-95b5c757cc78`

| Pond | Pond ID | Readings | Reading Window | Feed Logs | Treatments | Alerts | Daily Health Rows |
|---|---|---:|---|---:|---:|---:|---:|
| Pond A | `3ae969d4-8a81-4e03-94d0-4140c4f1f9a9` | 5854 | `2026-01-01` to `2026-08-01` | 187 | 30 | 5 | 85 |
| Pond B | `625cd72f-053f-4a20-9fd7-71c109e5b89b` | 5854 | `2026-01-01` to `2026-08-01` | 185 | 30 | 11 | 84 |
| Pond C | `2d51d9a2-3b47-4174-aae1-0c51d7c3ed20` | 5013 | `2026-01-01` to `2026-08-01` | 184 | 29 | 6 | 83 |
| Pond D | `ee36bca3-194c-439f-bb41-f2491d3b0781` | 5013 | `2026-01-01` to `2026-08-01` | 183 | 29 | 3 | 82 |
| Pond E | `a5143a00-950c-41e2-9f1a-4fc7e375c5b1` | 5013 | `2026-01-01` to `2026-08-01` | 182 | 29 | 2 | 81 |

Each shrimp pond has one completed cycle from January to April 2026 and one ongoing
cycle from May 2026. The completed-cycle harvest biomass values increase by pond:
`3800`, `4020`, `4240`, `4460`, and `4680`.

## Monthly Reading Coverage

For Demo Shrimp Farm:

| Month | Readings | Electricity | Ammonia Family | Nitrite |
|---|---:|---:|---:|---:|
| 2025-12 | 667 | 667 | 0 | 0 |
| 2026-01 | 4444 | 4444 | 3720 | 3720 |
| 2026-02 | 4013 | 4013 | 3360 | 3360 |
| 2026-03 | 4441 | 4441 | 3720 | 3720 |
| 2026-04 | 4298 | 4298 | 3600 | 3600 |
| 2026-05 | 4437 | 4437 | 3720 | 3720 |
| 2026-06 | 4376 | 4376 | 3760 | 3760 |
| 2026-07 | 4828 | 4828 | 4828 | 4828 |
| 2026-08 | 34 | 34 | 34 | 34 |

## Project-Level Coverage

| Project | Ponds | Cycles | Feed Logs | Pond Treatments | Alerts | Daily Health Rows |
|---|---:|---:|---:|---:|---:|---:|
| Demo Crab Hatchery | 5 | 10 | 1295 | 50 | 34 | 325 |
| Demo Fish Farm | 6 | 12 | 1380 | 60 | 23 | 390 |
| Demo Frog Farm | 3 | 3 | 171 | 12 | 0 | 173 |
| Demo Octopus Farm | 1 | 1 | 64 | 4 | 0 | 65 |
| Demo Shrimp Farm | 5 | 10 | 921 | 147 | 115 | 415 |

## Sensors And Users

Observed sensor/device shape:

| Sensor Type | Parameter IDs | Project Sensor Mappings |
|---|---|---:|
| Energy Meter | `404cdefe-206e-421c-a470-e58413bc46c8` | 1 |
| Multi-Parameter Sensor | `6ba32d55-84cb-4ed9-b4f2-37e039c731ea`, `d73c143b-e258-4210-85f7-47879755473d`, `69c5d1aa-937f-48fe-a720-fe6f0fbf7a80`, `22fc6d76-f678-439b-9a4a-803c1a7e67f9` | 17 |

Observed devices:

| Device ID | Name | Status | Active | Project Sensor Mappings |
|---|---|---|---|---:|
| `EM-CENTRAL-01` | Central Energy Meter Gateway | online | true | 1 |
| `RBP-1000` | IoT Device 1 | online | true | 17 |

Observed project access:

| User | Role | Projects |
|---|---|---|
| `demo@aquaculture.com` | platform_admin | Demo Crab Hatchery, Demo Fish Farm, Demo Shrimp Farm |
| `newfarmer@test.com` | user | Demo Fish Farm, Demo Octopus Farm, Demo Shrimp Farm |
| `scientistdemo@gmail.com` | user | all 5 demo projects |
| `secondfarmer@gmail.com` | user | Demo Fish Farm |

## Microservice Translation Map

| Reference Public Table | Target Owner |
|---|---|
| `users` | `identity_access.users` |
| `user_projects` | `identity_access.user_projects` |
| `profile_types` | `project.profile_types` |
| `projects` | `project.projects` |
| `project_parameter_settings` | `project.project_parameter_settings` |
| `project_energy_settings` | `project.project_energy_settings` |
| `visualisation_types` | `project.visualisation_types` |
| `project_visualisations` | `project.project_visualisations` |
| `ponds` | `pond.ponds` |
| `cycles` | `pond.cycles` |
| `cycle_daily_health` | `pond.cycle_daily_health` |
| `cycle_stage_metrics` | `pond.cycle_stage_metrics` |
| `feed_types` | `pond.feed_types` |
| `feed_logs` | `pond.feed_logs` |
| `treatments` | `pond.treatments` |
| `pond_treatments` | `pond.pond_treatments` |
| `sensor_types` | `sensor.sensor_types` |
| `iot_devices` | `sensor.iot_devices` |
| `project_sensors` | `sensor.project_sensors` |
| `sensor_messages` | `ingestion.sensor_messages` |
| `sensor_readings` | `ingestion.sensor_readings` |
| `alert_log` | `notification.alert_log` |

Important schema difference: reference `public.sensor_readings` stores readings in wide
columns such as temperature, pH, electricity, ammonia, and nitrite. Target
`ingestion.sensor_readings` stores readings as JSONB `reading_values`, keyed by parameter
code, with raw envelopes in `ingestion.sensor_messages.payload`.

## Usage In Sync Work

- Use this database for read-only comparison, count checks, and expected dashboard
  behavior.
- Use `scripts/inspect-local-reference-db.sh` to reproduce the counts and coverage above.
- Use `scripts/import-local-reference-db.sh` after the local microservice stack is
  running and a fresh/empty target database needs the reference dataset for validation.
- Use the implemented `scripts/seed-bangka-demo.sh` only when the target microservice
  database is empty or intentionally reset.
- Keep source-to-target movement explicit: gateway/API setup for owned entities where
  practical, guarded local SQL only for high-volume demo history.
- Do not treat VM or monolith runtime evidence as final target evidence. The final
  submission still needs microservice runtime validation once Docker/GKE is available.

## Verification

- `bash -n scripts/inspect-local-reference-db.sh`
- `scripts/inspect-local-reference-db.sh`
  - Opened `BEGIN READ ONLY`
  - Printed core counts, project list, Demo Shrimp Farm coverage, monthly reading
    coverage, project feature coverage, sensors/devices, and user access
  - Ended with `ROLLBACK`
- `ALLOW_LOCAL_REFERENCE_IMPORT=yes ./scripts/import-local-reference-db.sh`
  - Imported the reference dataset into local target schemas on `localhost:5433`
  - Target counts after import: 5 projects, 20 ponds, 40,507 ingestion readings, 41,217
    ingestion messages, 3,831 feed logs, 273 pond treatments, 172 alerts, and 1,368
    daily-health rows
  - Added the local bootstrapped admin as an extra user and granted it access to imported
    projects for gateway/browser smoke tests
