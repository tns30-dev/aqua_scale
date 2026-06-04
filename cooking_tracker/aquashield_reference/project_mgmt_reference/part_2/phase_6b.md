# Part 2 — Phase 6b — ProfileContext Refetch on Logout

---

## Goal

Fix the catalogue cache staleness bug surfaced during Phase 6 smoke: a profile added in Django admin while a user is logged in does not appear in the FE on the SAME session — even after logout + login — because Phase 3's fetch logic only fires when `profiles === null`, which is never re-true after the first successful fetch.

After Phase 6b: logout sets `profiles` back to `null`. The next login fires a fresh fetch. New profiles appear on the next session refresh — as originally promised by Part 2 (item 10-12 in `phase_6.md`).

---

## The bug, traced through Phase 3 logic

Current code (`ProfileContext.tsx`):

```ts
useEffect(() => {
  if (isAuthenticated && profiles === null) {
    apiService.getProfileTypes()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }
}, [isAuthenticated, profiles]);
```

Timeline:
1. User logs in. `isAuthenticated=true`, `profiles=null` → fetch fires, `setProfiles([...])`.
2. Admin (in another tab) adds a new profile via Django admin.
3. User logs out. `isAuthenticated=false`. Effect re-runs but the guard rejects (still `profiles !== null`).
4. User logs in again. `isAuthenticated=true`. Effect re-runs but the guard STILL rejects (`profiles` is still the cached old array, not `null`).

The cached array is sticky. The new profile is invisible until the entire SPA reloads (hard refresh, browser tab close, etc.) — which the user found out the hard way.

---

## Design — explicit reset on logout

Add a second effect that resets `profiles` to `null` whenever `isAuthenticated` flips to `false`. This makes logout act like a soft cache invalidation:

```ts
// Reset catalogue cache on logout so next login refetches.
useEffect(() => {
  if (!isAuthenticated) {
    setProfiles(null);
  }
}, [isAuthenticated]);
```

Why a second effect (not a `useEffect` consolidation):
- Single-responsibility: reset is independent of fetch.
- Clear ordering: reset fires on transition; fetch fires after when `isAuthenticated` flips back to `true` and `profiles` is `null`.
- Easier to read; easier to delete if we change cache strategy later.

### Alternatives considered

| Option | Why not |
|---|---|
| Refetch on every page navigation | Wasteful — 99% of nav doesn't need a fresh catalogue. |
| Refetch periodically (5-min poll) | Adds complexity and traffic for a benefit that rarely matters. |
| Add a manual `refetchProfiles()` exposed via `useProfile()` | Requires every admin-flow consumer to know to call it. Bad coupling. |
| Track `user.userId` and reset when it changes | Equivalent to logout-reset for normal flows. More complex; less obvious. |
| Refetch on window-focus | Reasonable for a future "live updates" arc, but out of scope here. |

The logout-reset is the smallest change that addresses the reported scenario — admin adds a profile, user re-logs in, sees it.

### What this does NOT fix

| Scenario | Behaviour |
|---|---|
| Admin adds a profile WHILE user stays logged in (no logout) | Still doesn't refetch. The new profile is invisible until logout+login. **Acceptable per Part 2's design** — overall.md "Out of scope: Refetch on profile-mutation events". |
| User opens a second tab during the same session | Each tab has its own ProfileProvider; second tab fetches on mount. So a second tab WILL see the new profile if opened after the admin change. |

If live propagation becomes a requirement later, websockets or polling — a separate arc.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `ProfileContext.tsx` — add reset effect | Added the 5-line `useEffect` right below the fetch effect with dep `[isAuthenticated]`. | done |
| 2 | [x] | Verification — tsc | `ProfileContext.tsx` → 0 errors. Unique-files list = the 7 pre-existing. No change vs Phase 5. | ✅ |
| 3 | [ ] | Verification — browser smoke (user) | (a) Log in. Watch Network tab: `GET /api/profile-types/` fires (count=4). (b) Add a new profile in `/admin/.../profiletype/add/` with real theme colours. (c) Logout. (d) Log in again. Network tab: `GET /api/profile-types/` fires again, this time returns 5 items. Dropdown surfaces the new profile if user has a project linked to it. | **Pending manual smoke** |

---

## Verification Block — to run after item 1

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
echo "=== ProfileContext.tsx errors (must be ZERO) ==="
grep -E "^src/context/ProfileContext\.tsx" /tmp/tsc.out || echo "(none)"
echo
echo "=== unique files with errors ==="
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected: zero `ProfileContext.tsx` errors. Unique-files list = the 7 pre-existing files (HistoricalTrendsAnalysis_original.tsx, OnboardUserDialog.tsx, main.tsx, ForecastPage.tsx, 3 test files).

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Race: reset effect fires AFTER the fetch effect in the same render | React batches state updates; the reset's `setProfiles(null)` schedules the array to be cleared. The fetch effect's guard reads the stale `profiles` for one render but re-runs immediately. Net effect: at most one wasted render; no incorrect data. |
| First mount: `isAuthenticated=false` initially → reset effect fires and calls `setProfiles(null)` | No-op — `profiles` is already `null` in initial state. |
| User explicitly logs out via UI (not navigation/session-expiry) | Same code path. `isAuthenticated` flips false; reset fires; cache cleared. |
| Two simultaneous browser tabs share localStorage but each tab has its own ProfileProvider state | Each tab independently resets on its own logout. Cross-tab catalogue sync is not in scope. |

---

## Out of scope

| Item | Why |
|---|---|
| Stage editor for `stage_config` | Phase 6c |
| Live refetch on profile-mutation events (websocket / polling) | Out of scope per overall.md; separate arc if needed |
| Refetch on focus | Out of scope; can be added cheaply later |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [ ] | `ProfileContext.tsx` has a logout-reset effect that sets `profiles=null` when `isAuthenticated=false` |
| [ ] | tsc clean (no new errors) |
| [ ] | Manual smoke: admin adds profile → user logout + login → new profile visible in `/api/profile-types/` response in network tab |

---

## Files Touched in Phase 6b

| File | What changed |
|---|---|
| `frontend/src/context/ProfileContext.tsx` | Added a logout-reset `useEffect` that calls `setProfiles(null)` whenever `isAuthenticated` becomes false. Dep array: `[isAuthenticated]`. |

---

*Last updated: 2026-05-22*
