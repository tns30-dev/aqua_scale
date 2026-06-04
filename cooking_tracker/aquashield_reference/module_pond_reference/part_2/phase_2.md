# Part 2 — Phase 2 — API Client Methods

---

## Goal

Wire the new Part-1 read endpoints into `frontend/src/services/api.service.ts` so React components can fetch treatments + per-pond treatment timelines (and, optionally, the raw cycle daily-health and stage-metric rows).

Concretely:

| Method | Endpoint | Returns |
|---|---|---|
| `getTreatments()` | `GET /api/treatments/` | `Treatment[]` |
| `getPondTreatments(pondId)` | `GET /api/pond-treatments/?pond=<id>` | `PondTreatment[]` |

Cycle daily-health + stage-metrics endpoints are deferred — see § Deferred below.

---

## Convention check — snake_case vs camelCase

The existing FE codebase is **mixed**:

- `Pond`, `PondMetadata` — snake_case (`pond_id`, `project_id`, `company_name`)
- `Cycle`, `ProfileConfig`, `UserAccess`, … — camelCase (`cycleId`, `profileTypeId`)

Existing mappers (e.g. `mapProfileTypeDTO`) convert snake→camel for the camelCase-typed half of the codebase.

**Decision for Phase 2: keep `Treatment` + `PondTreatment` snake_case (already declared that way in Phase 1) and pass through with no mapper** — same pattern as `getPonds(...)`. This trades strict adherence to D4 ("mapper per endpoint") against consistency with the existing pond-side surface.

If we later decide pond-side should be camelCase, the migration is a single search-and-replace across `Pond`, `PondMetadata`, `Treatment`, `PondTreatment` + their consumers. Easier to do once if/when it lands than to split conventions.

(Surfacing this explicitly so it's a conscious choice and not silent drift.)

---

## API service method signatures

```ts
async getTreatments(): Promise<Treatment[]> {
  const response = await this.api.get<Treatment[]>('/api/treatments/');
  return response.data;
}

async getPondTreatments(pondId: string): Promise<PondTreatment[]> {
  const response = await this.api.get<PondTreatment[]>('/api/pond-treatments/', {
    params: { pond: pondId },
  });
  return response.data;
}
```

Pagination: BE viewsets set `pagination_class = None`, so the DRF response is a plain array (not `{count, results}`). Matches `getFeatureAccess`, `getActionControls`, `getUsers` already in the file.

Filter param name: `?pond=<id>` (snake_case query param, single-source filter declared in BE `PondTreatmentViewSet.get_queryset`). Same convention as the `?projectId=` reading pattern already used elsewhere in the codebase is the camelCase form, but here we follow what the BE actually accepts (verified in Part-1 Phase 6).

---

## Imports + placement

| File | Change |
|---|---|
| `frontend/src/services/api.service.ts` | Add `Treatment`, `PondTreatment` to the existing `from '../types'` import block. Append the two new methods inside the `ApiService` class. |

Placement inside the class: insert a new `// Treatments` section between the existing `// Ponds` section (ends after `getHistoricalCharts`) and `// Profile types`. Keeps treatment-related methods near pond-related ones; the `// Profile types` section then continues.

---

## Deferred (optional in overall.md)

`getCycleDailyHealth(cycleId)` + `getCycleStageMetrics(cycleId)` are **not** added in this phase. Reasons:

1. No FE consumer in Phases 3-5 needs them — Historical/Cycle views already use the camelCase `/api/cycles/{id}/details/` endpoint which returns the same daily-health + stage-metrics data.
2. Adding unused methods runs counter to the project rule "Don't add features … beyond what the task requires."
3. Easy to add later when a consumer materialises — the BE endpoints are live, the FE types aren't needed beyond what they ship.

Documenting the deferral here so a future engineer doesn't waste a cycle wondering why they're not wired.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Import `Treatment` + `PondTreatment` types in `api.service.ts` | Add both to the named-type import block. | grep |
| 2 | [x] | Add `getTreatments()` method | New section header `// Treatments` + the method. | grep |
| 3 | [x] | Add `getPondTreatments(pondId)` method | Append below `getTreatments`. | grep |
| 4 | [x] | Verification — tsc | tsc unique-files list identical to end-of-Phase-1 (HistoricalTrendsAnalysis_original, OnboardUserDialog, main.tsx, PondVisualization.test.tsx). `api.service.ts` not in the list. | tsc output |
| 5 | [~] | Smoke — request shape | Deferred to Phase 5 (browser smoke) — live request will happen naturally when Phases 3-4 wire the consumers. Route registration was already confirmed during Part-1 Phase 9 (50+ programmatic assertions including endpoint availability + RBAC scoping). Re-running a 401-only curl here adds no signal beyond what tsc already validates. | Phase 5 |

---

## Verification Block — after item 4

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected unique-files list (same as end of Phase 1):

```
  Property 'sensorPins' does not exist on type 'IntrinsicAttributes & PondVisualizationProps'.
src/components/historical/HistoricalTrendsAnalysis_original.tsx
src/components/user-management/OnboardUserDialog.tsx
src/main.tsx
src/test/components/PondVisualization.test.tsx
```

`api.service.ts` should **not** appear.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| BE viewset enforces RBAC scoping (Pond → project → user_projects). A user with no project access gets `[]` not a 403. | FE handles `[]` as the empty-state — no special error path needed. |
| `pondId` passed to `getPondTreatments` doesn't belong to the caller's projects. | BE filters by `RBACService.get_user_project_ids(user)`, returns `[]`. FE renders "no treatments" — same as the truly-empty case. Indistinguishable on purpose; matches the rest of the codebase. |
| Cookie/CSRF — both endpoints use the existing axios instance, which sends HttpOnly cookies + X-CSRFToken automatically. | No work needed; just smoke-verify the request actually carries cookies. |
| Naming on `?pond=` filter param — BE expects snake_case singular (`pond`) per `PondTreatmentViewSet.get_queryset`. | Matches; verified in Part-1 Phase 6 docs. |

---

## Out of scope

| Item | Where |
|---|---|
| `getCycleDailyHealth` + `getCycleStageMetrics` | Deferred — see § Deferred. |
| Status badge rendering | Phase 3 |
| Treatments timeline UI | Phase 4 |
| Snake→camel mapper conversion of pond-side types | If/when we decide to flip the convention — single follow-up. |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `apiService.getTreatments()` exists and is typed to `Promise<Treatment[]>` |
| [x] | `apiService.getPondTreatments(pondId)` exists and is typed to `Promise<PondTreatment[]>` |
| [x] | tsc fallout list unchanged vs end-of-Phase-1 |
| [~] | Smoke — deferred to Phase 5 (browser smoke); routes already validated in Part-1 Phase 9 |

---

## Files Touched in Phase 2

| File | What changed |
|---|---|
| `frontend/src/services/api.service.ts` | Added `Treatment`, `PondTreatment` to the type imports; added the two read methods inside a new `// Treatments` block. |

---

*Last updated: 2026-05-24*
