# AquaShield Second-Round Sync

## Context

The first AquaShield microservices submission has already been completed and submitted.
After that first submission, the monolith/reference application continued to evolve with
new features, schema changes, UI updates, load/stress/performance testing work, and VM
staging deployment scripts.

The updated source application is:

`/Users/thetnaungsoe/Desktop/AquamonitoringV2`

The current microservice-based target application is this repo:

`/Users/thetnaungsoe/Desktop/Grad Cert 5/FirstSubmission/ThetNaungSoe_Aquashield`

The old embedded `AquaMonitoringv2/` copy inside the microservice repo should not be
treated as the latest source. The external `AquamonitoringV2` repo is the current
feature source for second-round synchronization.

## Current Direction

The second-round work is not a direct monolith deployment exercise. Any feature brought
forward from the updated monolith must be translated into the existing microservice
architecture:

- React/Vite frontend stays in `frontend/`.
- Public REST routes stay behind the microservice API edge.
- Domain behavior is assigned to the owning microservice.
- Service-to-service reads stay behind gRPC contracts where required.
- Telemetry and event behavior should fit Pub/Sub, ingestion, notification, realtime, and
  audit boundaries.
- Cloud runtime remains the GCP/GKE microservice target, even though the updated monolith
  is currently doing VM-based load/stress/performance testing.

The cloud servers from the first submission were shut down to save budget. Rebuilding the
cloud runtime is required later, but it is not the first task. The first task is to
identify feature variations and plan how each one maps into the microservice target.

## First Task

Create a second-round tracking area under:

`cooking_tracker/second_round/`

The workflow is:

1. Record this second-round context in `overall.md`.
2. Compare the updated monolith/reference repo against the current microservice repo.
3. Identify feature variations introduced after the first submission.
4. Keep a list of those variations.
5. Create a `feature_variations/` folder.
6. Create one markdown file per variation.
7. In each variation file, document the source feature, target microservice ownership,
   files to inspect, API/data/event implications, sync plan, and status.
8. Use those files as the working backlog for the actual synchronization process.

## Initial Source Signals

Early inspection of `/Users/thetnaungsoe/Desktop/AquamonitoringV2` shows second-round
activity around:

- Feeding and growth dashboard UI/components.
- Treatment management, cost, stability, and efficiency UI/components.
- Pond comparison UI refactor and backend service changes.
- Energy consumption dashboard and alert refinements.
- Daily health computation.
- Data population scripts and Bangka sample datasets.
- Load/stress/performance testing with VM and Locust-style approach.
- Staging GCP VM deployment scripts for the monolith testing environment.
- Backend schema updates dated around 2026-08-01.

These are source signals only. Each item still needs to be mapped to the microservice
target before implementation.

## Working Rules

- Do not copy monolith code directly into the microservice target without assigning
  ownership and adapting contracts.
- Preserve user-facing behavior where it is already useful and tested in the updated
  monolith.
- Keep professor-facing submission cleanup separate from working trackers.
- Reconcile documentation after implementation; restored first-round docs may be stale.
- Avoid rebuilding cloud resources until feature sync scope is agreed.

## Decisions

| Date | Decision |
|---|---|
| 2026-08-06 | All discovered second-round variations are mandatory for the final submission. |
| 2026-08-06 | The updated monolith VM/load/stress/performance work must be translated into the microservice-based environment. It is reference input, not final target evidence by itself. |
| 2026-08-06 | Reuse first-round custom domains and cloud resource naming where practical when the GKE/runtime environment is rebuilt. |

## Sync Log

| Date | Slice | Notes |
|---|---|---|
| 2026-08-06 | Feeding and Growth | First microservice slice implemented in `pond-service` and `frontend`: feed schema, feed catalogue/log APIs, dashboard aggregation, biomass write path, route/sidebar/page, and focused tests. `PondApiIT` scenario added but blocked locally by missing Docker/Testcontainers runtime. |
| 2026-08-06 | Treatment Management and Stability | First microservice slice implemented across `pond-service`, `project-service`, shared gRPC, edge routing, and `frontend`: treatment catalogue CRUD, course CRUD, dose cost snapshots, stability endpoint, project parameter chips, electricity pricing seam, route/sidebar/page, and focused tests. |
| 2026-08-06 | Pond Comparison Refactor | Dynamic treatment-derived parameter comparison synced across `pond-service`, `project-service` gRPC reads, and `frontend`: custom parameter pills, available parameter add menu, watched-by labels, nullable chart buckets, window treatment chips, route replacement, and focused tests/builds. |
| 2026-08-06 | Energy Dashboard, Alerts, and Export | First microservice slice implemented across `project-service`, `sensor-service`, `ingestion-service`, `notification-service`, shared gRPC, and `frontend`: pond-less energy mappings/readings, dashboard previous-period parity, XLSX export route, hourly/daily energy alert lifecycle, alert filters, Energy hub/electricity routes, custom ranges, compare toggle, and export action. |
| 2026-08-06 | Global Alert Center | First frontend/realtime slice implemented: global `AlertsProvider`, shell-level `AlertCenter`, project-level alert rendering, resolve/refetch flow, Overview summary integration, websocket multi-subscriber support, and null-safe project alert frames from `realtime-gateway`. |
| 2026-08-06 | Daily Health Scheduler and Cycle Metrics | First scheduler/platform slice implemented across `pond-service`, `notification-service`, shared gRPC, Docker Compose, and K8s: grouped pond alert counts, daily health projection, human-edit preservation, profile day cap enforcement, cycle stage uniqueness migration, job runner, CronJob at 00:15 Asia/Singapore, and focused tests/render validation. |
| 2026-08-06 | Data Population and BangKa Demo Seeds | First local-demo seed slice implemented: gateway-owned setup for Demo Shrimp Farm, guarded SQL backfill for five ponds, JSONB ingestion readings/messages, BangKa-pattern cycles/feed/treatments/electricity, sentinel alert-log rows, count/month coverage output, and explicit local-only guard. 2026-08-07 inspection confirmed the existing local `aquaculture` Postgres DB already contains Demo Shrimp Farm Pond A-E with readings, feed logs, treatments, alerts, and daily health, so seed execution is only needed for a fresh target DB. |
| 2026-08-06 | Load, Stress, and Performance Testing | Target-native scenario tooling added under `loadtests/`: gateway bearer-token Locust journeys, thundering-herd endpoint load, Pub/Sub emulator backlog publisher with optional drain measurement, `/ws/token` WebSocket fanout client, isolated requirements, ignored results folder, and performance evidence landing docs. Runtime execution is pending Docker/GKE availability. |
| 2026-08-06 | Browser Auth Cookie Hardening | First security sync slice implemented across Identity, resource-service auth filters, analytics, realtime token minting, API edge, local gateway, and frontend: HttpOnly access/refresh cookies, `/api/csrf`, double-submit CSRF for unsafe cookie-auth requests, no browser token storage, same-origin Vite proxy defaults, and focused compile/build/test coverage. Docker-backed integration execution remains pending. |
| 2026-08-07 | Local Microservice Runtime | Local Docker target started behind `http://localhost:8080`. Fixed `pond-service` V4 migration idempotency (`uq_cycle_stage_metrics_cycle_stage` unique index already created by V2), imported the existing local `aquaculture` reference dataset into service-owned target schemas with `scripts/import-local-reference-db.sh`, and smoke-tested projects, ponds, feeding dashboard, pond comparison, energy dashboard, alerts, charts, and treatment stability through the gateway. |
| 2026-08-07 | Frontend UI Parity Check | Restored the updated monolith Feeding and Treatments UI components in the microservice frontend, added Chart.js dependencies, fixed stale project/profile selection so Overview shows Pond A-E after login, corrected local demo login hints, stopped a stale IPv6 Vite process that caused `localhost:5173` 500s, and verified Overview, Feeding, Treatments, and Energy in Playwright screenshots against the local stack. |

## Remaining Work Snapshot

Tracked after the 2026-08-07 local UI parity check:

- Overview latest-reading bootstrap: Pond A-E render, but latest readings still need to
  hydrate from sensor/ingestion data before websocket updates arrive.
- Full UI parity sweep: Feeding and Treatments are restored; compare Overview,
  Digital Twin, Real-time & Forecast, Historical Data, Pond Comparison, and Energy
  against the updated monolith.
- Trailing-slash API parity: accept both DRF-style trailing slash routes and
  no-slash Spring routes where the frontend/source uses both forms.
- Cross-profile validation: verify imported Fish, Crab Hatchery, Octopus, and Frog
  project behavior, not only Demo Shrimp Farm.
- Integration regression evidence: run service-level feeding, treatments, stability,
  energy export, alerts, and comparison scenarios once the local runtime is ready for
  heavier test execution.
- Performance evidence: run `loadtests/` against the local microservice stack first,
  then repeat on the rebuilt cloud/VM environment.
- Cloud rebuild: recreate or reuse first-round cloud resources only after local feature
  and UI parity are stable.
