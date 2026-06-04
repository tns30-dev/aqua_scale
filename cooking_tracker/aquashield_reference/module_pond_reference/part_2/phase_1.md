# Part 2 — Phase 1 — Types Reshape

---

## Goal

Reshape `frontend/src/types/index.ts` to absorb the Part-1 BE additions cleanly:

1. **Rename FE `Pond.status` → `Pond.healthStatus`** (Option A from the naming-collision discussion). The ephemeral, sensor-derived UI signal gets the more-qualified name.
2. **Add `Pond.status`** typed as the BE operational enum (`'active' | 'draining' | 'cleaning' | 'maintenance' | 'decommissioned'`).
3. **Loosen `PondMetadata`** to tolerate both observed shapes (shrimp/fish 6 fields + crab 9 fields) — every field optional; renderer shows whatever keys are present.
4. **Add `Treatment` + `PondTreatment` types** matching the new BE serializers (snake_case fields; FE methods in Phase 2 will map to camelCase if needed).

Plus the cascade: every FE site that reads `pond.status` needs to point at `pond.healthStatus`. Bounded — ~5 files.

---

## Naming-collision decision (carry-over from overall.md)

**Option A locked**: FE `status` → `healthStatus`. BE `status` flows through as `status` on FE with operational semantics. Rationale: the persistent DB field gets the unqualified name; the locally-computed UI signal gets the more-specific name.

---

## Target shapes

### `Pond` interface (after)

```ts
export type PondHealthStatus = 'healthy' | 'warning' | 'critical' | 'no_reading';
export type PondOperationalStatus =
  | 'active' | 'draining' | 'cleaning' | 'maintenance' | 'decommissioned';

export interface Pond {
  pond_id: string;
  project_id: string;
  profile_type?: Theme;
  name: string;
  description?: string | null;
  metadata?: PondMetadata;
  photo_url?: string;

  // Operational state — set by admin, from BE column `ponds.status`.
  status: PondOperationalStatus;

  // Sensor-derived UI signal — recomputed locally on every reading.
  // Renamed from `status` so the unqualified `status` aligns with BE.
  healthStatus: PondHealthStatus;

  lastUpdated: string;
}
```

### `PondMetadata` (loosened)

```ts
// Live data shows two shapes:
//   - shrimp/fish ponds (11 of 16): biomass_kg, growth_rate_percent_per_day, ...
//   - crab tanks (5 of 16): larvae_count, target_species, current_stage, ...
// Every field optional; renderer shows whichever keys exist for the given pond.
export interface PondMetadata {
  // Shared across all shapes
  company_name?: string;
  gps_location?: string;
  disease_risk?: 'low' | 'medium' | 'high';
  estimated_harvest_date?: string;

  // Shrimp / fish shape
  biomass_kg?: number;
  growth_rate_percent_per_day?: number;

  // Crab hatchery shape
  larvae_count?: number;
  current_stage?: string;
  days_in_stage?: number;
  survival_rate_percent?: number;
  target_species?: string;

  // Forward-compat: unknown future keys
  [key: string]: unknown;
}
```

### `Treatment` + `PondTreatment` (new)

```ts
export interface Treatment {
  treatment_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PondTreatment {
  pond_treatment_id: string;
  pond: string;                     // pond_id UUID
  treatment: string;                // treatment_id UUID
  treatment_name: string;           // denormalised from BE serializer
  treatment_code: string;           // ditto
  treatment_description?: string | null;
  started_at: string;               // ISO date
  ended_at?: string | null;
  notes?: string | null;
  is_active: boolean;               // BE-computed (ended_at IS NULL)
  created_at: string;
  updated_at: string;
}
```

Snake_case fields match the BE serializer output 1:1 — no per-field mapping in Phase 2.

---

## Cascade — FE consumers of `pond.status` to update

From a grep audit:

| File | Line(s) | What it does | Change |
|---|---|---|---|
| `types/index.ts` | 66 | Pond interface declaration | Rename field |
| `components/overview/PondGrid.tsx` | 13 | `p.status === 'healthy'` count | `p.healthStatus === 'healthy'` |
| `components/overview/PondCircle.tsx` | 23, 45, 58, 65, 71, 72, 76 | Visual rendering (color, badges) | All `pond.status` → `pond.healthStatus` |
| `pages/OverviewPage.tsx` | 80 | `pond.status !== newStatus` comparison | `pond.healthStatus !== newStatus` |
| `utils/pondStatusCalculator.ts` (returns the value) | (probably) | Computes the new status | No change to return type; caller assigns to `healthStatus` instead of `status` |

`PondVisualization.tsx:139` and `ParameterGrid.tsx:40` use `status` for **sensor params** (not pond), so unrelated. False positives in initial grep.

After this phase the **only** consumers of `pond.status` will be Phase 3's new badge component(s).

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `types/index.ts` — add `PondHealthStatus` + `PondOperationalStatus` aliases | Two `type` exports at the top of the Pond block. | grep |
| 2 | [x] | `types/index.ts` — `Pond` interface | Rename `status` → `healthStatus`; add `status: PondOperationalStatus`. | grep |
| 3 | [x] | `types/index.ts` — `PondMetadata` interface | All existing fields → optional; add the 5 crab-shape fields (also optional); add `[key: string]: unknown`. | grep |
| 4 | [x] | `types/index.ts` — `Treatment` interface (new) | snake_case, matches BE TreatmentSerializer. | grep |
| 5 | [x] | `types/index.ts` — `PondTreatment` interface (new) | snake_case + denormalised treatment_name/code/description from BE PondTreatmentSerializer. | grep |
| 6 | [x] | `components/overview/PondGrid.tsx` | `p.status === 'healthy'` → `p.healthStatus === 'healthy'`; line 44-46 wrap also moved to `healthStatus`. | tsc |
| 7 | [x] | `components/overview/PondCircle.tsx` | Introduced local `healthStatus = pond.healthStatus ?? 'no_reading'`; all 8 usages routed through it. | tsc |
| 8 | [x] | `pages/OverviewPage.tsx` | All 3 `status` references in the liveReadings effect (no_reading branch, comparison, assignment) → `healthStatus`. | tsc |
| 9 | [x] | Any other `pond.status` consumer surfaced by tsc | tsc surfaced **PondDetailsPanel.tsx** (8 errors from `PondMetadata` loosening — fixed with inline `?? 'low'` and date guard, full reshape stays in Phase 4) and the two unit-test fixtures **PondCircle.test.tsx** + **PondGrid.test.tsx** (renamed fixture `status` → `healthStatus`; also added missing `project_id` field which had been latent/masked). | tsc |
| 10 | [x] | Verification — tsc | After cascade: only pre-existing-noise files remain (HistoricalTrendsAnalysis_original.tsx, OnboardUserDialog.tsx, main.tsx, PondVisualization.test.tsx). No files we touched produce errors. | tsc output |

---

## Verification Block — after item 9

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
echo "=== unique files with errors ==="
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected: the unique-files list contains only pre-existing noise (same as the end of project-mgmt Part 2). No files we touched in this phase should appear (the rename should compile cleanly).

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| The BE response carries `status` as the operational enum; FE pondStore.updateReading() also writes to `pond.status` (was the sensor health) | After this phase, the calculator's return value is assigned to `pond.healthStatus`, NOT `pond.status`. The BE-returned `status` populates the operational field. They no longer collide. |
| Existing snapshot of pond data in localStorage / Zustand might be missing `healthStatus` until a fresh reading lands | Acceptable — the calculator runs on the first WebSocket reading and fills it. Until then the cards show `'no_reading'` (which is the calculator's initial-state value anyway). |
| Pond rows from `/api/ponds/` have `status` (operational, from BE) but no `healthStatus` yet (sensor-derived, FE-only). | Both fields coexist on the type, but `healthStatus` may be missing on a freshly-loaded pond until the first reading arrives. Type it as required for now and let the calculator backfill on every reading. If a tsc complaint arises about it being missing in API responses, we'll add a default in the mapper. |
| `PondMetadata` going from strict to loose may lose autocomplete for shrimp consumers | Acceptable. Renderer iterates `Object.entries(metadata)` and displays each pair generically — no consumer relies on field-level autocomplete. |
| New `Treatment` / `PondTreatment` types unused until Phase 2 | Type definitions sit; phase 2 imports + uses them. Standard. |

---

## Out of scope

| Item | Where |
|---|---|
| api.service methods + mapper | Phase 2 |
| Status badge rendering | Phase 3 |
| Treatments timeline UI | Phase 4 |
| FE-side status enum validation | Out of scope — TypeScript narrowing covers the common case |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `Pond` interface has both `status` (operational) + `healthStatus` (sensor) — both optional in Phase 1, will tighten in Phase 2 |
| [x] | `PondMetadata` is loosened to optional + indexed |
| [x] | `Treatment` + `PondTreatment` types added |
| [x] | All FE consumers of `pond.status` (sensor) renamed to `pond.healthStatus` |
| [x] | tsc fallout list unchanged vs pre-Phase-1 baseline (no new errors) |

---

## Files Touched in Phase 1

| File | What changed |
|---|---|
| `frontend/src/types/index.ts` | `Pond.status` renamed → `healthStatus`; new `Pond.status` for operational enum (both optional in Phase 1); `PondMetadata` loosened (all optional + crab fields + index signature); new `Treatment` + `PondTreatment` interfaces. |
| `frontend/src/components/overview/PondGrid.tsx` | `p.status === 'healthy'` count → `p.healthStatus`; wrap copies now set `healthStatus` instead of `status`. |
| `frontend/src/components/overview/PondCircle.tsx` | Local `const healthStatus = pond.healthStatus ?? 'no_reading'`; all 8 usages (effect dep, colour index, badge conditions, badge text) routed through it. |
| `frontend/src/pages/OverviewPage.tsx` | All 3 references in the liveReadings effect (no_reading branch, comparison, assignment) switched to `healthStatus`. |
| `frontend/src/components/digital-twin/PondDetailsPanel.tsx` | Extracted local `DiseaseRisk` type (replaces `Record<PondMetadata['disease_risk'], ...>`); `metadata.disease_risk` indexed with `?? 'low'`; `metadata.estimated_harvest_date` rendered with `? ... : 'N/A'` guard. Minimal fix — full profile-aware reshape stays scheduled for Phase 4. |
| `frontend/src/test/components/PondCircle.test.tsx` | Fixture `status: 'healthy'\|...` → `healthStatus: ...`; added missing `project_id` field. |
| `frontend/src/test/components/PondGrid.test.tsx` | Same — fixture `status` → `healthStatus`; added missing `project_id` field. |

---

*Last updated: 2026-05-23*
