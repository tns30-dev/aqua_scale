# Analytics Service — Parity Evidence (historical charts)

> **CORRECTION (2026-06-04, xsvc-readings ship):** the "UTC" timezone claim below was
> wrong — the monolith's active settings are `config/settings/base.py` with
> `TIME_ZONE='Asia/Singapore'` (the flat `settings.py` UTC file is shadowed dead code).
> The engine now buckets/labels in +08 (configurable `TZ_OFFSET_MINUTES`, default 480)
> and the readings window uses +08 day bounds. All 49 oracles re-anchored. See
> `docs/evidence/xsvc-readings/SHIP.md`.

Ship date: 2026-06-04. Source of truth: `AquaMonitoringv2/backend/module_chart/services/chart_service.py`
(engine) + `module_project/views.py:95-143` (contract) + `module_sensor/services.py` (`get_readings`).
Spec: `cooking_tracker/main/analytics_service.md`.

## What shipped

| Piece | Where |
|---|---|
| TS/Express service | `analytics-service/` (port 8090) |
| Chart engine parity port | `analytics-service/src/charts/engine.ts` + `python.ts` |
| Platform auth (TS port) | `analytics-service/src/auth/auth.ts` — RS256 JWT verify + fail-closed Redis snapshot (mirrors `common` JwtVerifier/AuthzSnapshotConsumer/SnapshotAuthFilter) |
| Chart-config seam | `ProjectService.GetChartConfig` (new RPC, `shared-api/src/main/proto/project.proto`) — project-service owns `visualisation_types`/`project_visualisations` (V3 migration, DDL parity vs monolith dump) |
| Pond-in-project check | existing `PondService.ValidatePondInProject` |
| Readings | existing `IngestionReadService.GetReadings` (the [XSVC] seam shipped with this task) |
| CI | `analytics-verify` + `analytics-container` jobs (path-aware: `analytics-service/**` + `shared-api/src/main/proto/**`); also fixed missing `pond-service` entry in the java matrix filters |

## Contract preserved (verbatim)

`GET /api/projects/{projectId}/charts/` — params `pondId` (required), `startDate`/`endDate`
(required, YYYY-MM-DD, inclusive), `grouping` (optional, default `auto`).

Validation order + exact error bodies (views.py:95-143):
1. project out of RBAC scope / unknown → 404 `{"detail": "Not found."}` (filtered-queryset parity, same envelope as project-service)
2. missing pondId → 400 `{"error": "pondId query parameter required"}`
3. pond not in project → 404 `{"error": "Pond not found in this project"}`
4. missing dates → 400 `{"error": "startDate and endDate are required."}`
5. bad date format → 400 `{"error": "Invalid date format. Use YYYY-MM-DD."}`
6. `endDate < startDate` → NOT rejected (parity): negative span → hourly grouping → empty window → empty package

Response keys (camelCase): `multiParameterTrends`, `correlationHeatmap`, `historicalTrends`,
`nitrogenCycle`, `temperatureTrend`, `dissolvedOxygen`, `diseaseRisk`, `waterQualityIndex`.
Parameter value keys stay snake_case (`dissolved_oxygen`) — never normalized.

## Parity behaviors deliberately replicated

- **Three top-level shapes**: enabled-keys-only (normal); ALL 8 keys (no readings OR builder threw);
  ALL 8 keys + fallback params `[temperature, ph, dissolved_oxygen, turbidity, ammonia, salinity]`
  (chart-config fetch failed — chart_service.py:88-90).
- **`y_parameters` empty vs missing**: configured-but-empty → `[]`; lookup failure → fallback defaults
  (chart_service.py:275-289). GetChartConfig returns resolved `parameter_code`s; unknown UUIDs drop silently.
- **Grouping**: auto = ≤3d hourly / ≤90d daily / 91+d weekly; explicit values pass through unvalidated;
  unknown strings behave as monthly (else-branch parity). Weekly buckets to the Monday (Python `weekday()`).
- **Buckets**: per-bucket arithmetic mean, Python `round(x, 2)` half-to-even on the exact decimal expansion
  (`python.ts round2` — `2.675 → 2.67`, `0.125 → 0.12`); a parameter key is OMITTED from a bucket entry with
  zero non-null samples; single-param builders drop empty buckets entirely; hourly labels keep RAW minutes
  (`%b %d %H:%M`), last reading wins the label.
- **correlationHeatmap**: fixed universe `[temperature, ph, dissolved_oxygen, turbidity]`, >1-sample params
  only, alphabetical order, POSITIONAL index pairing after min-length truncation (NOT timestamp-aligned),
  Pearson, zero-variance → 0.0, diagonal 1.0, labels via Python `str.title()` (`ph → "Ph"`).
- **`diseaseRisk` / `waterQualityIndex` are hard `[]`** — monolith stubs (chart_service.py:459-467). No WQI
  or risk formula exists server-side; the weights in the frontend tooltip are display copy only. Returning
  anything else would break parity.
- **Readings window**: `[startDate 00:00:00, endDate 23:59:59.999999]` UTC (monolith TIME_ZONE=UTC,
  `make_aware(combine(date, time.min/max))`), via `IngestionReadService.GetReadings`; ingestion errors behave
  like the monolith's `get_readings` catch-all → `[]` → empty package.

## Known boundary deltas (documented, accepted)

- Ingestion's GetReadings drops rows whose `values` map is empty (all-null readings). In the monolith such a
  row could still claim an hourly bucket *label*'s minutes. Practically unobservable; accepted.
- GetReadings clamps at 50 000 rows (`truncated` flag) — the monolith had no cap (unbounded query). Safety
  valve, documented in `ingestion.proto`.
- Malformed `pondId` (non-UUID): monolith would 500 (Django ValidationError); we return the 404 pond body.
- Pond/Project gRPC transport failure → 500 `{"error": "Internal server error"}` (no monolith equivalent —
  those checks were in-process).

## Redis usage (main/analytics_service.md cache rules)

- `analytics:chart-config:{projectId}` — chart METADATA only, TTL 60s (`CHART_CONFIG_CACHE_TTL_SECONDS`).
- Raw readings are NEVER cached (asserted by test `raw readings are NEVER written to Redis`).
- Config fetch errors are never cached (next request retries the source).
- NOTE for Codex: this key is new — main/redis.md key catalogue doesn't list an analytics section yet.

## Test evidence

- `analytics-service` vitest: **49/49 green** (`npm test`) — engine oracle cases 1–14 from the parity
  extraction (bucketing, grouping, heatmap incl. worked Pearson −0.5 oracle, package shapes), Python-round
  cross-checked against CPython output, auth fail-closed, verbatim error bodies, cache rules, real-gRPC
  wiring against the actual shared-api protos.
- `project-service` ITs: **10/10 green** (added `t10_grpcChartConfig_enabledRowsOnly_yParametersResolvedToCodes`).
- `ingestion-service` ITs: **10/10 green** (incl. `t08b_getReadings_servesPersistedRows`).
- Docker image builds from repo root (`docker build -f analytics-service/Dockerfile .`).
- `npm audit --omit=dev`: 0 vulnerabilities.

## Cloud-target notes (demo vs target)

- Readings come through the ingestion READ seam (Postgres demo store now; Bigtable swaps in behind the same
  `ReadingStore` seam — main/polyglot_persistence.md). BigQuery long-range analytics: future, not required
  for the parity endpoint.
- `GET /api/projects/{projectId}/chart-config/` (optional endpoint in the spec) not implemented — no monolith
  equivalent; parity first.
- Project create does NOT auto-seed `project_visualisations` (parity: the monolith seeded via manual SQL
  migrations). A project with no config rows gets `{}` for charts — same as the monolith. Demo seeding can be
  added to the demo dataset scripts later.

## CI verdict (post-push)

Run `26948392573` (push `e64bed7`, 2026-06-04): **SUCCESS — 22/22 jobs green.**
- `analytics-verify` (npm ci → tsc → 49 vitest → prod audit) ✓ in 21s
- `analytics-container` (image build + Trivy CRITICAL gate) ✓ in 40s
- `java-verify` fanned out to ALL SEVEN java services (proto change → shared filter) ✓
  — including `pond-service`, proving the path-filter fix (its first-ever CI run)
- all security gates (gitleaks / semgrep / trivy-fs / sbom) + 7 container scans ✓

Note (non-blocking): GitHub annotations warn `actions/checkout@v4`, `upload-artifact@v4`,
`setup-java@v4`, `dorny/paths-filter@v3` run on Node 20, deprecated 2026-06-16 — bump
action majors in a follow-up CI hygiene pass.
