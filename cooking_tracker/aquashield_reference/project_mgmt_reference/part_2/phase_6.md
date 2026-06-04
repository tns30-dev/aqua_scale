# Part 2 — Phase 6 — Browser Smoke

---

## Goal

End-to-end acceptance for Part 2. After Phase 5 deleted the hardcoded registry, the FE depends entirely on `/api/profile-types/` for profile config. Phase 6 verifies that everything actually runs in a real browser, with real auth, against the real BE.

If this passes, Part 2 ships. If it fails, the gap surfaces here and gets fixed under its originating phase (e.g., a `ProfileContext` bug → Phase 3 follow-up).

---

## What Phase 6 actually checks

Three layers, in order:

| Layer | Check | How |
|---|---|---|
| **Precondition** | BE serves the corrected `/api/profile-types/` payload (4 profiles, real themes, indicator arrays clean) | Programmatic — APIClient smoke (reuses the Phase 9 / Part 1 pattern) |
| **Auth + fetch + render** | Login triggers the fetch; ProfileContext caches it; theme writes to CSS vars; consumers (Sidebar, PondDetailsPanel, PondVisualization) render per-profile colours | User-driven browser smoke |
| **End-to-end Part-2 promise** | Adding a profile in Django admin appears in the FE on next login — no code change | User-driven; optional but the headline acceptance |

---

## Phase 6 produces no diffs

Same posture as Phase 9 of Part 1 — validation only. Any gap surfaces under its originating phase. The phase doc records what passed / what didn't.

---

## Setup

### Backend

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

The DB should already be loaded with the Phase 9 / Part 1 seed state — themes are real, `is_key_parameter` populated, indicators clean. If anything looks off, reload first:

```bash
export PGPASSWORD='aquaculture'
dropdb -h localhost -U postgres --if-exists --force aquaculture
createdb -h localhost -U postgres aquaculture
psql -h localhost -U postgres -d aquaculture -v ON_ERROR_STOP=1 -q \
    -f backend/sql/aquashield_current_local_share.sql
```

### Frontend

```bash
cd frontend
npm run dev
```

Wait for "ready in Xms" + the URL printout (usually `http://localhost:5173/`).

---

## Checklist Tracking

### A. Precondition (programmatic)

| No. | Done | Step | Pass criterion |
|---|---|---|---|
| 1 | [ ] | `GET /api/profile-types/` (authenticated, via APIClient) returns 4 profiles | All themes are real per-profile colours (no `#888888`); indicator arrays clean (no `feed_conversion_ratio`); response is a flat list (no pagination wrapper) |

### B. Browser smoke (user-driven)

| No. | Done | Step | Pass criterion |
|---|---|---|---|
| 2 | [ ] | Hard-refresh `http://localhost:5173/` (Cmd+Shift+R to clear any cached chunks from before Phase 5's delete) | Page loads; no console errors about "Failed to resolve import '../config/profiles'" |
| 3 | [ ] | Log in with an existing demo user (e.g., `scientistdemo@gmail.com`) | Network tab: one `GET /api/profile-types/` request fires once `/api/auth/login` succeeds. Status 200. Response is a 4-item array. |
| 4 | [ ] | Dashboard loads with the current project's theme applied | Sidebar gradient + active-item highlight match the project's profile theme (shrimp = teal `#0C9286`, fish = purple `#7C3AED`, crab_hatchery = orange `#F97316`, treatment = cyan `#06B6D4`). Verify by inspecting the gradient header or any element using `var(--profile-primary)`. |
| 5 | [ ] | Open the profile dropdown (top-right) | Lists all projects the user has access to. Each project's profileType matches what the API returns. |
| 6 | [ ] | Switch to a project with a different profile (if the user has multiple) | Theme updates within ~150ms (the existing `setTimeout` flair from `switchProfile`). Page re-renders with new colours. |
| 7 | [ ] | Navigate Overview → Historical → Forecast → Pond Comparison (whichever exist for this user) | Pages render. Console clean. Theme stays applied. |
| 8 | [ ] | Inspect DevTools → Elements → `<html>` | Confirm CSS variables `--profile-primary`, `--profile-gradient-from`, `--profile-gradient-to` are set on the root. **`--profile-secondary` and `--profile-accent` are absent** (dropped in Phase 3). |
| 9 | [ ] | Logout → Login as a different user (different profile) | Theme updates correctly; new user's projects appear; no stale config from the previous user. |

### C. End-to-end Part 2 promise (optional but recommended)

| No. | Done | Step | Pass criterion |
|---|---|---|---|
| 10 | [ ] | In Django admin (`/admin/module_project/profiletype/`), add a new ProfileType — e.g., code = `shellfish`, real theme colours, a couple of key parameter indicators. Save. | Row appears in the admin list with the chosen theme swatch. |
| 11 | [ ] | Without touching code, refresh the React app and log in | `/api/profile-types/` now returns 5 profiles. If the logged-in user has a project linked to the new profile, the dropdown surfaces it with the chosen theme. |
| 12 | [ ] | Optional cleanup — delete the test profile via admin | Catalogue back to 4 entries. |

This is the *whole point* of Part 2: adding a profile in DB ≡ adding it in the FE. No TS code change. Items 10-12 prove it.

---

## Precondition Verification Block — run BEFORE browser smoke

```bash
cd backend
source venv/bin/activate
python manage.py shell <<'PY'
from rest_framework.test import APIClient
from module_user.models import User

user = User.objects.filter(is_active=True).first()
client = APIClient()
client.force_authenticate(user=user)
r = client.get('/api/profile-types/', HTTP_HOST='localhost')
body = r.json()
print(f"status: {r.status_code}")
print(f"count:  {len(body) if isinstance(body, list) else 'NOT A LIST'}")
print(f"themes:")
for row in body:
    print(f"  {row['code']:>15s}  primary={row['theme']['primary']}  kp={row['key_parameter_indicators']}")
PY
```

Expected:
- status 200
- count 4
- All themes are real per-profile colours (no `#888888`)
- `key_parameter_indicators` arrays match the Phase-8 corrections (shrimp = temperature/ph/dissolved_oxygen/salinity, etc.)

---

## Risks / Things to Watch

| Risk | Mitigation |
|---|---|
| `npm run dev` 404s on `../config/profiles` because of a stale Vite cache | Restart Vite (`Ctrl+C` then `npm run dev` again). Or `rm -rf node_modules/.vite` if it persists. |
| ProfileContext's `STUB_PROFILE` shows as the actual theme (grey #888888) instead of the per-profile colour | Means the fetch hasn't resolved or failed. Check Network tab for `/api/profile-types/` status. 401 = session not authenticated; the fetch effect requires `isAuthenticated`. 500 = BE issue; check runserver console. |
| Profile dropdown shows zero entries even though user has projects | `userProfiles` is the *intersection* of session-project codes and catalogue codes. If projects exist but profiles fail to load, intersection is empty. Check the fetch resolved. |
| New profile (item 10) doesn't appear after refresh | The cache fetch is gated on `isAuthenticated && profiles === null`. A page-reload re-mounts ProfileProvider → `profiles` resets to null → re-fetch. If you stayed in the same SPA session without logout/login, the cache might still hold the old 4-profile list. Logout + login forces refetch. |
| Browser shows console errors from one of the pre-existing tsc-error files (e.g., `OnboardUserDialog.tsx`) | These were already broken before Part 2. Out of scope for Phase 6; mention in summary and move on. |

---

## Out of scope

| Item | Why |
|---|---|
| Cleaning up pre-existing tsc errors | Not Part 2's job. |
| Two-repo port (to prod) | Standard workflow; on explicit user signal. |
| Commit | On explicit user signal; never auto. |
| Refetch-on-admin-mutation (live updates) | Out of scope for this arc — websocket / polling work. |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [ ] | Precondition smoke: `/api/profile-types/` returns 4 corrected profiles |
| [ ] | FE login fires `/api/profile-types/` once and renders the correct theme |
| [ ] | Profile-switch (multi-project users) updates the theme live |
| [ ] | CSS variables on `<html>` confirm the trimmed set (primary + gradient.from/to only) |
| [ ] | (Optional, but the headline acceptance) Adding a profile in Django admin propagates to the FE on next login |

---

## Files Touched in Phase 6

**None** — validation only. Any gap fixed under its originating phase.

---

*Last updated: 2026-05-22*
