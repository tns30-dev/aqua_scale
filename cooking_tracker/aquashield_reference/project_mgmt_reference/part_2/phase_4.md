# Part 2 — Phase 4 — ProfileDropdown Cleanup

---

## Goal

Drop the last external import from `frontend/src/config/profiles/`. After Phase 4, the directory has **zero external consumers** and Phase 5 can delete it cleanly.

The lone hold-out is `ProfileDropdown.tsx:10`:

```ts
import { profiles } from '../../config/profiles/index';
```

It's used in exactly one place — the click handler guards on `if (profiles[profileType]) switchProfile(profileType)`. With Phase 3's catalogue-aware ProfileContext, that guard is redundant: the new realignment effect snaps `currentProfile` to a valid code on the next tick if an invalid one slips through. The guard can go.

---

## Current ProfileDropdown click handler

```ts
function handleProjectClick(project: Project) {
  setCurrentProjectId(project.projectId);
  setCurrentProfileType(project.profileType);

  const profileType = project.profileType as ProfileType;
  if (profiles[profileType]) {
    switchProfile(profileType);
  }
  setIsOpen(false);
}
```

## After Phase 4

```ts
function handleProjectClick(project: Project) {
  setCurrentProjectId(project.projectId);
  setCurrentProfileType(project.profileType);
  switchProfile(project.profileType);
  setIsOpen(false);
}
```

Changes:
- Drop the `profiles` import.
- Drop the `as ProfileType` cast — `ProfileType = string` post Phase 1, and `switchProfile`'s parameter is already `ProfileType`.
- Drop the guard — Phase 3's realignment effect already handles unknown codes.

---

## Why dropping the guard is safe

Pre-Phase-3 logic: "only call switchProfile if the chosen code exists in the hardcoded registry; otherwise silently do nothing."

Post-Phase-3 logic: `switchProfile(code)` schedules a `setCurrentProfile(code)` after 150ms. The next render sees the new `currentProfile`. If `code` doesn't match any catalogue entry, the realignment `useEffect` immediately picks `userProfiles[0]` or `profiles[0].code` instead. Net effect: at most one render frame of stale state, then the correct profile renders.

Crucially, the user's intended **project** still gets selected (`setCurrentProjectId` runs unconditionally). Only the visual theme might briefly mismatch if the project's profileType isn't in the catalogue — which would be a data error (project linked to a deleted profile), already a degenerate case worth surfacing rather than silently swallowing.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Drop import | Removed `profiles` import. Also dropped `ProfileType` import — no longer referenced after the cast was removed. | done |
| 2 | [x] | Drop guard | Simplified `handleProjectClick` to unconditional `switchProfile(project.profileType)`. | done |
| 3 | [x] | Verification — no remaining import from config/profiles | grep returns zero hits outside `config/profiles/` itself. | ✅ "config/profiles has only self-references" |
| 4 | [x] | Verification — tsc | `ProfileDropdown.tsx` produces zero errors. Unique-files list identical to Phase 3 (3 × config/profiles/* + 7 pre-existing). | ✅ |

---

## Verification Block — after item 2

```bash
cd frontend

# 1. No external imports of config/profiles remain (only self-references)
echo "=== external imports of config/profiles ==="
grep -rn "from ['\"].*config/profiles" src --include='*.ts' --include='*.tsx' | grep -v "src/config/profiles/"

# 2. tsc
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
echo
echo "=== ProfileDropdown.tsx errors (must be ZERO) ==="
grep -E "^src/components/layout/ProfileDropdown\.tsx" /tmp/tsc.out
echo
echo "=== unique files with errors ==="
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected:
- The first grep returns **no rows** — config/profiles has only self-references.
- `ProfileDropdown.tsx` not in the error list.
- Unique-files-with-errors list = Phase 3's list (3 × config/profiles/* + 7 pre-existing).

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| User clicks a project whose `profileType` isn't in the catalogue | Realignment effect (Phase 3) snaps to a valid code. One render of stale theme; not a crash. |
| `switchProfile(code)` triggers the 150ms isSwitching state even when `code` matches `currentProfile` | The first line of `switchProfile` is `if (profileType === currentProfile) return` — idempotent. |
| Removing `as ProfileType` cast surfaces a hidden type mismatch | `Project.profileType` is now `Theme = string` (Phase 3 widening) and `switchProfile`'s param is `ProfileType = string`. Both are `string`. tsc confirms. |

---

## Out of scope

| Item | Why |
|---|---|
| Deleting `config/profiles/` | Phase 5 |
| Browser smoke | Phase 6 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `ProfileDropdown.tsx` no longer imports `profiles` from `config/profiles/index` |
| [x] | Click handler simplified to unconditional `switchProfile(project.profileType)` |
| [x] | No external imports of `config/profiles/` remain anywhere in `frontend/src` |
| [x] | tsc fallout unchanged from Phase 3 (no new errors) |

---

## Files Touched in Phase 4

| File | What changed |
|---|---|
| `frontend/src/components/layout/ProfileDropdown.tsx` | Dropped `profiles` import. Simplified `handleProjectClick` — call `switchProfile(project.profileType)` unconditionally; removed `as ProfileType` cast (no longer needed). |

---

*Last updated: 2026-05-22*
