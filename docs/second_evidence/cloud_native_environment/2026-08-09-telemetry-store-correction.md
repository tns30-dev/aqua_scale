# Telemetry Store Correction

Date: 2026-08-09

## Decision

The 4M telemetry dataset is not Cloud SQL business data.

| Store | Usage in second-round evidence |
|---|---|
| Cloud SQL PostgreSQL | Transactional service data: users, projects, ponds, cycles, feed, treatments, sensor catalogue, alerts, audit |
| Cloud Bigtable | Operational telemetry/time-series store for high-volume raw and parsed sensor telemetry |
| BigQuery | Historical analytics warehouse for bounded reporting, performance evidence queries, and future ML/reporting facts |

## Cloud SQL Cleanup

Cloud SQL telemetry/demo tables were cleared after an aborted attempt to load the
4M local dataset into the Postgres ingestion demo seam.

Only the telemetry tables in the `ingestion` schema were cleared:

```sql
TRUNCATE ingestion.energy_hourly_readings,
         ingestion.sensor_readings,
         ingestion.sensor_messages;
```

Verified Cloud SQL counts after cleanup:

| Table | Row count |
|---|---:|
| `ingestion.energy_hourly_readings` | 0 |
| `ingestion.sensor_messages` | 0 |
| `ingestion.sensor_readings` | 0 |

The business/service tables remain populated from the monolith reference data.

## Managed Telemetry Evidence Stores

The cloud-native telemetry evidence should be verified in these managed stores:

| Store | Resource |
|---|---|
| Cloud Bigtable instance | `aquashield-dev-telemetry` |
| Cloud Bigtable table | `telemetry_readings` |
| BigQuery dataset | `aquashield_dev_analytics` |
| BigQuery readings table | `aquashield_dev_analytics.readings` |
| BigQuery full parameter facts table | `aquashield_dev_analytics.readings_full_20260809` |
| BigQuery alerts table | `aquashield_dev_analytics.alerts` |

Current managed-store verification:

| Check | Result |
|---|---|
| Bigtable instance state | `READY` |
| Bigtable telemetry table | `telemetry_readings` exists |
| BigQuery tables | `readings` and `alerts` exist |
| Bigtable telemetry load | `4,000,000` readings loaded through the loader; `15,994,302` Bigtable row mutations written |
| BigQuery telemetry load | `readings = 4,000,000` |
| BigQuery full parameter facts load | `readings_full_20260809 = 44,171,644` facts from `4,000,000` source readings across `23` parameters |
| BigQuery telemetry range | `2025-12-03 06:00:00` to `2026-08-07 13:45:47` |
| BigQuery partition retention | `365` days, so the full local reference telemetry range is retained |
| Bigtable GC policy | `raw`, `parsed`, and `meta` keep `max_version = 1` |
| Terraform drift check | `No changes` after applying the managed-data update |

## Deployed App Read Path

The cloud ingestion service is configured to read operational telemetry from
Bigtable:

| Runtime setting | Value |
|---|---|
| `TELEMETRY_STORE` | `bigtable` |
| `BIGTABLE_PROJECT_ID` | `aquashield-ms-dev-20260808` |
| `BIGTABLE_INSTANCE_ID` | `aquashield-dev-telemetry` |
| `BIGTABLE_TABLE_NAME` | `telemetry_readings` |
| `BIGTABLE_WRITE_ENABLED` | `true` |
| `BIGQUERY_READINGS_TABLE` | `readings_full_20260809` |

Deployed image after the Bigtable latest-row fix:

| Service | Image |
|---|---|
| `ingestion-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/ingestion-service/ingestion-service:20260809-0131-bigtable-latest` |

Validation was run through a temporary port-forward to the deployed gRPC service:

| gRPC method | Result |
|---|---|
| `GetReadings` | Returned pond readings for `2026-08-07`, including `temperature`, `ph`, `dissolved_oxygen`, and `ammonia` |
| `GetLatestReadings` | Returned latest readings for two ponds at `2026-08-07T13:45:47.421522Z` |
| `GetEnergyHourlyReadings` | Returned project hourly kWh buckets for `2026-08-07` |

`GetLatestReadings` initially failed because the `latest#...` Bigtable rows had
many cell versions from the bulk load. The service now applies a
`cellsPerColumn(1)` Bigtable filter on latest-row reads, so it fetches only the
newest cell version and avoids the Bigtable row-size limit. Terraform now also
sets a `max_version = 1` GC policy on all three telemetry column families.

## Script Guard

`scripts/import-cloud-presentation-data.sh` now skips Cloud SQL telemetry import by
default. It imports business presentation data only unless this compatibility
override is explicitly set:

```bash
IMPORT_CLOUD_SQL_TELEMETRY=yes ALLOW_CLOUD_PRESENTATION_IMPORT=yes ./scripts/import-cloud-presentation-data.sh
```

Do not use that override for the final cloud-native evidence. The 4M telemetry
load now lives in Bigtable/BigQuery.

## Google Console Verification

Use Google Cloud Console to verify:

| Area | What to open |
|---|---|
| Cloud SQL | `aquashield-dev-postgres` -> query the three `ingestion` telemetry tables and confirm `0` rows |
| Bigtable | `aquashield-dev-telemetry` -> table `telemetry_readings` |
| BigQuery | dataset `aquashield_dev_analytics` -> tables `readings` and `alerts` |

Expected BigQuery check:

```sql
SELECT COUNT(*) AS readings_count,
       MIN(event_ts) AS first_event,
       MAX(event_ts) AS last_event
FROM `aquashield-ms-dev-20260808.aquashield_dev_analytics.readings`;
```

Expected result:

| readings_count | first_event | last_event |
|---:|---|---|
| `4,000,000` | `2025-12-03 06:00:00` | `2026-08-07 13:45:47` |
