# Frontend Analytics Wiring

Date: 2026-06-04

## Scope

Wired the React/Vite frontend historical analytics adapter to the implemented Analytics and Pond Service contracts.

## Changes

| Area | Update |
|---|---|
| Analytics chart package | `apiService.getHistoricalCharts` calls `GET /api/projects/{projectId}/charts/` with `pondId`, `startDate`, `endDate`, and `grouping`. |
| Pond cycle list | `apiService.getProjectCycles` now reads `GET /api/cycles?pond={pondId}` and maps the DRF-style `results` envelope to the frontend camelCase `CyclesResponse`. |
| Profile template | The cycle adapter resolves Project Service profile catalogue data into the existing frontend `ProfileTemplate` shape. |
| Pond endpoints | Pond, treatment, pond-treatment, cycle details, and pond comparison calls now use slashless Java/Spring endpoint paths where applicable. |
| Regression tests | Added API service tests for analytics chart query params, pond cycle mapping, and slashless cycle details. |

## Validation

| Command | Result |
|---|---|
| `npm run test -- --run src/test/services/api.service.test.ts` | PASS, 24 tests |
| `npm run test -- --run` | PASS, 103 passed / 8 skipped |
| `npm run build` | PASS |
| `npm run lint` | PASS with existing warnings only |

## Notes

- Existing lint warnings are unrelated to this change: React Fast Refresh export warnings, old hook dependency warnings, and two unused eslint-disable warnings.
- Vite emitted existing browser data and bundle-size warnings during build.
