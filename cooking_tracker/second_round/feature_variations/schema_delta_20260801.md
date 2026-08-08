# Second-Round Schema Delta

## Source Feature

The updated monolith added an August 2026 schema delta covering feeding,
treatments, energy alerts, timestamp hardening, and index cleanup.

Primary source:

`/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/sql/aquashield_schema_20260801_update.sql`

## Source Changes

- `cycles`: add `stocking_biomass_kg`, `harvest_biomass_kg`.
- New `feed_types` table.
- New `feed_logs` table with optional `fed_time`.
- `treatments`: add `project_id`, `target_parameters`, `unit_price`, `price_unit`; replace global uniqueness with per-project uniqueness.
- `pond_treatments`: add dose and price snapshot fields: `amount`, `unit`, `unit_price`, `price_unit`.
- `visualisation_types`: unique index on `name`.
- `alert_log`: convert timestamps to `timestamptz`.
- `project_sensors`: drop unused `serial`.
- Drop unused write-heavy indexes on `sensor_messages` and `sensor_readings`.
- `cycle_stage_metrics`: add unique index on `(cycle_id, stage_name)`.
- Convert remaining audit timestamps to `timestamptz`.

## Target Ownership

- `pond-service`: cycles biomass, feed tables, treatment schema, stage metric uniqueness.
- `project-service`: visualisation name uniqueness if still Project-owned.
- `sensor-service`: `project_sensors` serial cleanup.
- `ingestion-service`: write-heavy index cleanup and project-scoped energy readings.
- `notification-service`: alert timestamp and lifecycle compatibility.

## Current Target State

The microservice target already uses `timestamptz` in many service migrations and has
first-round pond/treatment parity, but it still models treatments as a global catalogue
and has no feed tables. Cycle biomass is not present in `pond-service` schema.

## Sync Plan

1. Compare every source DDL change against the service-owned Flyway migrations.
2. Add new service migrations rather than editing first-round `V1__init.sql` unless this
   remains a private branch with no deployed data to preserve.
3. Keep schema ownership separated; do not recreate monolith `public` schema coupling.
4. Add repository/entity tests for new constraints and timestamp behavior.
5. Update local seed scripts and `docker-compose` bootstrap paths after migrations pass.

## Status

Partial. On 2026-08-06 the pond-side feeding and treatment foundations were synced:

- `cycles.stocking_biomass_kg`
- `cycles.harvest_biomass_kg`
- `feed_types`
- `feed_logs`
- `cycle_stage_metrics` unique index on `(cycle_id, stage_name)`
- `treatments.project_id`
- `treatments.target_parameters`
- `treatments.unit_price`
- `treatments.price_unit`
- project-scoped treatment uniqueness for new rows, with legacy global rows preserved
- `pond_treatments.amount`
- `pond_treatments.unit`
- `pond_treatments.unit_price`
- `pond_treatments.price_unit`

Remaining schema deltas are still pending for project visualisation uniqueness, sensor
cleanup, ingestion index/energy behavior, and notification timestamp lifecycle
compatibility.
