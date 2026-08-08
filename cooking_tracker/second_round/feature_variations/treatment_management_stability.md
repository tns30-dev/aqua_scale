# Treatment Management And Stability

## Source Feature

The updated monolith expands treatments from a simple catalogue/history read model into
a farmer-facing treatment management and stability analysis feature.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/models.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/views.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/serializers.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/services/treatment_stability.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/services/treatment_cost.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/pages/TreatmentsPage.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/treatments/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/services/api.service.ts`

## Source API Surface

- `GET /api/projects/{projectId}/parameters/`
- `GET /api/treatments/?project=`
- `POST /api/treatments/`
- `PATCH /api/treatments/{treatmentId}/`
- `DELETE /api/treatments/{treatmentId}/`
- `GET /api/pond-treatments/?pond=`
- `POST /api/pond-treatments/`
- `PATCH /api/pond-treatments/{pondTreatmentId}/`
- `DELETE /api/pond-treatments/{pondTreatmentId}/`
- `GET /api/pond-treatments/stability/?pond=&courses=`

## Target Ownership

- `pond-service`: treatment catalogue CRUD, pond treatment course CRUD, dose/cost snapshots,
  stability composition.
- `project-service`: project parameters and threshold limits.
- `ingestion-service`: reading retrieval for stability windows.
- `frontend`: Treatments page and related components.

## Current Target Gap

The microservice target has read-only global treatments and pond-treatment listing.
It does not have per-project treatments, watched parameter declarations, dose fields,
treatment CRUD, stability endpoint, or Treatments page.

## Microservice Translation Notes

- Source treatment catalogue became per-project. This is a deliberate domain change from
  first-round microservice parity.
- Stability requires reading project threshold limits and sensor readings. Preserve service
  ownership through gRPC rather than cross-service table access.
- `course_cost` is the single source of dose money math.
- Energy/treatment cost blocks are binary: omit them when inputs are incomplete.

## Sync Plan

1. Apply schema delta for treatments and pond treatments in `pond-service`.
2. Add project-parameter list endpoint or reuse an existing Project contract for treatment chips.
3. Add treatment CRUD and course CRUD endpoints in `pond-service`.
4. Add stability computation using gRPC reads from `project-service` and `ingestion-service`.
5. Port Treatments frontend components and adapt auth/API client conventions.
6. Add tests for validation, project scoping, inactive treatments, unit-family rules, and stability windows.

## Status

In progress. First microservice sync slice implemented on 2026-08-06.

Implemented:

- `pond-service` migration `V3__treatment_management.sql` for treatment project scope,
  watched parameters, product price basis, and pond-treatment dose/price snapshots.
- `pond-service` treatment catalogue CRUD:
  - `GET /api/treatments/?project=`
  - `POST /api/treatments/`
  - `PATCH /api/treatments/{treatmentId}/`
  - `DELETE /api/treatments/{treatmentId}/`
- `pond-service` course CRUD and stability:
  - `GET /api/pond-treatments/?pond=`
  - `POST /api/pond-treatments/`
  - `PATCH /api/pond-treatments/{pondTreatmentId}/`
  - `DELETE /api/pond-treatments/{pondTreatmentId}/`
  - `GET /api/pond-treatments/stability/?pond=&courses=`
- `project-service` endpoint `GET /api/projects/{projectId}/parameters/`.
- Project gRPC `GetEnergySettings` so `pond-service` can price electricity without
  reading Project tables.
- Frontend route `/treatments`, sidebar entry, API client methods, and shared types.
- Edge routing for `/api/feed-types` and `/api/projects/{projectId}/feeding/*`, which
  was required to make the previous Feeding slice deployable.
- Focused treatment dose math tests.
- 2026-08-07 UI parity pass: copied the updated monolith `components/treatments/`
  two-panel Treatment Efficiency workflow and page shell into the microservice frontend,
  preserving source interaction patterns while coercing microservice decimal strings for
  numeric display panels.

Deliberate microservice divergence:

- First-round global treatment seed rows are preserved with nullable `project_id` and
  remain visible to project catalogues. New rows are project-scoped, and legacy global
  rows are not editable through the new CRUD path.

Verification:

- `mvn -pl project-service,pond-service -am -DskipTests compile`
- `mvn -pl pond-service -am -Dtest=FeedingServiceMathTest,TreatmentServiceMathTest -Dsurefire.failIfNoSpecifiedTests=false test`
- `npm run build` in `frontend/`
- 2026-08-07 browser verification passed against `http://127.0.0.1:5173`:
  `/treatments` rendered the source-parity pond selector, start-treatment composer,
  course selection list, and empty/analysis panel against imported local reference data.

Remaining:

- Full Docker/Testcontainers API integration evidence is still blocked locally by the
  missing Docker runtime noted during the Feeding slice.
