# Phase 1 — Build + Unit/Integration Tests (2026-08-09)

Same commands as the CI pipeline (`.github/workflows/ci.yml` java-verify /
analytics-verify jobs; `frontend-ci-cd.yml` for the frontend), run locally
against the full reactor. Raw logs kept in the session scratchpad; surefire
(unit) and failsafe (integration) reports under each `*/target/`.

## Java reactor — `mvn -B -ntp clean verify`

Result: **BUILD SUCCESS**, all 11 modules, **127 tests, 0 failures, 0 errors**.

| Module | Result | Time |
|---|---|---|
| AquaShield Common | SUCCESS | 1.5 s |
| Shared API Contracts | SUCCESS | 2.9 s |
| Identity and Access Service | SUCCESS (19 unit + 15 IT) | 18.5 s |
| Project Service | SUCCESS (8 + 11) | 10.9 s |
| Sensor Service | SUCCESS (8) | 6.2 s |
| Ingestion Service | SUCCESS (10 IT, Testcontainers) | 2:09 min |
| Notification Service | SUCCESS (7) | 1:20 min |
| Realtime Gateway | SUCCESS (5) | 11.2 s |
| Pond Service | SUCCESS (19 + 8) | 7.6 s |
| Audit Service | SUCCESS (7) | 12.3 s |

Artifacts: 4 modules with `target/surefire-reports/` (unit), 8 with
`target/failsafe-reports/` (Testcontainers integration) — the same paths
`ci.yml` uploads as its Test Evidence artifact.

## Analytics service (TypeScript) — `npm ci && npm run build && npm test`

Result: **PASS** — tsc build clean, **50/50 vitest tests pass** (4 files:
python 9, engine 21, grpc 3, api 17).

`npm audit --omit=dev --audit-level=high`: gate PASS; 1 low + 1 moderate
reported → carried into the Phase 7 findings table.

## Frontend — `npm run lint && npx vitest run && npm run build`

Result: **build PASS, tests/lint FAIL — recorded as findings, not fixed here.**

| Check | Result |
|---|---|
| `vite build` | PASS (2,655 modules) |
| `eslint` | FAIL — 1 error: `src/components/feeding/treatmentMarksPlugin.ts:23` unused type var `TType` (+19 warnings) |
| `vitest` | FAIL — 96 pass, **10 fail**, 8 skipped (114 total) |

Failing files: `src/test/pages/LoginPage.test.tsx` (8) and
`src/test/components/TopNav.test.tsx` (2). These tests drifted from the
current LoginPage/TopNav implementations during the in-flight second-round UI
work (owned by Codex). Per the no-conflict rule, CI duty records the failure
and hands it to the frontend owner instead of editing files under active
change. Follow-up tracked in the Phase 7 findings table and the tracker
summary for Codex.

## Phase verdict

| Lane | Verdict |
|---|---|
| Java build + unit + integration (127 tests) | PASS |
| Analytics build + tests (50) + prod audit gate | PASS |
| Frontend build | PASS |
| Frontend lint + tests | FAIL (10 tests, 1 lint error — Codex-side drift, flagged) |
