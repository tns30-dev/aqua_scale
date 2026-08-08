# Load, Stress, And Performance Testing

## Source Feature

The updated monolith added a serious load/stress/performance testing track with
Locust scenarios, growth data generation, MQTT backlog replay, WebSocket fanout testing,
and disposable GCP VM staging scripts. The microservice target uses that as reference
input only; the selected target tool is k6 with cloud-native execution.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/loadtests/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/docs/code_refactoring/tests/performance_test_cases.md`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/docs/code_refactoring/tests/performance_local_results.md`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/docs/code_refactoring/tests/performance_vm_results.md`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/deploy/staging-gcp/`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/.github/workflows/staging-loadtest.yml`

## Source Findings To Preserve

- Pond comparison and historical charts are the likely long-range bottlenecks.
- Alert listing is risky if unpaginated and unpruned.
- MQTT backlog handling must be tested through a real broker.
- WebSocket fanout should be measured separately from HTTP load.
- Laptop numbers do not transfer to production-sized compute.
- The original growth test was wrong when fake readings did not overlap the measured
  month; target growth data must be generated backward from the measured end date.
- The first herd test was wrong because think time and random tasks scattered users;
  target herd tests must hit one endpoint with no pause.
- Backlog success is published messages versus stored rows, not publish completion.
- WebSocket driver limits can mimic backend failure, so k6/container/cloud execution is
  preferred over one Python thread per socket for final evidence.

## Target Ownership

- CI/CD and K8s track owns performance gates.
- Every service owns endpoint-level fixes found by the tests.
- `ingestion-service`, `realtime-gateway`, and `notification-service` need specific stress scenarios.

## Current Target Gap

The first-round microservice tracker listed performance evidence as pending.
The source Locust/VM work is monolith-shaped and cannot be copied directly as final
microservice evidence. The target evidence must be k6-driven against the gateway-routed
microservice stack, with cloud-native execution from Kubernetes Job or GitHub Actions.

## Microservice Translation Notes

- Target environment should be gateway-routed microservices, ideally GKE or Docker Compose
  full-platform for local rehearsal.
- Use the same business cases, but rewrite URLs and setup for microservice routes.
- Include Pub/Sub ingestion and realtime gateway behavior, not Django MQTT adapter behavior.
- For cloud budget, scripts must support stop/teardown and must not run by default.
- The target browser/runtime path uses gateway cookies plus CSRF, not Django auth and not
  the old bearer-only loadtest assumption.
- WebSocket fanout uses `POST /ws/token` plus first-frame `AUTH` on `/ws`; one token is
  minted per socket because tokens are one-time use.
- MQTT backlog testing becomes Pub/Sub emulator backlog testing for the microservice
  ingestion path.
- Final cloud evidence should come from a k6 container, Kubernetes Job, or CI k6 runner;
  do not treat a disposable monolith VM run as final target evidence.

## Target Files Changed

- `loadtests/README.md`
- `loadtests/k6/common.js`
- `loadtests/k6/busy-day.js`
- `loadtests/k6/thundering-herd.js`
- `loadtests/k6/growth-probe.js`
- `loadtests/k6/websocket-fanout.js`
- `loadtests/k6/kubernetes-job.yaml`
- `scripts/create-local-loadtest-users.sh`
- `scripts/grow-local-performance-data.sh`
- `scripts/sql/grow-ingestion-readings-local.sql`
- `.github/workflows/perf.yml`
- `loadtests/pubsub_backlog.py`
- `loadtests/results/.gitkeep`
- `docs/evidence/performance/README.md`
- `docs/evidence/performance/test_cases.md`
- `docs/evidence/performance/local_results.md`
- `docs/evidence/performance/cloud_native_results.md`
- `docs/second_evidence/README.md`
- `docs/second_evidence/performance/README.md`
- `.gitignore`

## Sync Plan

1. Done: source A/B/C taxonomy translated into gateway-routed HTTP, Pub/Sub, and
   realtime scenarios.
2. Done: k6 selected for HTTP load, thundering-herd, and WebSocket fanout. Standalone
   Python remains for Pub/Sub backlog/drain measurement.
3. Done: large demo data generation is separated into the guarded BangKa seed slice.
4. Done: growth testing translated into guarded local SQL row growth plus a k6 fixed-page
   probe.
5. Done: local k6 execution finished against Docker Compose full-platform at 4,000,000+
   readings with 50 concurrent users and p95 under 3 seconds.
6. Pending: cloud/GKE k6 execution after the runtime/data state is approved.
7. Done: evidence landing folders added under `docs/evidence/performance/` and
   `docs/second_evidence/performance/`.

## Verification

- `python3 -m py_compile loadtests/pubsub_backlog.py`
- `node --check` for k6 script syntax where Node parsing is compatible.
- Local runtime k6 load tests completed.
- Cloud-native runtime k6 load tests still need an explicit GKE/CI run window.

## Status

Implemented: k6-first target scenario tooling synced and local evidence completed.
Cloud-native evidence execution is pending an approved GKE/CI run window.
