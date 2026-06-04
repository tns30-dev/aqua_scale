# Part 2 — Phase 5 — Delete `config/profiles/`

---

## Goal

Delete the hardcoded profile registry directory in full. After Phase 5:

- `frontend/src/config/profiles/` no longer exists.
- The 3 tsc errors that have been hanging on this directory since Phase 1 disappear.
- The Part-2 / FE consolidation arc is functionally complete — Phase 6 is the browser smoke that verifies it runs.

---

## Pre-conditions

Verified via grep (Phase 4 + final audit before this doc):

- **Zero** external imports of `config/profiles/*` remain anywhere in `frontend/src`.
- Specifically, the previously offending consumers are all migrated:
  - `context/ProfileContext.tsx` → fetches API (Phase 3)
  - `components/layout/ProfileDropdown.tsx` → uses Context (Phase 4)
- The 3 files inside the directory (`index.ts`, `shrimpProfile.ts`, `fishProfile.ts`) only reference each other and the (now-trimmed) types in `types/profile.ts`.

If any of those preconditions fail, **stop and investigate** before deleting — a stale import would 404 at module-resolution time and crash Vite, not just tsc.

---

## Files to delete

```text
frontend/src/config/profiles/
  ├── index.ts
  ├── shrimpProfile.ts
  └── fishProfile.ts
```

Three files in one directory. After the deletes, `frontend/src/config/` may contain other unrelated files — leave them alone. Only the `profiles/` subdirectory goes.

---

## Approach — `rm -rf` (after grep clean)

A `rm -rf` is destructive and irreversible (locally — git history still holds the files until Phase 5 is committed). Standard CLAUDE.md guidance: destructive operations need explicit confirmation. **The user explicitly approved this phase via "go" knowing it's the directory delete** — the doc is the confirmation. We proceed with `rm -rf` on the single directory.

Single command: `rm -rf frontend/src/config/profiles/`.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Pre-flight — final grep | Zero external imports of `config/profiles/*`. | done — grep empty |
| 2 | [x] | Delete directory | `rm -rf frontend/src/config/profiles/`. | exit=0; `ls` returns "No such file or directory" |
| 3 | [x] | Verification — tsc | Zero `config/profiles` errors. Unique-files-with-errors = exactly the 7 pre-existing files (HistoricalTrendsAnalysis_original.tsx, OnboardUserDialog.tsx, main.tsx, ForecastPage.tsx, 3 test files). No Part-2-caused errors remain. | ✅ |
| 4 | [ ] | Verification — Vite dev server boots | `cd frontend && npm run dev` — Vite starts without "Failed to resolve import" errors. | **Pending user smoke (Phase 6 owns this).** tsc already verified no broken imports via the same module resolution. |

---

## Verification Block — after item 2

```bash
cd frontend

# 1. Directory is gone
ls src/config/profiles/ 2>&1 || echo "(directory does not exist — expected)"

# 2. tsc fallout
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
echo
echo "=== config/profiles errors (must be ZERO) ==="
grep -E "^src/config/profiles" /tmp/tsc.out || echo "(none)"
echo
echo "=== unique files with errors ==="
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected:
- `ls` returns "No such file or directory".
- Zero `config/profiles` lines in tsc output.
- Unique-files list is exactly the 7 pre-existing errors:
  - `src/components/historical/HistoricalTrendsAnalysis_original.tsx`
  - `src/components/user-management/OnboardUserDialog.tsx`
  - `src/main.tsx`
  - `src/pages/ForecastPage.tsx`
  - `src/test/components/PondCircle.test.tsx`
  - `src/test/components/PondGrid.test.tsx`
  - `src/test/components/PondVisualization.test.tsx`

**Any other file in the list = an import we missed; revert the delete (`git restore`), investigate, re-attempt.**

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| A test file or runtime-only path still imports from the directory (grep missed it) | The pre-flight grep is the safety net. If tsc surfaces an unexpected file, `git restore frontend/src/config/profiles/` recovers the dir; investigate; re-attempt. |
| A dynamic import (`import('../config/profiles')`) bypasses the grep | grep for `import('.*config/profiles')` — none in this codebase per quick check. |
| Vite's module-resolution cache holds stale handles | Restart the dev server after the delete. Phase 6's browser smoke includes a fresh start. |
| Backup / WIP files left in the directory | Phase 5 deletes the whole dir; nothing survives. If the user has uncommitted work in there, git status would have surfaced it; we go off git-clean state. |

---

## Out of scope

| Item | Why |
|---|---|
| Browser smoke | Phase 6 |
| Cleaning up the 7 pre-existing tsc errors | Pre-existing, unrelated to Part 2. Out of scope. |
| Two-repo port | Standard workflow; on explicit user signal after Part 2 closes |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `frontend/src/config/profiles/` directory does not exist |
| [x] | tsc unique-files-with-errors list = 7 pre-existing files exactly; no `config/profiles/*` entry |
| [x] | No new errors introduced anywhere in `frontend/src` |

---

## Files Touched in Phase 5

| File | What changed |
|---|---|
| `frontend/src/config/profiles/index.ts` | DELETED |
| `frontend/src/config/profiles/shrimpProfile.ts` | DELETED |
| `frontend/src/config/profiles/fishProfile.ts` | DELETED |

---

*Last updated: 2026-05-22*
