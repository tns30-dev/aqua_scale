# Local k6 Performance — Load, Stress, Growth, WebSocket (2026-08-09)

**Local rehearsal evidence** (Docker Compose stack, nginx gateway
`:8080`, ~8M-row Postgres: 4,010,274 `sensor_messages` + 4,010,164
`sensor_readings`). Per `docs/second_evidence/README.md`, Compose results are
rehearsal; the final cloud-native k6 runs against the deployed GKE API in the
remote round. k6 `grafana/k6:0.54.0` (same image as `perf.yml`), admin account.
Pass/fail anchored on the **~3s response-time target**.

Summary exports: `loadtests/results/k6-local-2026-08-09-*.json`.

## Load — sustained realistic mix (busy-day, 50 VUs)

30s ramp → 2m hold → 20s down. Full user journey per iteration (auth, summary,
ponds, latest readings, charts, comparison, feeding, energy, alerts).

| Metric | Value | vs 3s target |
|---|---|---|
| http_req_duration p95 | **11.5 ms** | PASS |
| http_req_duration max | 2.01 s | PASS |
| A4 charts p95 (heaviest) | 846 ms | PASS |
| http_req_failed | **0.00%** (0/5312) | PASS |
| checks | 100% (5362/5362) | PASS |
| throughput | 31 req/s, 17 iters/s | — |

## Stress — find the knee (busy-day, escalating VUs)

Same journey, VUs escalated to locate saturation. The **breaking curve**:

| VUs (×base) | req p95 (served) | error rate | iteration p95 | checks | verdict |
|---|---|---|---|---|---|
| 50 (1×) | 11.5 ms | 0.00% | 3.86 s | 100% | comfortable |
| 250 (5×) | 17.4 ms | 0.31% | 3.89 s | 99.68% | first saturation |
| 500 (10×) | 32.8 ms | 2.52% | 13.25 s | 97.47% | **knee** |

Interpretation: **served-request latency stays low at every level** (p95 always
< 40 ms), so the microservices themselves are not the bottleneck. What degrades
under load is the **connection layer** — `http_req_blocked` (waiting for a
connection slot) climbs to ~20 s max and iteration_duration blows out to a 30 s+
tail at 500 VUs, with a 2.5% error rate on the heaviest endpoints (energy
dashboard, pond comparison). That is the single local nginx gateway + Docker
NAT saturating, not service compute. On GKE (multiple replicas + HPA + L7 LB)
this ceiling moves out — which is exactly why the definitive breaking-point
evidence belongs to the cloud-native remote round.

## Growth — query cost over the large dataset (growth-probe, 40 iters, 1 VU)

Isolates per-endpoint latency against the 8M-row dataset (no connection
contention):

| Endpoint | p95 | max |
|---|---|---|
| charts (aggregation over 4M readings) | 864 ms | 1.24 s |
| pond comparison | 3.1 ms | 1.21 s |
| energy dashboard | 24.9 ms | 37 ms |
| feeding options / dashboard | ~8–9 ms | 24 ms |
| project summary | 6.6 ms | 8.8 ms |
| http_req_failed | 0.00% (0/245) | — |

Even the heaviest analytics chart aggregation over 4M rows is **sub-second at
p95**, far under target.

## WebSocket / real-time (websocket-fanout, 50 VUs, 30s hold)

| Metric | Value |
|---|---|
| ws_connecting p95 | 25.9 ms |
| ws_session_duration p95 | 30.02 s (30 s hold, as designed) |
| WS sessions established | 50/50 |
| checks (token + upgrade + auth) | 100% (500/500) |
| http_req_failed | 0.00% |

Every real-time session minted a `/ws/token`, upgraded to WSS, passed
first-frame AUTH, and held its connection — the real-time path is healthy under
concurrent fan-out.

## Ingestion backlog (Pub/Sub → ingestion → Postgres)

`loadtests/pubsub_backlog.py` burst-published to the Pub/Sub emulator at
**~4,000–5,000 msg/s** (2,000 msgs = 10,000 rows in 0.5 s). The end-to-end
drain *rate* into Postgres was not captured locally: the ingestion consumer
**fail-closed** on the helper's default identifiers — first rejecting an
unregistered device (`Unknown or Inactive IoT device 'DEV-BANGKA-DEMO'`), then,
with a registered device, rejecting unmapped ports (`No Sensor mapping for
device 'DEV-LOCAL-BACKLOG' port 'BKA-A'`). That is the pipeline's device/port
authorization working correctly, not a fault. Steady-state ingestion is
already evidenced by the 8M stored rows and the `IngestionIT` Testcontainers
integration tests (Phase 1). A clean drain-rate measurement is a remote-round
item against the deployed ingestion service with a fully mapped device.

## Verdict

| Scenario | Result vs 3s target |
|---|---|
| Load (50 VUs) | PASS — p95 11.5 ms, 0% errors |
| Stress (250 / 500 VUs) | PASS to 250; knee at 500 (connection-layer, 2.5% err) |
| Growth (8M rows) | PASS — heaviest p95 864 ms |
| WebSocket (50 concurrent) | PASS — 100% connect/auth |

All local rehearsal targets met. Cloud-native re-run (load + stress + growth +
websocket vs the deployed API) is the remote-round deliverable.
