# Part 2 — Phase 6d — `/api/auth/me` Returns `.code` Not `.name`

---

## Goal

Fix a latent backend bug surfaced by Phase 6 smoke: `MeResponseSerializer` (in `module_user/serializers.py`) sets `profileType` to `profile_type.name` (display label) when every FE consumer treats `profileType` as the machine code. Since the seed profiles had `name == code` for all 4 entries, the bug was invisible. Adding a new profile with a different display name (`name="Octopus"`, `code="octopus"`) made every assigned-user check break.

After Phase 6d: `auth/me` returns `profileType = profile_type.code`. The FE catalogue/session intersection works again; users see their assigned profile's theme.

---

## The trace

User flow:
1. Admin adds ProfileType in Django admin: `name = "Octopus"`, `code = "octopus"`, theme = real yellow.
2. Admin links a Project with `profile_type_id = octopus`. Assigns to Demo User.
3. Demo User logs in. `GET /api/auth/me` returns:
   ```jsonc
   { "projects": [{ "name": "Demo Octopus Farm", "profileType": "Octopus", ... }] }
   ```
4. ProfileContext fetches `/api/profile-types/`, gets the 5-row catalogue (including `octopus`).
5. `userProfiles` derivation:
   ```ts
   const sessionCodes = new Set(projects.map((p) => p.profileType));  // {"Octopus"}
   profiles.filter((p) => sessionCodes.has(p.code))                    // p.code="octopus" ∉ {"Octopus"}
                                                                       // → []
   ```
6. Phase 6c realignment falls into the "no userProfiles" branch → keeps stale `"shrimp"` from localStorage.
7. Theme renders teal, not yellow.

Root cause: `serializers.py:297` returns `.name`, not `.code`.

---

## Why this is a backend bug, not frontend

| Question | Answer |
|---|---|
| What does `profileType` *mean* across the codebase? | The machine identifier — what `profile_types.code` carries in the DB. Used for FK lookups, localStorage values, theme-switching, CSS `data-theme` attributes. Always lowercase, snake_cased. |
| What about display labels like "Shrimp Farm"? | Those come from `.name` (display). The auth/me serializer should not conflate them. |
| Why did it work for the 4 seed profiles? | The seed `INSERT` statements set `name = code` (both `"shrimp"`, both `"fish"`, etc.). The mismatch was invisible. |
| Who else reads `Project.profileType` in the FE? | `ProfileContext` (userProfiles intersection), `ProfileDropdown` (calls `switchProfile(profileType)` — expects code), `LoginPage` (calls `setTheme(profileType)` — expects code), `utils/auth.setCurrentProfileType` (just persists; doesn't care). **All want code.** None want the display name. |

So the fix is BE-side: return `.code`. No FE changes required.

---

## Design

One-line edit in `backend/module_user/serializers.py`:

```diff
- "profileType": up.project.profile_type.name,
+ "profileType": up.project.profile_type.code,
```

That's it. The field name stays `profileType` (FE consumers reference it by this name); only the value changes.

### Field-name rename considered + rejected

Could rename to `profileTypeCode` for clarity. Rejected because:
- Many FE consumers + types (`Project.profileType`) reference the existing name.
- The semantic intent has always been "code"; the fix is the value, not the label.
- A rename would cascade across types/index.ts, ProfileDropdown, LoginPage, utils/auth — bigger blast radius than the actual bug.

If we want to surface the display name separately later, add a new field `profileTypeName: ...` alongside. Out of scope here.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `backend/module_user/serializers.py:297` — switch `.name` → `.code` | Edit landed but turned out to be **dead code** — `MeResponseSerializer` isn't wired to any view. Left the edit in place for consistency; the real fixes are below. | done, but turned out cosmetic |
| 2 | [x] | `backend/module_user/views.py:222` — `MeView` (real `/api/auth/me`) | This is the actual handler. Changed `.name` → `.code`. | done |
| 3 | [x] | `backend/module_user/jwt_serializers.py:71` — JWT login response | Same shape, same bug, same fix. | done |
| 4 | [x] | `backend/module_project/views.py:89` — `/api/projects/all/` (platform_admin) | Returns lightweight project list to admin UI. Same fix. | done |
| 5 | [x] | `backend/module_project/views.py:207` — `/api/projects/<id>/cycles/` (`profileTemplate.profileType`) | Consumed by `HealthStatusOverview.tsx:16` via `getProfileColors(profileTemplate?.profileType \|\| 'shrimp')` — fallback uses lowercase code, so consumer wants `.code`. | done |
| 6 | [x] | Verification — `manage.py check` | Exit 0; only pre-existing staticfiles.W004. | ✅ |
| 7 | [x] | Verification — shell smoke as scientistdemo | `auth/me` now returns `profileType='octopus'` (lowercase) for Demo Octopus Farm, plus `'shrimp'` + `'fish'` for the other two projects. All lowercase machine codes. | ✅ |
| 8 | [ ] | Verification — browser smoke (user) | (a) Restart the FE if dev server is open; clear localStorage `aquashield_selected_profile`. (b) Log in as scientistdemo@gmail.com. (c) If Octopus is the default selected project, sidebar renders yellow (`#fff76b`). Otherwise switch via the dropdown to the Octopus project. (d) Console: `localStorage.getItem('aquashield_selected_profile')` returns `"octopus"`. | **Pending manual smoke** |

---

## Verification Block — to run after item 1

```bash
cd backend && source venv/bin/activate

python manage.py check

python manage.py shell <<'PY'
from rest_framework.test import APIClient
from module_user.models import User

user = User.objects.filter(is_active=True, email__icontains='demo').first()
client = APIClient()
client.force_authenticate(user=user)
r = client.get('/api/auth/me', HTTP_HOST='localhost')
body = r.json()
print(f"status: {r.status_code}")
print(f"acting as: {user.email}")
for p in body.get('projects', []):
    print(f"  project: {p['name']:>30s}  profileType={p['profileType']!r}")
print()
# Verify each profileType is lowercase (matches the .code convention)
all_lowercase = all(p['profileType'] == p['profileType'].lower() for p in body['projects'])
print(f"all profileType values are lowercase machine codes: {all_lowercase}")
PY
```

Expected: each `profileType` is the lowercase `.code` (e.g., `"octopus"`, not `"Octopus"`).

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| FE consumer reads `profileType` and expects a display label | Audit (above) confirmed no such consumer. All consumers treat `profileType` as the machine code. |
| Existing FE display somewhere prints `profileType` as a heading and would now show "octopus" instead of "Octopus" | Out of scope of the audit but unlikely — if anyone wanted display labels they'd use the dedicated `.name` field from `/api/profile-types/`. If found, the fix is FE-side: pull the display label from the profile catalogue. |
| Backend test suite asserts `profileType="shrimp"` (which happens to be the same as `.code` for seed profiles) | Tests continue passing because seed data has `name == code`. The only test that would catch this kind of bug would need a profile with `name ≠ code` — which is exactly the scenario that surfaced this in production. Not in scope to add. |
| Two-repo port — prod repo serializer carries the same bug | When porting Part 2 to prod, this change goes with it. Both repos need the fix. |

---

## Out of scope

| Item | Why |
|---|---|
| Stage editor for `stage_config` | Phase 6e (pushed back another slot) |
| Adding a separate `profileTypeName` field | Not needed by any current consumer |
| Backend test for the name ≠ code case | Tests-out-of-scope per CLAUDE.md for this arc |
| Two-repo port | Standard workflow; on explicit signal |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [ ] | `MeResponseSerializer` returns `profileType = up.project.profile_type.code` |
| [ ] | `manage.py check` clean |
| [ ] | Shell smoke: `auth/me` returns lowercase machine codes for every project's `profileType` |
| [ ] | Browser smoke: Demo Octopus user sees yellow theme on login |

---

## Files Touched in Phase 6d

| File | What changed |
|---|---|
| `backend/module_user/serializers.py` | One line: `MeResponseSerializer` now returns `.code`. **Turned out to be dead code** (not wired to any view) — edit left in for future-proofing. |
| `backend/module_user/views.py` | `MeView.get` (the real `/api/auth/me`) now returns `.code` for each project's `profileType`. |
| `backend/module_user/jwt_serializers.py` | JWT login response (`/api/auth/login`) now returns `.code` for each project's `profileType`. |
| `backend/module_project/views.py` | Two sites: `/api/projects/all/` (platform_admin lightweight list) + `/api/projects/<id>/cycles/` (`profileTemplate.profileType`) both now return `.code`. |

---

*Last updated: 2026-05-22*
