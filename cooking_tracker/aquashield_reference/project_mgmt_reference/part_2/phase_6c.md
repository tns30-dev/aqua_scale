# Part 2 — Phase 6c — Realignment Fix (User-Assigned Profiles)

---

## Goal

Fix a Phase 3 regression: the catalogue-aware realignment effect in `ProfileContext.tsx` only checks whether `currentProfile` is in the API catalogue, not whether the user actually has projects linked to it. Result: a user whose only project is on the new "octopus" profile still sees the previous profile's theme (e.g., shrimp teal) because `localStorage.aquashield_selected_profile = "shrimp"` survives — `shrimp` is a valid catalogue code, so the realignment doesn't fire.

After Phase 6c: realignment fires when `currentProfile` is not in **`userProfiles`** (the catalogue × session-projects intersection). The user's own assignment becomes the source of truth.

---

## The bug, traced

Current code in `ProfileContext.tsx`:

```ts
useEffect(() => {
  if (!profiles || profiles.length === 0) return;
  const validCodes = new Set(profiles.map((p) => p.code));
  if (validCodes.has(currentProfile)) return;            // ← too loose
  const next = userProfiles[0] ?? profiles[0].code;
  setCurrentProfile(next);
}, [profiles, userProfiles, currentProfile]);
```

The guard `validCodes.has(currentProfile)` is true whenever `currentProfile` is any catalogue code. A user holding stale localStorage value `"shrimp"` while their only assigned profile is `"octopus"` short-circuits realignment.

### Original pre-Part-2 logic (was correct)

```ts
useEffect(() => {
  if (userProfiles.length > 0 && !userProfiles.includes(currentProfile)) {
    setCurrentProfile(userProfiles[0]);
  }
}, [userProfiles, currentProfile]);
```

Phase 3 rewrote this to use the API catalogue and lost the user-membership constraint in the process. Phase 6c restores it.

---

## Design — tightened realignment

```ts
useEffect(() => {
  if (!profiles || profiles.length === 0) return;

  // If the user has assigned profiles, currentProfile MUST be one of them.
  // Otherwise the theme would render a profile the user doesn't actually own
  // (e.g. stale localStorage value from a previous session).
  if (userProfiles.length > 0) {
    if (userProfiles.includes(currentProfile)) return;
    setCurrentProfile(userProfiles[0]);
    return;
  }

  // No assigned profiles (edge case: superuser, new account, etc.) —
  // fall back to any catalogue entry so the dropdown isn't empty.
  const validCodes = new Set(profiles.map((p) => p.code));
  if (validCodes.has(currentProfile)) return;
  setCurrentProfile(profiles[0].code);
}, [profiles, userProfiles, currentProfile]);
```

Two-branch structure:
- **Branch 1** — user has projects (the normal case): realignment forces `currentProfile` into `userProfiles`.
- **Branch 2** — user has no projects (degenerate): fall back to any catalogue code; otherwise the dropdown would be empty AND the stub theme would persist.

The `userProfiles.length > 0` branch is what the original pre-Part-2 code did. Branch 2 is a small extra robustness layer for the unassigned-user case.

---

## Why this also fixes the originally-reported scenario

User scenario as reported:
1. Admin adds "octopus" profile via Django admin with theme `#fff76b`.
2. Admin creates a project with `profile_type = octopus` and assigns it to Demo User.
3. Demo User logs in (or logs out and back in after Phase 6b).
4. `profiles` now contains octopus; `userProfiles` = `["octopus"]`.
5. `localStorage.aquashield_selected_profile` is still `"shrimp"` from a prior session.
6. Realignment under Phase 6c **detects `"shrimp" ∉ userProfiles`** and sets `currentProfile = "octopus"`.
7. `profileConfig` resolves to the octopus row; `--profile-primary` = `#fff76b`; Sidebar renders yellow.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `ProfileContext.tsx` — rewrite realignment effect | Replaced catalogue-only realignment with two-branch logic (userProfiles-first, catalogue fallback). | done |
| 2 | [x] | Verification — tsc | `ProfileContext.tsx` → 0 errors. Unique-files list unchanged. | ✅ |
| 3 | [ ] | Verification — browser smoke (user) | (a) Reset localStorage (DevTools → Application → Local Storage → delete `aquashield_selected_profile`) OR just log out + log in to force a clean state. (b) Log in as a user whose only project is octopus. (c) Sidebar should now render yellow. (d) Inspect `<html>` → `--profile-primary` = `#fff76b`. | **Pending manual smoke** |

---

## Verification Block — after item 1

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
echo "=== ProfileContext.tsx errors (must be ZERO) ==="
grep -E "^src/context/ProfileContext\.tsx" /tmp/tsc.out || echo "(none)"
echo
echo "=== unique files with errors ==="
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected: zero `ProfileContext.tsx` errors. Unique-files = the 7 pre-existing.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| User has multiple projects spanning different profiles | `userProfiles` is the deduplicated set of all their profile codes. Realignment picks `userProfiles[0]` (catalogue order — by `code` alphabetical, per Phase 7 `ordering = ['code']` on the BE). User can switch via the dropdown. |
| Admin / superuser without any assigned projects | Branch 2 keeps the dropdown functional. They see the first catalogue profile's theme by default. |
| localStorage value matches a profile the user lost access to (project unassigned mid-flight) | Realignment forces them to one of their current `userProfiles`. The lost-profile theme is no longer reachable from this session. |
| Race during initial mount: `profiles` and `userProfiles` not yet loaded | Effect's first line `if (!profiles || profiles.length === 0) return;` guards against null catalogue. Once data arrives, the effect re-runs with full data. |
| Phase 6b's logout-reset interaction | After logout, `profiles` → `null`. This effect's guard returns immediately. After next login, `profiles` refetched, realignment runs fresh against the new `userProfiles`. |

---

## Out of scope

| Item | Why |
|---|---|
| Stage editor for `stage_config` | Phase 6d (renamed from 6c since this is taking the 6c slot) |
| Cross-tab `userProfiles` sync | Out of scope |
| UX feedback when a previously-stored profile becomes invalid | Out of scope; silent realignment is acceptable |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [ ] | Realignment effect checks `userProfiles.includes(currentProfile)` (not just catalogue membership) |
| [ ] | Branch 2 (no userProfiles) preserves the dropdown functionality |
| [ ] | tsc clean |
| [ ] | Manual smoke: user with only octopus project sees yellow theme on login |

---

## Files Touched in Phase 6c

| File | What changed |
|---|---|
| `frontend/src/context/ProfileContext.tsx` | Realignment `useEffect` rewritten to check `userProfiles` membership when the user has assigned profiles; falls back to catalogue membership only when `userProfiles.length === 0`. Restores the pre-Part-2 invariant that lost during Phase 3's rewrite. |

---

*Last updated: 2026-05-22*
