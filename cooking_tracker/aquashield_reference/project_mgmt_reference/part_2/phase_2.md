# Part 2 — Phase 2 — API Client Method

---

## Goal

Add a single API client method — `apiService.getProfileTypes()` — that hits `GET /api/profile-types/` and returns `Promise<ProfileConfig[]>` in the camelCase shape defined by Phase 1.

This unblocks Phase 3 (`ProfileContext` refactor): once Phase 2 lands, the context can `await apiService.getProfileTypes()` on mount and get exactly the shape consumers expect.

---

## Scope

- **One method only**: `getProfileTypes(): Promise<ProfileConfig[]>`.
- **Snake→camel boundary mapper** lives inside this method (per D4). API returns snake_case; consumers see camelCase. The mapper is the only place that knows about both shapes.
- **No new files** — extend `frontend/src/services/api.service.ts`.
- **`getParameterTypes()` and `getGrowthIndicators()` are NOT added** — per Part 2 / overall.md "Out of scope": no current consumer. Add when a consumer needs them.

---

## Design

### Mapper

A pure function `mapProfileTypeDTO(raw)`. Lives in `api.service.ts` (private module-scope, not exported). Field-by-field:

| API field (snake) | DTO field (camel) | Coercion |
|---|---|---|
| `profile_type_id` | `profileTypeId` | identity |
| `code` | `code` | identity |
| `name` | `name` | identity |
| `description` | `description` | identity (may be `null`) |
| `stage_config` | `stageConfig` | identity (`unknown`) |
| `key_parameter_indicators` | `keyParameterIndicators` | **null → `[]`** |
| `key_growth_indicators` | `keyGrowthIndicators` | **null → `[]`** |
| `theme` | `theme` | identity (BE already returns `{primary, gradient: {from, to}}` shape — matches `ProfileTheme` post-Phase-1) |

Why null→[] for the two arrays: Phase 1's `ProfileConfig` types them as `string[]` (not nullable), so consumers don't need to write `?? []` at every read site. Treatment currently has `key_growth_indicators = null` in the seed — the mapper smooths that.

### Internal raw-shape type

```ts
// Lives in api.service.ts — not exported; describes only the API row.
interface ProfileTypeApiRow {
  profile_type_id: string;
  code: string;
  name: string;
  description: string | null;
  stage_config: unknown;
  key_parameter_indicators: string[] | null;
  key_growth_indicators: string[] | null;
  theme: { primary: string; gradient: { from: string; to: string } };
}
```

### Method body

```ts
async getProfileTypes(): Promise<ProfileConfig[]> {
  const response = await this.api.get<ProfileTypeApiRow[]>('/api/profile-types/');
  return response.data.map(mapProfileTypeDTO);
}
```

Trailing slash matters: `/api/profile-types/` matches the DRF DefaultRouter list URL.

### Auth + CSRF + interceptors

`this.api` is the shared axios instance with HttpOnly-cookie auth + the CSRF + 401-refresh interceptors. `getProfileTypes()` inherits all of that for free — no special handling needed.

---

## Where in `api.service.ts`

`api.service.ts` is 441 lines, organised by section comments (`// Authentication`, `// Ponds`, etc.). Adding a new `// Profile types` section. Insertion point: **after `getHistoricalData` and before any user-management methods** (the Ponds section ends around line 204; the next major section is further down). Specific placement doesn't affect behaviour — just lump it with related read endpoints.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Imports — `ProfileConfig` | At the top of `api.service.ts`, add `import type { ProfileConfig } from '../types/profile';`. (Not re-exported via `../types/index.ts` — direct path.) | done |
| 2 | [x] | Module-scope — `ProfileTypeApiRow` | Added the internal raw-shape interface just before the `ApiService` class. Not exported. | done |
| 3 | [x] | Module-scope — `mapProfileTypeDTO` | Added below `ProfileTypeApiRow`. Coerces `null` → `[]` for both indicator arrays via `?? []`. | done |
| 4 | [x] | Class method — `getProfileTypes` | Added `async getProfileTypes(): Promise<ProfileConfig[]>` to `ApiService` after `getHistoricalData`, under `// Profile types` section comment. | done |
| 5 | [x] | Verification — tsc clean | tsc fallout: `api.service.ts` has **zero** errors. Unique error-file list unchanged vs Phase 1 (4 Phase-1-caused + 7 pre-existing). | tsc output ✅ |
| 6 | [ ] | Verification — integration smoke (optional, if BE is reachable) | Confirm the method returns the expected shape against the running BE. Can be done from a small browser console snippet or by checking the network tab when Phase 3 lands. | deferred to Phase 3 wiring |

---

## Verification Block — to run after item 4

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out
echo
echo "=== api.service.ts errors (must be ZERO) ==="
grep -E "^src/services/api\.service\.ts" /tmp/tsc.out | head
echo
echo "=== unique files with errors ==="
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected:
- `api.service.ts` produces **zero** lines in the grep output.
- The unique-files list is unchanged from Phase 1's final state (4 Phase-1-caused files + the pre-existing noise set).

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| The BE returns a paginated response shape instead of a flat list | Phase 7 set `pagination_class = None` on the ViewSet — verified during Phase 9 smoke (response is a plain array). If pagination ever re-appears, the mapper would crash visibly on `response.data.map`. |
| The BE returns a row with malformed `theme` (e.g., legacy `#888888` placeholder for unseeded rows) | Phase 8 seeded real themes; Phase 9 verified no `#888888` left. Mapper passes `theme` through as-is — even if a future row is malformed, consumers fall back to the loading-state stub per D6. |
| Trailing slash mismatch | Existing endpoints use trailing slash (`/api/projects/`). Use `/api/profile-types/`. Tested in Phase 7 smoke. |
| Mapper drops `null` defaults silently — consumers might want to distinguish `null` from `[]` | Phase 1 typed the arrays as non-nullable `string[]`. The intent is "no key indicators = empty list". `null` is treated as that intent. |

---

## Out of scope

| Item | Why |
|---|---|
| `getParameterTypes()` | No current FE consumer. Adding it now is YAGNI. |
| `getGrowthIndicators()` | Same. |
| Caching layer (memoise the response across multiple Provider mounts) | Phase 3 owns the in-memory cache; the API client stays a thin pass-through. |
| Error retry / backoff | Inherits from the shared axios instance. |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `apiService.getProfileTypes` exists with signature `(): Promise<ProfileConfig[]>` |
| [x] | Snake→camel mapper present and handles `null → []` for the two indicator arrays |
| [x] | tsc clean for `api.service.ts` — no new errors caused by Phase 2 |

---

## Files Touched in Phase 2

| File | What changed |
|---|---|
| `frontend/src/services/api.service.ts` | Added `ProfileConfig` import; added internal `ProfileTypeApiRow` interface + `mapProfileTypeDTO` function; added `getProfileTypes()` method to `ApiService` class under a `// Profile types` section. |

---

*Last updated: 2026-05-22*
