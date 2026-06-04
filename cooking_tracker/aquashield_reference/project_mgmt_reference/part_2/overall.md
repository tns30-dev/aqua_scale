# Part 2 — Frontend Consolidation

> Retire `frontend/src/config/profiles/`. Drive `ProfileContext` from `/api/profile-types/`. Make adding a new profile in Django admin propagate to the React app immediately on next session refresh.

---

## Why this part

Part 1 delivered the backend half of the arc — corrected schema, relocated models, polished admin, real per-profile theme JSONB, three new API endpoints. The FE still reads from hardcoded TS literals:

- `frontend/src/types/profile.ts` declares `ProfileType = 'shrimp' | 'fish' | 'crab_hatchery' | 'treatment'` — a closed union literal. Adding a profile in Django admin won't help; the FE can't see it.
- `frontend/src/config/profiles/{shrimpProfile,fishProfile}.ts` and inlined defs in `index.ts` carry per-profile colours, parameters, icons. These are now duplicated in the DB; the FE should pull from there.
- `frontend/src/context/ProfileContext.tsx` imports `getProfileConfig` / `isValidProfile` / `getDefaultProfile` from the hardcoded module — these all become API-derived.

Part 2 cuts the hardcoded dependency entirely. The `config/profiles/` directory **gets deleted** by the end of Part 2 — not refactored, not repurposed. DB is the source.

---

## Current FE audit (from grep on 2026-05-22)

| File | What it does | Touch in Part 2? |
|---|---|---|
| `types/profile.ts` | `ProfileType` union literal + `ProfileConfig`/`ProfileTheme`/`ProfileParameter`/`ProfileMetric` interfaces | **Phase 1** — drop union, reshape `ProfileConfig`, drop unused sub-interfaces |
| `config/profiles/index.ts` | Hardcoded registry + `getProfileConfig` / `isValidProfile` / `getDefaultProfile` / `getAvailableProfiles` helpers | **Phase 5** — delete entire dir |
| `config/profiles/shrimpProfile.ts` | Hardcoded shrimp config | **Phase 5** — delete |
| `config/profiles/fishProfile.ts` | Hardcoded fish config | **Phase 5** — delete |
| `services/api.service.ts` | API client; no profile-types method yet | **Phase 2** — add `getProfileTypes()` |
| `context/ProfileContext.tsx` | Uses hardcoded helpers; writes CSS vars `--profile-secondary` and `--profile-accent` (unused per grep) | **Phase 3** — rewrite to fetch + cache; drop unused CSS-var writes |
| `components/layout/ProfileDropdown.tsx` | Imports `profiles` registry directly | **Phase 4** — drop direct import, rely on Context |
| `components/layout/Sidebar.tsx` | Reads `profileConfig.theme.primary` + `gradient.from/to` | **No change** — these keys exist in the new shape |
| `components/digital-twin/PondDetailsPanel.tsx` | Reads `profileConfig.theme.primary` | **No change** |
| `components/digital-twin/PondVisualization.tsx` | Reads `profileConfig.theme.primary` | **No change** |
| `utils/auth.ts` | localStorage key `currentProfileType` (string, no type narrowing) | **No change** — already string-typed |

**Dead theme fields** confirmed unused: `theme.secondary`, `theme.accent`. Only `--profile-primary`, `--profile-gradient-from`, `--profile-gradient-to` CSS vars are read by components. The BE intentionally dropped `secondary`/`accent` from theme JSONB during Phase 1 design (D2).

**Dead `ProfileConfig` fields** confirmed unused: `icon`, `displayName`, `parameters[]`, `priorityParameters[]`, `overview.metrics[]`. The Phase 1 design baked this in — DB doesn't carry them.

---

## Resolved decisions

### D4 — snake_case vs camelCase from `/api/profile-types/` — FE-side mapper

BE exposes inconsistent conventions:
- `/api/auth/login` → camelCase (`profileType`, `projectId`, `profileTypeId`) — manually defined in `module_user.serializers`.
- `/api/profile-types/` → snake_case (`profile_type_id`, `key_parameter_indicators`, etc.) — DRF default from ModelSerializer.

Three options were on the table:
- A. Change Phase 7 ViewSets to camelCase manually — touches BE we just shipped + needs re-smoke.
- B. Snake_case in FE — breaks the FE convention (project, pond are camelCase) and surfaces inconsistency in consumers.
- C. **FE-side mapper in `getProfileTypes()`** — converts snake → camel once at the API boundary; consumers see clean camelCase. Cheap, contained.

Going with **C**. The mapper is ~4 fields; type-safe; localized. Future cleanup can promote camelCase to the BE serializers if/when other consumers grow.

### D5 — Default profile selection — first API result, then localStorage

Old behavior: `getDefaultProfile()` returned hardcoded `'shrimp'`.

New behavior:
1. On mount, fetch `/api/profile-types/`.
2. If localStorage has a stored profile AND it's in the fetched list → use it.
3. Else: first entry from the fetched list (sorted by `code`).
4. Realign once `session.projects` loads (existing logic preserved).

### D6 — What happens during the API fetch loading state?

Profile-config fetch happens at app boot via `ProfileContext`. Until it resolves:
- `currentProfile` is `''` (empty string — typed as `string` per Phase 1's union drop).
- `profileConfig` is `null` — consumers must handle.

But — `Sidebar`, `PondDetailsPanel`, `PondVisualization` all read `profileConfig.theme.primary`. To avoid every consumer adding null-checks, the Context returns a **stub profileConfig** during loading (placeholder theme `#888888`/`#cccccc` — exactly the Phase 1 BE placeholder, reused). Once the API resolves, the real value swaps in. Single-render flash is acceptable.

---

## Target state (after Part 2)

```text
frontend/src/types/profile.ts
  OK  ProfileType = string                    // no enum
  OK  ProfileTheme = {primary, gradient}      // no secondary/accent
  OK  ProfileConfig = (API DTO shape, camelCase)

frontend/src/config/profiles/                 ← DELETED ENTIRELY

frontend/src/services/api.service.ts
  OK  getProfileTypes()                       // returns ProfileConfig[]

frontend/src/context/ProfileContext.tsx
  OK  Fetch /api/profile-types/ on mount
  OK  Cache in state; expose same useProfile() shape
  OK  Stub profileConfig during loading

frontend/src/components/layout/ProfileDropdown.tsx
  OK  Drop import from config/profiles
  OK  Use Context

(other components: no change — they consume keys that still exist)
```

---

## Phases

| # | Title | Goal |
|---|---|---|
| 1 | Types refactor | Reshape `types/profile.ts` to API DTO shape; drop union literal; drop unused sub-interfaces. tsc clean. |
| 2 | API client method | Add `getProfileTypes()` to `api.service.ts` with snake→camel mapper. |
| 3 | ProfileContext refactor | Rewrite to fetch on mount, cache, stub during loading. Remove unused CSS-var writes. |
| 4 | ProfileDropdown cleanup | Drop direct `profiles` import. |
| 5 | Delete `config/profiles/` | Verify no remaining imports; remove the directory in full. tsc clean. |
| 6 | Browser smoke | Login → dashboard → overview → historical. Confirm theme colours render from API. Add a new profile via Django admin and confirm it appears in the dropdown after re-login. |

---

## Out of scope

| Item | Why |
|---|---|
| Tests (FE) | Spec moving; manual smoke is sufficient for this arc per CLAUDE.md. |
| `getParameterTypes()` / `getGrowthIndicators()` API clients | Not consumed by current FE — defer until a consumer needs them. |
| Stage editor / FE rendering of growth indicators | Part 3 polish. |
| Backend serializer convention unification (snake↔camel) | Out of scope per D4. |
| Two-repo port | Standard workflow: port to prod on explicit user signal after each phase or at end. |

---

## Engineering rules carry-over

- One checklist item per edit. Track in phase doc immediately.
- `phase_N.md` written BEFORE executing the phase.
- `tsc --noEmit -p tsconfig.app.json` clean per phase.
- Browser smoke is the acceptance test — no FE unit tests in scope.
- No auto-commits. Port to prod on explicit user signal.

---

## Phase status

```text
Part 2 (Frontend consolidation)
  Phase 1 (Types refactor)              TODO  -> part_2/phase_1.md (drafted, awaiting cook)
  Phase 2 (API client method)           TODO
  Phase 3 (ProfileContext refactor)     TODO
  Phase 4 (ProfileDropdown cleanup)     TODO
  Phase 5 (Delete config/profiles/)     TODO
  Phase 6 (Browser smoke)               TODO
```

---

*Last updated: 2026-05-22*
