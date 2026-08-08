# Feeding And Growth

## Source Feature

The updated monolith adds a full Feeding & Growth dashboard:

- feed type catalogue CRUD;
- per-day feed entry replacement;
- cycle comparison;
- feed/cost KPIs;
- stage summaries;
- treatment overlays;
- cycle biomass write path for FCR.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/models.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/views.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/services/feeding_dashboard.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/management/commands/seed_feeding_demo.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/pages/FeedingGrowthPage.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/feeding/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/feeding/types.ts`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/services/api.service.ts`

## Source API Surface

- `GET /api/projects/{projectId}/feeding/options/`
- `GET /api/projects/{projectId}/feeding/dashboard/?cycle=&compare=`
- `GET /api/feed-types/?project=`
- `POST /api/feed-types/`
- `PATCH /api/feed-types/{feedTypeId}/`
- `DELETE /api/feed-types/{feedTypeId}/`
- `PUT /api/ponds/{pondId}/feed-days/{date}/`
- `PATCH /api/cycles/{cycleId}/biomass/`

## Target Ownership

- `pond-service`: feed catalogue, feed logs, day replacement transaction, cycle biomass,
  feeding dashboard aggregation.
- `project-service`: profile stage template lookup.
- `frontend`: route `/feeding-growth`, sidebar entry, components and API client methods.

## Current Target Gap

The microservice target has no `feed_types`, no `feed_logs`, no Feeding page, and no
cycle biomass endpoint. This is a new feature for the microservice target, not a small
patch.

## Microservice Translation Notes

- Keep feed data in `pond-service`; do not let `project-service` own feed logs.
- The dashboard needs profile stages from `project-service`. Add a gRPC/read contract if
  current Project gRPC does not expose enough stage configuration.
- Money rounding must stay server-side. Source `feeding_dashboard.py` centralizes unit
  price and row cost calculation.
- Day replacement should be one transaction and preserve feed pack snapshots.

## Sync Plan

1. Add pond-service migrations/entities/repos for `feed_types`, `feed_logs`, and cycle biomass.
2. Port server-side aggregation and validation to `pond-service`.
3. Add REST endpoints preserving the source route shapes.
4. Add frontend route, sidebar item, page, components, and API methods.
5. Add focused tests for money rounding, day replacement, active/retired feed types, and
   FCR behavior.

## Status

In progress. First microservice sync slice implemented on 2026-08-06.

Implemented:

- `pond-service` Flyway migration `V2__feeding_growth.sql` for cycle biomass,
  `feed_types`, `feed_logs`, feed constraints, and stage metric uniqueness.
- `pond-service` JPA entities/repositories for feed catalogue and feed logs.
- `pond-service` feeding aggregation service with server-side unit price and row-cost
  rounding.
- Source-compatible REST routes for:
  - `GET /api/projects/{projectId}/feeding/options/`
  - `GET /api/projects/{projectId}/feeding/dashboard/?cycle=&compare=`
  - `GET /api/feed-types/?project=`
  - `POST /api/feed-types/`
  - `PATCH /api/feed-types/{feedTypeId}/`
  - `DELETE /api/feed-types/{feedTypeId}/`
  - `PUT /api/ponds/{pondId}/feed-days/{date}/`
  - `PATCH /api/cycles/{cycleId}/biomass/`
- Frontend route `/feeding-growth`, sidebar item, API methods, feeding TypeScript
  contracts, and a compact operational page for feed types, feed-day replacement,
  biomass, KPIs, stage summary, and day table.
- 2026-08-07 UI parity pass: copied the updated monolith `components/feeding/`
  Chart.js dashboard and page shell into the microservice frontend, added the
  required chart dependencies, and kept decimal string/number DTO handling compatible
  with the microservice APIs.

Deliberate microservice divergences:

- Feeding read routes are exposed by `pond-service` even though the monolith attached
  them to the project viewset; data ownership remains pond-side.
- Feed type/project references are cross-service UUIDs, not database foreign keys to a
  shared monolith `projects` table.
- The approved source Chart.js dashboard is now used in the target frontend; backend
  route ownership remains pond-side.

Verification:

- `mvn -pl pond-service -am -DskipTests compile` passed.
- `mvn -pl pond-service -am -Dtest=FeedingServiceMathTest -Dsurefire.failIfNoSpecifiedTests=false test` passed.
- `npm run build` in `frontend/` passed.
- 2026-08-07 browser verification passed against `http://127.0.0.1:5173`:
  `/feeding-growth` rendered the source-parity KPI, stage day grid, daily feed chart,
  cumulative chart, treatment marks, log-feeding action, and compare action using
  imported local reference data.
- `PondApiIT` was updated with a feeding API scenario, but running it is blocked until
  Docker/Testcontainers is available locally. Current failure: no Docker socket at
  `/var/run/docker.sock`.
