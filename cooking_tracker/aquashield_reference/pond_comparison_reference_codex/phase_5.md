# Phase 5 - Future Architecture Cleanup

## Goal

Record the architecture work that should not block the first working pond comparison feature.

This phase is intentionally future-facing. Do not mix it into phase 1 unless the current implementation becomes impossible without it.

## Split `module_pond`

Current state:

- `Pond`, `Cycle`, `CycleDailyHealth`, and `CycleStageMetric` live in `module_project`.

Desired state:

- `module_project` owns projects and profile-level configuration.
- `module_pond` owns ponds, cycles, daily health, and pond-specific lifecycle state.

Why it matters:

- Pond comparison is pond-domain behavior, not project setup behavior.
- Treatment start date and pond status belong closer to pond lifecycle.
- Future pond creation/management will be cleaner with a module boundary.

Do later:

- Move Django model declarations carefully while preserving `managed = False`.
- Avoid table renames unless the database design changes.
- Update imports and viewsets gradually.
- Keep API URLs stable or add compatibility wrappers.

## Consolidate Sensor Ownership

Current state:

- `sensor_messages` and `sensor_readings` are declared in `module_sensor.models`.
- `module_data_ingestion` owns ingestion services but does not own the row models.
- `module_sensor.services.get_readings()` is used by charts.

Desired direction:

- `module_sensor` owns configuration: parameter types, sensor types, IoT devices, project sensors.
- `module_data_ingestion` owns raw/processed readings and ingestion pipeline.
- Chart/comparison services consume readings through a stable query service.

Why it matters:

- Pond comparison is a read/query use case.
- It should not depend on MQTT ingestion details.
- It should call a clean "reading query" boundary.

## Formal Treatment / Experiment Model

The current UI says treatment vs baseline, but the data model does not formally know:

- Which pond is treated.
- Which pond is control.
- When treatment started.
- Whether an experiment is active or completed.
- What hypothesis/target metrics are being evaluated.

Future model options:

```text
PondTreatment
- treatment_id
- pond_id
- treatment_type
- started_at
- ended_at
- metadata

PondComparisonExperiment
- experiment_id
- project_id
- treatment_pond_id
- baseline_pond_id
- started_at
- ended_at
- status
- notes
```

Do not add this in phase 1 unless the product requires saved experiments.

## Electricity / Manual Readings

Electricity is not currently represented in `sensor_readings`.

Possible future sources:

- Manual readings table.
- Smart meter ingestion table.
- Financial/performance module.
- `sensor_readings` extension if electricity comes from a sensor.

Do not fake electricity in the backend. If demo data is needed, label it as seeded demo data and keep the source explicit.

## API Stability

Even after module cleanup, try to keep these frontend-facing routes stable:

- `GET /api/projects/{projectId}/pond-comparison/ponds`
- `GET /api/projects/{projectId}/pond-comparison`

Internal ownership can move from `module_project` to `module_pond` later without forcing frontend churn.

## Acceptance Criteria

- There is a clear target module boundary.
- Phase 1 API does not prevent future module split.
- Treatment metadata has a planned first-class home.
- Sensor reading query responsibility is explicit.
