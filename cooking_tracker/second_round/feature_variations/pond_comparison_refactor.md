# Pond Comparison Refactor

## Source Feature

The updated monolith replaces the old A/B testing-style UI with a dedicated Pond
Comparison page and richer comparison controls.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/services/pond_comparison.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/views.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_project/views.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/pages/PondComparisonPage.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/pond-comparison/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/services/api.service.ts`

## Source API Changes

- `GET /api/projects/{projectId}/pond-comparison/ponds/`
- `GET /api/projects/{projectId}/pond-comparison/?pondAId=&pondBId=&startDate=&endDate=&grouping=&parameters=`

The source now supports explicit `parameters` query pills. Omitted parameters fall back
to treatment-derived defaults.

## Target Ownership

- `pond-service`: comparison options and comparison endpoint.
- `ingestion-service`: reading retrieval.
- `project-service`: project access and possibly project parameter catalogue for add-menu gating.
- `frontend`: replace `ABTestingPage` route implementation with dedicated comparison page.

## Current Target Gap

The microservice target already has a first-round `pond-service` comparison implementation,
but it is frozen to four fixed parameters and the frontend still routes `/pond-comparison`
to `ABTestingPage`. The updated source has a dedicated `PondComparisonPage` and
parameter-pill behavior.

## Microservice Translation Notes

- Keep gateway route precedence: `/api/projects/{id}/pond-comparison` must still route to
  `pond-service` before general `/api/projects/**`.
- Do not regress first-round parity tests around grouping and local timezone bucketing.
- Reconcile whether second-round parameter pills supersede the first-round fixed-four
  contract. This is a deliberate product behavior change.

## Sync Plan

1. Port frontend page/components and remove AB-testing route usage.
2. Extend `pond-service` comparison endpoint to accept optional `parameters`.
3. Add project parameter availability payload if the updated UI needs it.
4. Preserve existing date validation and grouping behavior.
5. Add tests for default treatment-derived parameters, explicit parameter list, unknown
   parameter rejection, and fixed route behavior through the gateway.

## Status

Implemented first microservice backend/frontend slice on 2026-08-06 after Treatment
Management added `target_parameters` to `pond-service`.

Source details confirmed:

- Default comparison parameters are the union of both ponds' treatment
  `target_parameters` overlapping the requested date window.
- If no treatment-watched parameters exist in the window, fallback parameters are
  `ammonia`, `dissolved_oxygen`, `turbidity`, and `ph`.
- Explicit `parameters=` query replaces the derived set and is validated against the
  canonical comparison list, not only against configured project settings.
- `availableParameters` is still limited to project-configured parameter settings and
  powers the frontend add menu.
- Chart buckets with no readings are `null`, while metric cards keep zero fallback plus
  `pondAHasReadings` / `pondBHasReadings` flags.
- Window treatment badges use treatments overlapping the requested date range, not only
  currently active treatments.

Target edits planned:

- Extend `pond-service` `ComparisonService` to support dynamic/canonical parameters,
  explicit parameter query, watched-by badges, available parameter metadata via
  `project-service` gRPC, null chart buckets, and window-overlap treatments.
- Keep existing grouping/date validation in `PondController`, adding only
  `parameters` validation.
- Replace `/pond-comparison` route implementation with a dedicated page and dynamic
  parameter controls. Reuse existing date inputs/select controls rather than adding the
  monolith-only calendar/popover dependency.
- Update shared frontend comparison types and chart component props.

## Target Edits Completed

- `pond-service` `ComparisonService` now derives comparison parameters from treatment
  courses overlapping the selected date window, falls back to the source default set,
  accepts explicit custom `parameters`, exposes `parameterSource`, and sends project
  `availableParameters` for the add menu.
- `pond-service` compare metrics now include `watchedBy`, per-pond reading flags, and
  nullable `lowerIsBetter`; chart buckets with no readings are emitted as `null`.
- `pond-service` comparison endpoints now accept both trailing-slash and no-slash forms.
- `project-service` gRPC parameter catalogue/settings are reused by `pond-service` for
  labels, units, configured add-menu parameters, and treatment target metadata.
- `frontend` now routes `/pond-comparison` to `PondComparisonPage` with dedicated
  `components/pond-comparison/` controls, treatment watch-list parameter pills,
  add/remove custom parameter behavior, default fallback messaging, window treatment
  chips, and nullable-series chart rendering.
- Legacy `ABTestingPage` remains compile-safe but is no longer the route target.

## Verification

- `mvn -pl pond-service -am -Dtest=ComparisonMathTest,FeedingServiceMathTest,TreatmentServiceMathTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - Passed: 11 tests, 0 failures.
- `mvn -pl pond-service -am -DskipTests compile`
  - Passed.
- `npm run build`
  - Passed.
