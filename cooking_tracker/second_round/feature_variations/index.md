# Feature Variation Index

Source repo:

`/Users/thetnaungsoe/Desktop/AquamonitoringV2`

Target repo:

`/Users/thetnaungsoe/Desktop/Grad Cert 5/FirstSubmission/ThetNaungSoe_Aquashield`

## Variation Backlog

Scope decision, 2026-08-06: every variation below is mandatory unless the owner later
removes it from scope.

| Priority | Variation | Target owners | Status |
|---|---|---|---|
| P0 | [Second-round schema delta](schema_delta_20260801.md) | Pond, Project, Sensor, Ingestion, Notification | Partial: pond feeding/treatment schema synced |
| P1 | [Feeding and Growth](feeding_growth.md) | Pond, Project, Ingestion, Frontend | In progress: backend/API synced; source-parity frontend dashboard restored |
| P1 | [Treatment management and stability](treatment_management_stability.md) | Pond, Project, Ingestion, Notification, Frontend | In progress: backend/API synced; source-parity frontend workflow restored |
| P1 | [Pond comparison refactor](pond_comparison_refactor.md) | Pond, Ingestion, Project, Frontend | In progress: dynamic backend/frontend slice synced |
| P1 | [Energy dashboard, alerts, and export](energy_alerts_export.md) | Project, Sensor, Ingestion, Notification, Frontend | In progress: first backend/frontend slice synced |
| P2 | [Global alert center](global_alert_center.md) | Notification, Realtime Gateway, Frontend | In progress: first frontend/realtime slice synced |
| P2 | [Daily health scheduler and cycle metrics](daily_health_scheduler.md) | Pond, Notification, Platform/K8s | In progress: first scheduler/platform slice synced |
| P2 | [Data population and BangKa demo seeds](data_population_bangka.md) | Ingestion, Pond, Project, Sensor, Scripts | In progress: local reference inspector/importer synced; target gateway smoke passed |
| P2 | [Load, stress, and performance testing](load_stress_performance.md) | CI/CD, K8s, All services | In progress: target scenario tooling synced; evidence pending runtime |
| P3 | [Browser auth cookie hardening](browser_auth_cookie_hardening.md) | Identity, API edge, Realtime Gateway, Frontend | In progress: first cookie/CSRF hardening slice synced |

## Remaining Sync Work

Tracked after the 2026-08-07 local UI parity check:

| Priority | Leftover work | Reason |
|---|---|---|
| P0 | Overview latest-reading bootstrap | Overview now shows Pond A-E, but still displays `No Readings` until live websocket/cache data exists. It should hydrate from the latest sensor/ingestion reading for each pond. |
| P0 | Source-to-target UI parity sweep | Feeding and Treatments were restored; still compare Overview, Digital Twin, Real-time & Forecast, Historical Data, Pond Comparison, and Energy against `/Users/thetnaungsoe/Desktop/AquamonitoringV2`. |
| P1 | Trailing-slash route parity | Source/frontend routes often use DRF-style trailing slashes. Target Spring controllers/gateway should accept both slash and no-slash forms for catalogue and feature APIs. |
| P1 | Cross-profile imported data validation | Local smoke mainly validated Demo Shrimp Farm. Need verify Fish, Crab Hatchery, Octopus, and Frog project switching, ponds, readings, and page behavior. |
| P1 | Docker/API integration regression evidence | Unit/build/browser checks passed, but full service integration tests for feeding CRUD, treatment CRUD/stability, energy export, alerts, and comparison still need runtime evidence. |
| P2 | Local load/stress/performance run | `loadtests/` exists, but target evidence must be produced against the local microservice stack first. |
| P2 | Cloud runtime rebuild and cloud smoke | Recreate/reuse first-round cloud resources after local sync stabilizes, then run migration, smoke, and performance evidence there. |

## Dependency Order

1. Reconcile schema and API ownership before copying UI code.
2. Port `pond-service` feed/treatment data model changes before enabling Feeding,
   Treatments, or the updated Pond Comparison page.
3. Port project-level energy ingestion/alert behavior before treating the Energy
   dashboard as complete.
4. Add global alerts after alert query/filter semantics are stable.
5. Translate performance tests after the feature set and routes are stable. The source
   VM/Locust work is mandatory reference input, but the final target evidence must be
   microservice-based.

## Cloud Rebuild Decision

When the cloud runtime is rebuilt, reuse the first-round custom domains and resource
naming where practical. Recreate only what was shut down or destroyed to save budget.

## Reference Evidence

- [Local Postgres reference dataset](../local_postgres_reference.md): existing
  `aquaculture` database counts, Demo Shrimp Farm coverage, and public-to-microservice
  schema mapping for read-only verification.

## First Sync Rule

For each variation, update the corresponding markdown file before touching code:

- mark the exact source files read;
- mark target files to change;
- record any deliberate microservice divergence;
- add verification evidence after implementation.
