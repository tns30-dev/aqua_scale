# Phase 1 - Backend Read API

## Goal

Build the backend API required to replace hardcoded pond comparison data with real database-backed values.

Scope is read-only:

- No new management UI.
- No formal experiment setup table.
- No pond creation.
- No sensor creation.
- No data ingestion changes.

## Endpoints

### Pond Options

Recommended route:

`GET /api/projects/{projectId}/pond-comparison/ponds`

Responsibilities:

- Verify authenticated user can access `projectId`.
- Verify user has `view_pond_comparison` feature access, unless the user has wildcard feature access.
- Return ponds for the project.
- Include metadata needed by the current details cards.
- Include whether each pond has sensor data.

Recommended response shape:

```json
{
  "projectId": "uuid",
  "ponds": [
    {
      "pondId": "uuid",
      "name": "Pond A",
      "companyName": "AquaTech Farms",
      "gpsLocation": "1.40194 N, 103.95197 E",
      "treatmentStartDate": null,
      "hasSensorData": true,
      "firstReadingAt": "2026-01-01T08:00:00+08:00",
      "lastReadingAt": "2026-03-18T15:56:00+08:00"
    }
  ]
}
```

### Comparison Result

Recommended route:

`GET /api/projects/{projectId}/pond-comparison`

Query params:

- `pondAId`: required UUID
- `pondBId`: required UUID
- `startDate`: required `YYYY-MM-DD`
- `endDate`: required `YYYY-MM-DD`
- `grouping`: optional, default `auto`
- `parameters`: optional later

Responsibilities:

- Reject same-pond comparison.
- Validate both ponds exist.
- Validate both ponds belong to the requested project.
- Verify project access through the existing project queryset/RBAC path.
- Query readings for both ponds using the same date range.
- Aggregate metrics and chart data in backend.
- Return frontend-ready data.

## Service Shape

Recommended internal service:

`PondComparisonService.compare(project, pond_a_id, pond_b_id, start_date, end_date, grouping)`

It should:

1. Load both ponds.
2. Resolve grouping using the same rules as `ChartService`.
3. Fetch readings through `module_sensor.services.get_readings()`.
4. Decide which parameters to include.
5. Calculate average values for metric cards.
6. Build time-bucketed chart series.
7. Return a plain dictionary for the view.

Keep the service free of DRF `Request`/`Response` objects. Views validate HTTP input; services calculate business output.

## Parameters For Phase 1

Use only columns that exist on `sensor_readings`.

Recommended phase 1 default set:

| Parameter | Label | Unit | Chart | Lower Is Better | Local Data? |
|---|---|---|---|---|---|
| `temperature` | Temperature | C | line | context-dependent | yes |
| `ph` | pH |  | line | no simple rule | yes |
| `dissolved_oxygen` | Dissolved O2 | mg/L | line | false | yes |
| `salinity` | Salinity | ppt | line | context-dependent | yes |

Do not make ammonium, turbidity, or electricity mandatory in phase 1 because local readings currently do not populate them.

Future target set:

| Parameter | Reason |
|---|---|
| `ammonium` or `ammonia` | BioBloc proof metric |
| `dissolved_oxygen` | BioBloc and pond health metric |
| `turbidity` | Clarity/performance metric |
| `electricity` | Cost saving metric, but needs a real data source |

## Aggregation Rules

Metric cards:

- Calculate average over the selected date range.
- Ignore null values.
- If one pond has no values for a parameter, return `null` for that side.
- If both sides are null, omit the metric or mark it `hasData: false`.

Chart data:

- Group by `hourly`, `daily`, `weekly`, or `monthly`.
- For each bucket, average non-null values per pond.
- Use the same labels as `ChartService._get_period_key_and_label()`.
- Keep the frontend shape: `{ label, seriesA, seriesB }`.

Grouping:

- Reuse `ChartService._get_grouping_strategy()` or extract it to a shared helper later.
- Phase 1 can call the private method pragmatically, but the cleaner follow-up is a public grouping utility.

## Validation

Return `400` for:

- Missing query params.
- Invalid date format.
- `endDate < startDate`.
- `pondAId == pondBId`.
- Unsupported grouping.

Return `403` for:

- User lacks project access.
- User lacks `view_pond_comparison`.

Return `404` for:

- Pond missing.
- Pond exists but does not belong to the project.

Return `200` with empty metrics/charts for:

- Valid request, but no readings in the date range.

## Current Data Caveats

Local data has readings only for Demo Shrimp Farm Pond A and Pond B.

Only these reading columns currently have useful values:

- `temperature`
- `ph`
- `salinity`
- `dissolved_oxygen`

So an early smoke test should compare Pond A vs Pond B in Demo Shrimp Farm from `2026-01-01` to `2026-03-18`.

## Files Likely Touched Later

Implementation phase, not now:

- `backend/module_project/views.py`
- `backend/module_project/urls.py`
- `backend/module_project/serializers.py`
- `backend/module_project/services.py` or new `backend/module_project/services/pond_comparison.py`
- `backend/module_project/tests/test_pond_comparison.py`

## Acceptance Criteria

- Authenticated user can list comparison pond options for an accessible project.
- Authenticated user can compare two accessible ponds in the same project.
- Unauthorized project access is rejected.
- Same pond comparison is rejected.
- Empty reading range returns a clean empty state payload, not a server error.
- Response shape can plug into the current frontend with minimal mapping.
