# AquaShield Microservice Load Tests

Second-round performance scenarios translated from the monolith VM performance
track to the microservice target. The target evidence path is k6-first and
cloud-native: run the load generator from a k6 container, Kubernetes Job, or CI
runner against the gateway-routed microservice platform.

## Files

| File | Purpose |
|---|---|
| `k6/common.js` | Shared k6 gateway auth, CSRF, project/pond/cycle discovery. |
| `k6/busy-day.js` | Group A: weighted normal farm-staff HTTP journey. |
| `k6/thundering-herd.js` | Group B3/B6 style endpoint hammering with no think time. |
| `k6/websocket-fanout.js` | B5 realtime socket fanout through `/ws/token` + `/ws`. |
| `k6/kubernetes-job.yaml` | Manual GKE/Kubernetes Job template for cloud-native runs. |
| `pubsub_backlog.py` | B2/A11 ingestion backlog through Pub/Sub emulator. |
| `requirements.txt` | Python-only dependency for Pub/Sub backlog drain measurement. |

## Setup

Install k6 locally, or use the official container:

```bash
brew install k6
```

For the Pub/Sub backlog helper only:

```bash
python3 -m venv .venv-loadtests
. .venv-loadtests/bin/activate
pip install -r loadtests/requirements.txt
```

Use the imported local reference data or the second-round seed before meaningful
runs so pond/cycle/treatment/feed endpoints have realistic data.

For realistic concurrent-user runs, create distinct load-test users instead of
reusing the admin account:

```bash
ALLOW_LOCAL_LOADTEST_USERS=yes ./scripts/create-local-loadtest-users.sh
```

Then run k6 with:

```bash
-e LOADTEST_EMAIL_TEMPLATE='loadtest{:03d}@example.com' \
-e LOADTEST_PASSWORD='loadtest-pass-2026'
```

The identity service deliberately rate-limits login attempts. For local or
cloud performance runs, start the target environment with a high test-only
limit before the k6 setup phase; otherwise many users from one k6 container or
Job can be measured as auth throttling instead of application load:

```bash
LOGIN_RATE_LIMIT=10000 LOGIN_RATE_WINDOW=PT15M ./scripts/up.sh
```

## k6 HTTP Load

```bash
k6 run -e BASE_URL=http://localhost:8080 \
  -e LOADTEST_EMAIL=admin@aquashield.local \
  -e LOADTEST_PASSWORD='AdminBoot123!' \
  loadtests/k6/busy-day.js
```

Recorded local rehearsal:

```bash
k6 run -e BASE_URL=http://localhost:8080 \
  -e VUS=50 -e HOLD=10m \
  --summary-export=loadtests/results/busy-day-summary.json \
  loadtests/k6/busy-day.js
```

Worst-case refresh:

```bash
k6 run -e BASE_URL=http://localhost:8080 \
  -e HERD_TARGET=comparison -e VUS=50 -e DURATION=2m \
  --summary-export=loadtests/results/herd-comparison-summary.json \
  loadtests/k6/thundering-herd.js
```

`HERD_TARGET` can be `summary`, `comparison`, `alerts`, `energy`, or `charts`.

## k6 Growth Probe

The monolith growth tests originally gave false confidence because generated
readings landed outside the month being measured. The target growth flow keeps
the same discipline: grow the local ingestion table backward from the measured
end date, analyze the database, then time the same date range.

Guarded local growth data:

```bash
ALLOW_LOCAL_PERF_GROWTH=yes TARGET_READING_ROWS=1000000 \
  ./scripts/grow-local-performance-data.sh
```

Probe the fixed page set after each data level:

```bash
k6 run -e BASE_URL=http://localhost:8080 \
  -e RUNS=20 \
  --summary-export=loadtests/results/growth-1m-summary.json \
  loadtests/k6/growth-probe.js
```

Suggested local levels mirror the source C cases but should be scaled to disk
and time available: `40000`, `1000000`, `4000000`, then stop if the curve is
already clear.

## k6 WebSocket Fanout

The target realtime gateway uses one `/ws` connection per browser. Each socket
mints a one-time token through `POST /ws/token`, then sends first-frame `AUTH`.

```bash
k6 run -e BASE_URL=http://localhost:8080 \
  -e WS_URL=ws://localhost:8080/ws \
  -e VUS=50 -e HOLD_SECONDS=30 \
  --summary-export=loadtests/results/ws-fanout-summary.json \
  loadtests/k6/websocket-fanout.js
```

## Pub/Sub Backlog

```bash
python -m loadtests.pubsub_backlog --mode burst --count 36000
```

Optional drain measurement if local Postgres is reachable from the host:

```bash
python -m loadtests.pubsub_backlog --mode burst --count 36000 \
  --watch-dsn postgresql://aquashield:local@localhost:5433/aquashield
```

## Kubernetes Job

Create a ConfigMap from the k6 scripts, then apply the manual Job template:

```bash
kubectl -n aquashield-dev create configmap aquashield-k6-scripts \
  --from-file=loadtests/k6 \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n aquashield-dev create secret generic aquashield-k6-credentials \
  --from-literal=password='loadtest-pass-2026' \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f loadtests/k6/kubernetes-job.yaml
kubectl -n aquashield-dev logs -f job/aquashield-k6-busy-day
```

For a full in-cluster rehearsal, render/apply `k8s/overlays/performance`.
For final cloud-native evidence through the managed GCP runtime and public API
edge, render/apply `k8s/overlays/performance-managed-public`. Both overlays set
`LOGIN_RATE_LIMIT` high enough on `identity-access-service-config` before the
Job starts.

## GitHub Actions

`.github/workflows/perf.yml` runs the same k6 scripts manually or from the
`performance-test` branch. Set `PERF_BASE_URL` as a repository variable, and
`LOADTEST_EMAIL_TEMPLATE` / `LOADTEST_PASSWORD` as secrets for non-local
environments. `LOADTEST_EMAIL` is still accepted for one-user smoke runs only.

## Evidence

Store final outputs under `docs/evidence/performance/`. Laptop or same-machine runs
are scenario rehearsals only. Submission-grade numbers should come from a cloud-native
load generator, such as the Kubernetes Job above or a CI k6 runner, against Docker
Compose full-platform or GKE. Do not use the monolith VM staging app as final
microservice evidence.

Do not quote runs where every VU uses the admin account. Those are useful smoke
tests only; final evidence should use `LOADTEST_EMAIL_TEMPLATE` so RBAC/session
lookups are not artificially warmed by one user.
