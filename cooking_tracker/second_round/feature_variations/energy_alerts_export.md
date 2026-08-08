# Energy Dashboard, Alerts, And Export

## Source Feature

The updated monolith adds project-level electricity behavior beyond the first-round
dashboard: pond-less energy readings, hourly/daily threshold alerts, export, and
separate energy alert history calls.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_project/services/energy_dashboard.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_project/services/energy_alerts.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_project/views.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_data_ingestion/services/threshold.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_data_ingestion/tests/test_energy_routing.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/pages/EnergyHubPage.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/pages/EnergyConsumptionPage.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/energy/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/services/api.service.ts`

## Source API Surface

- `GET /api/projects/{projectId}/energy/dashboard/`
- `GET /api/projects/{projectId}/energy/settings/`
- `PUT /api/projects/{projectId}/energy/settings/`
- `GET /api/projects/{projectId}/energy/export/`
- `GET /api/alerts/?projectId=&parameterPrefix=electricity&all=true&startDate=&endDate=`

## Target Ownership

- `sensor-service`: allow project-scoped energy sensor mapping with no pond.
- `ingestion-service`: persist project-scoped electricity readings and emit events.
- `project-service`: energy settings, dashboard, and export.
- `notification-service`: energy alert lifecycle and alert filters.
- `frontend`: Energy hub/electricity page updates and export action.

## Current Target Gap

The microservice target has a first-round energy dashboard/settings path, but it lacks
the source export endpoint, source-style energy alert history filter, and full project-level
energy alert lifecycle behavior. It also needs verification that pond-less sensor readings
are correctly supported through microservice boundaries.

## Microservice Translation Notes

- Energy readings are project-scoped, not pond-scoped.
- Hourly alert opens on `kwh > high_hourly_threshold`; daily alert opens when local-day
  running total crosses `high_daily_threshold`.
- Acknowledged alerts are human-owned and should not be auto-resolved under the user.
- Export should be produced by `project-service` or an analytics/export service, not by the frontend.

## Sync Plan

1. Verify current microservice ingestion supports project-scoped readings without forcing `pondId`.
2. Add or update notification energy alert evaluation.
3. Add alert query filters needed by the frontend: `parameterPrefix`, `all`, date range.
4. Add `GET /energy/export/` in `project-service`.
5. Port EnergyHub and updated Energy page behavior.
6. Add tests for hourly/daily alert dedupe, auto-resolve, export shape, and alert filtering.

## Status

In progress: first backend/frontend slice synced on 2026-08-06.

Confirmed source behavior:

- `GET /api/projects/{projectId}/energy/dashboard/` computes project-scoped
  electricity readings from pond-less sensor rows.
- Previous-period trend pairing is by bucket offset from the period start, not by
  list index; missing previous buckets are `null`, not `0`.
- KPI payload includes previous-period totals/cost/averages/peak and nullable
  `changeVsPreviousPct` when there is no previous data.
- `GET /api/projects/{projectId}/energy/export/` returns an Excel workbook with
  Summary, Daily Records, and Alerts sheets.
- Energy alert history comes from `alert_log` rows where `pond_id is null` and
  parameter is `electricity_hourly` or `electricity_daily`.
- Hourly alert opens on `kwh > high_hourly_threshold`, dedupes while open, and
  auto-resolves when a later hourly reading is under the limit.
- Daily alert opens when the local-day running total crosses
  `high_daily_threshold`, dedupes one per local day, live-updates while open, and
  auto-resolves only on the next day when the new day is under the limit.
- Human-acknowledged energy alerts are not auto-resolved by the system.

Target edits planned:

- Update `project-service` energy dashboard parity for previous-period offset
  pairing, previous KPI fields, `null` no-prior comparison, week labels, and
  export endpoint.
- Add XLSX export in `project-service` using the source workbook sheet shape
  semantics. The endpoint keeps the `/energy/export/` surface and attachment
  filename; implementation avoids introducing a new workbook dependency by
  writing the small XLSX package directly.
- Allow `sensor-service` project sensor mappings with `pond_id = null` and return
  empty gRPC `pond_id` for project-scoped energy sensors.
- Allow `ingestion-service` `sensor_readings.pond_id` to be null, persist null
  for project-scoped mappings, and publish `reading.ingested` events with null
  pond id.
- Extend `notification-service` to evaluate pond-less electricity readings using
  project energy settings from `project-service` gRPC, add hourly/daily alert
  lifecycle methods, add a unique active energy alert guard, and support
  `parameterPrefix`, `all`, `startDate`, and `endDate` filters on
  `GET /api/alerts`.
- Port frontend energy export controls, custom range, compare toggle,
  nullable previous trend values, and shared energy alert API calls.

Implemented target changes:

- `project-service` now returns source-style previous-period dashboard data,
  including offset-paired trend buckets, nullable missing previous values,
  previous KPI fields, relative week buckets, and an XLSX export endpoint at
  `GET /api/projects/{projectId}/energy/export/`.
- `ProjectService.GetEnergySettings` now exposes high hourly and high daily
  threshold values through `shared-api`.
- `sensor-service` allows `project_sensors.pond_id` to be null and omits pond id
  in gRPC responses for project-level meters.
- `ingestion-service` allows `sensor_readings.pond_id` to be null and publishes
  null pond ids for project-level electricity readings.
- `notification-service` consumes pond-less readings as energy events, evaluates
  hourly/daily energy thresholds from project settings, auto-resolves only open
  unacknowledged energy alerts, keeps daily dedupe by local day, and extends
  `GET /api/alerts` with `parameterPrefix`, `all`, `startDate`, and `endDate`.
- `frontend` now has the synced Energy hub/electricity routes, custom date
  range picker, quick-range default grouping, compare toggle, XLSX export action,
  nullable previous trend rendering, long-range heatmap clipping, and shared
  energy alert API calls.

Deliberate microservice divergence:

- Export alerts are computed from current project-service dashboard breach data
  until a notification-service read model/gRPC endpoint is added for recorded
  `alert_log` rows. The public workbook shape and route are in place.

Verification:

- Passed: `mvn -pl shared-api,project-service,sensor-service,ingestion-service,notification-service -am -DskipTests compile`
- Passed: `mvn -pl project-service -am -Dtest=ProfileTypeStagesTest,ThresholdSettingTest -Dsurefire.failIfNoSpecifiedTests=false test`
- Passed: `npm run build`
- Passed: `npm test -- --run src/test/services/api.service.test.ts`
- Passed: `npm test -- --run src/test/components/Sidebar.test.tsx`
- Passed: `git diff --check`
