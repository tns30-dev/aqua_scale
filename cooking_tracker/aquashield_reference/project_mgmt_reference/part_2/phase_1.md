# Part 2 — Phase 1 — Types Refactor

---

## Goal

Reshape `frontend/src/types/profile.ts` to match the API DTO. This phase produces **no runtime change** — it's pure TypeScript so the rest of Part 2 has a target shape to compile against. Phase 5's directory delete is the final cut; Phase 1 sets up for that.

Concretely:

1. **`ProfileType = string`** — drop the closed `'shrimp' | 'fish' | 'crab_hatchery' | 'treatment'` union literal. Adding a profile in Django admin should not need a TS code change.
2. **`ProfileTheme`** — keep `primary` + `gradient.{from,to}`; **drop** `secondary` and `accent` (BE doesn't return them; no FE component reads them).
3. **`ProfileConfig`** — reshape to the camelCase DTO matching `/api/profile-types/` (after the Phase 2 mapper). Drop unused fields: `icon`, `displayName`, `parameters[]`, `priorityParameters[]`, `overview.metrics[]`.
4. **Drop dead sub-interfaces** — `ProfileParameter`, `ProfileMetric`, `ProfilePond` (verify no remaining usage first).
5. **Keep tsc clean** — `tsc --noEmit -p tsconfig.app.json` must exit 0 at the end. This is the success metric.

---

## Why type-first

Per `feedback_phase_doc_first.md` + standard refactor discipline: defining the target shape before touching call sites lets the compiler tell us every consumer that needs an update. Phases 2-5 will use the new types as their north star; if any phase produces TS errors, the gap surfaces immediately.

---

## Target shape

```ts
// frontend/src/types/profile.ts (after Phase 1)

/** Profile code as returned by /api/profile-types/. Free text, validated at runtime. */
export type ProfileType = string;

export interface ProfileTheme {
  primary: string;                       // hex, e.g. "#0C9286"
  gradient: { from: string; to: string };
}

/** ProfileConfig — camelCase DTO shape matching /api/profile-types/ after the
 *  snake→camel mapper in api.service.getProfileTypes(). */
export interface ProfileConfig {
  profileTypeId: string;                 // UUID
  code: string;                          // machine code, same as ProfileType
  name: string;                          // display label
  description: string | null;
  stageConfig: unknown;                  // JSONB — opaque to FE for now
  keyParameterIndicators: string[];      // never null after mapper (null → [])
  keyGrowthIndicators: string[];         // never null after mapper (null → [])
  theme: ProfileTheme;
}
```

**Removed** (with grep proof in the verification block):

- `ProfileParameter` — only referenced in the old hardcoded shrimp/fish profile files. Dies with `config/profiles/` in Phase 5; no live consumer.
- `ProfileMetric` — same fate; only used in `overview.metrics[]` which itself was unused.
- `ProfilePond` — appears defined in `types/profile.ts` but no grep hits outside the type file itself. Dead on arrival.
- `ProfileTheme.secondary` / `ProfileTheme.accent` — written to CSS vars `--profile-secondary` / `--profile-accent` in `ProfileContext`, but **no component reads either CSS var** (verified).
- `ProfileConfig.icon` — confirmed not referenced in any consumer (verified earlier in Part 2 prep).
- `ProfileConfig.displayName` — same.
- `ProfileConfig.parameters[]`, `priorityParameters[]`, `overview.metrics[]` — same.

---

## Compile fallout (predicted)

After Phase 1's type edit, these files will likely fail tsc until later phases land:

| File | Why it breaks | Fixed in |
|---|---|---|
| `config/profiles/index.ts` | Imports `ProfileConfig` with old field names; references `ProfileType` union for `Partial<Record<...>>` | Phase 5 (the whole dir gets deleted) |
| `config/profiles/shrimpProfile.ts` | Constructs `ProfileConfig` with old fields (`parameters`, `icon`, `displayName`, `theme.secondary` etc.) | Phase 5 |
| `config/profiles/fishProfile.ts` | Same | Phase 5 |
| `context/ProfileContext.tsx` | Imports `getProfileConfig` etc. from `config/profiles`; reads `theme.secondary`/`theme.accent` (lines 99-100) | Phase 3 |
| `components/layout/ProfileDropdown.tsx` | Imports `profiles` registry; uses `as ProfileType` cast | Phase 4 |

**Phase 1 deliberately leaves these broken** — fixing them is the work of Phases 2-5. To keep Phase 1 itself green, we'll temporarily exclude `config/profiles/**` from tsc compilation (or accept failures in those files only). The strict success criterion is `tsc --noEmit -p tsconfig.app.json` on **only the renamed/edited files** producing no errors caused by Phase 1's edits.

**Pragmatic alternative considered + rejected:** keep `ProfileType` as the old union literal in Phase 1, defer all changes to Phase 5. Rejected because Part 2's whole point is to drop the literal — the moment we make that change is the moment everything else has to adapt. Doing it last would mean a single mega-phase with all the breakage at once.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Pre-check — grep usage | Confirm `ProfileParameter`, `ProfileMetric`, `ProfilePond`, `displayName`, `icon`, `theme.secondary`, `theme.accent` have **no consumers outside `config/profiles/` and `types/profile.ts`** (those die in Phase 5). | grep — all confirmed dead outside config/profiles |
| 2 | [x] | Edit `types/profile.ts` — `ProfileType` | Replace `export type ProfileType = 'shrimp' \| 'fish' \| 'crab_hatchery' \| 'treatment';` with `export type ProfileType = string;`. | done |
| 3 | [x] | Edit `types/profile.ts` — `ProfileTheme` | Drop `secondary` and `accent` fields. Keep `primary` + `gradient`. | done |
| 4 | [x] | Edit `types/profile.ts` — `ProfileConfig` | Reshape per the Target shape block above (camelCase, DTO-aligned). Field types: see target. | done |
| 5 | [x] | Edit `types/profile.ts` — drop dead sub-interfaces | Remove `ProfileParameter`, `ProfileMetric`, `ProfilePond` (if unused per item 1). | done — all 3 dropped |
| 6 | [x] | Verification — tsc on the type file alone | `cd frontend && npx tsc --noEmit src/types/profile.ts` (or equivalent) exits clean. | profile.ts doesn't appear in tsc error list (item 7 confirms) |
| 7 | [x] | Verification — tsc fallout audit | Run `npx tsc --noEmit -p tsconfig.app.json`. The error list should be **exactly** the files predicted in the Compile fallout table above. Any unexpected file = the type edit broke something we didn't predict; revisit before declaring Phase 1 done. | 4/5 predicted files erroring (ProfileDropdown silently kept compiling — `string` is structural supertype of old union); 0 unexpected Phase-1-caused files. Other errors in output are pre-existing (HistoricalTrendsAnalysis_original.tsx, OnboardUserDialog.tsx, main.tsx, ForecastPage.tsx, 3 test files) — not Phase-1 fallout. |

---

## Verification Block — to run after item 5

```bash
cd frontend

# 1. Type-file-only sanity (this should be clean)
npx tsc --noEmit src/types/profile.ts

# 2. Full project tsc — expect failures ONLY in the predicted set
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out
echo "--- Files with errors ---"
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected `Files with errors` list:
- `src/config/profiles/index.ts`
- `src/config/profiles/shrimpProfile.ts`
- `src/config/profiles/fishProfile.ts`
- `src/context/ProfileContext.tsx`
- `src/components/layout/ProfileDropdown.tsx`

Any other file appearing in the list means Phase 1's edit caused an unforeseen cascade — investigate before moving on.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Hidden consumer of `theme.secondary` / `theme.accent` I missed in grep | Item 1 re-runs the grep against the just-edited file too; the tsc fallout audit catches any unexpected file. |
| Hidden consumer of `profileConfig.icon` etc. | Same — tsc surfaces it. |
| `ProfileType` widening to `string` may break narrow `if (x === 'shrimp')` switch statements somewhere | Free-string is intentional. If a consumer was relying on exhaustive narrowing, it'll surface in tsc fallout. If found, it's likely dead code anyway (Part 1 corrected the indicators-per-profile semantics; the FE no longer needs per-profile branching). |
| Build (vite) compiles fine but runtime breaks because field renames happened | Phase 3-5 handle the runtime side. Phase 1 deliberately leaves runtime alone. |

---

## Out of scope

| Item | Why |
|---|---|
| API client (`getProfileTypes()`) | Phase 2 |
| ProfileContext rewrite | Phase 3 |
| ProfileDropdown rewrite | Phase 4 |
| Deleting `config/profiles/` | Phase 5 |
| Browser smoke | Phase 6 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `types/profile.ts` matches the Target shape exactly |
| [x] | `ProfileType = string` (no union literal) |
| [x] | `ProfileTheme` is `{primary, gradient}` only |
| [x] | Dead sub-interfaces removed (`ProfileParameter`, `ProfileMetric`, `ProfilePond` — all 3 had zero non-self references) |
| [x] | `tsc --noEmit src/types/profile.ts` exits clean (no errors in profile.ts itself) |
| [x] | Full tsc fallout is the predicted file list — 4/5 expected files erroring + 0 surprise consumers; ProfileDropdown silently kept compiling because `string` widens the old union without breaking the consumer's lookup/cast |

---

## Files Touched in Phase 1

| File | What changed |
|---|---|
| `frontend/src/types/profile.ts` | `ProfileType` union → `string`. `ProfileTheme` dropped `secondary` + `accent`. `ProfileConfig` reshaped to camelCase API DTO (dropped `icon`, `displayName`, `parameters[]`, `priorityParameters[]`, `overview.metrics[]`). Removed `ProfileParameter`, `ProfileMetric`, `ProfilePond` if unused. |

---

*Last updated: 2026-05-22*
