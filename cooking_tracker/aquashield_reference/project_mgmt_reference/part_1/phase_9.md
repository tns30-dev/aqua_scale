# Part 1 — Phase 9 — Smoke + Whole-Arc Validation

---

## Goal

Confirm the eight phases hang together as one consistent arc, with **no implementation in this phase** — only validation. Two kinds of smoke:

1. **Programmatic smoke** (shell + scratch DB) — counts, model imports, cross-module integrity, API responses. Cheap, repeatable, runs in one block.
2. **Browser smoke** (user-driven) — admin pages, colour-picker UX, inline editor, regression check on the FE. The bits a script can't verify.

Phase 9 ends when both pass. If anything fails, the gap is documented and either fixed in Phase 9 (small) or rolled into Phase 10 (large/punted).

---

## What we're really checking

| Category | Question | Where verified |
|---|---|---|
| **Module ownership** | Does `module_project` own all 5 reference/config models? Is `module_sensor` cleanly free of them? | Programmatic — model imports + admin registry |
| **Cross-module wiring** | Do callers (module_chart, module_data_ingestion, scripts) still resolve their imports? Does `SensorType.get_parameters()`'s lazy import work? | Programmatic — direct call + grep |
| **Schema integrity** | Does the seed file load cleanly? Are theme + audit columns present? Does `is_key_parameter` mirror the profile arrays? | Programmatic — fresh DB load + integrity SQL |
| **Admin UX** | Are the 4 standalone admins reachable? Does the ProfileType colour-picker form save → reload round-trip? Is the ProjectParameterSetting inline + autocomplete usable? | Browser — admin pages |
| **API surface** | Do the 3 new endpoints return the corrected payload? Does the existing `ProjectViewSet` (charts, summary, cycles, pond-comparison) still work? | Programmatic — APIClient hits |
| **FE regression** | Does the React app still render (login → dashboard → charts)? Important: **the FE still reads from hardcoded config** — Part 2 hasn't started yet. Phase 9 just confirms we didn't break it. | Browser — frontend dev server |

---

## Checklist Tracking

### A. Programmatic smoke (single shell script — run as item 7)

| No. | Done | Area | Step | Pass criterion |
|---|---|---|---|---|
| 1 | [x] | Counts | `ProfileType.objects.count()==4`, `ParameterType==22`, `GrowthIndicator==11`, `ProjectParameterSetting==41`, `Project>=3` | All 5 PASS |
| 2 | [x] | Model relocation | Importing `ParameterType, ProjectParameterSetting, GrowthIndicator` from `module_sensor` raises ImportError; importing them from `module_project.models` works. | PASS |
| 3 | [x] | Lazy-import wiring | `SensorType.objects.first().get_parameters()` returns a list of `ParameterType` instances — proves the cross-module lazy import works without circular issues. | PASS — returns list of `ParameterType` instances |
| 4 | [x] | Cross-module FK string | `ChartParameter.parameter` (was the model holding the relocated FK, not `ProjectVisualisation` as the doc draft guessed) resolves at runtime to `module_project.ParameterType`. | PASS |
| 5 | [x] | Indicator catalogue integrity | For every ProfileType: `key_parameter_indicators ⊆ ParameterType.parameter_code` and `key_growth_indicators ⊆ GrowthIndicator.code` (or NULL). | PASS — all 8 (4 profiles × 2 arrays) zero orphans |
| 6 | [x] | `is_key_parameter` integrity | For every project, the set of flagged parameter codes **equals** the profile's `key_parameter_indicators`. | PASS — all 3 projects match exactly |
| 7 | [x] | New API endpoints | `GET /api/profile-types/` (200, count=4, themes are real per-profile colours, no `#888888`); `/api/parameter-types/` (200, count=22); `/api/growth-indicators/` (200, count=11). All flat lists. | PASS — 4/22/11, no placeholders |
| 8 | [x] | Existing API regression | `GET /api/projects/` (200, RBAC-scoped); `GET /api/projects/<id>/` (200, detail); `GET /api/projects/<id>/cycles/` (200) — ensures Phase 3's relocation didn't break ProjectViewSet's profile-aware actions. | PASS — all three 200 |
| 9 | [x] | Auth gate | Anonymous `GET /api/profile-types/` → 401. | PASS |

### B. Browser smoke (user-driven)

| No. | Done | Area | Step | Pass criterion |
|---|---|---|---|---|
| 10 | [ ] | Admin index | `/admin/` — "Module Project" section shows exactly **4 entries**: ProfileType, Project, ParameterType, GrowthIndicator. (ProjectParameterSetting is inline-only — should NOT appear standalone.) | 4 entries; no ProjectParameterSetting standalone |
| 11 | [ ] | ProfileType list | `/admin/module_project/profiletype/` — list shows 4 rows with `code` + `name` + per-row Edit button. | All 4 visible, Edit buttons present |
| 12 | [ ] | ProfileType change form | Open any profile (e.g., shrimp) — confirm Theme section shows **3 colour swatches** (`Primary colour`, `Gradient start`, `Gradient end`). Stages + Key-indicator fieldsets visible. Audit fieldset collapsed. | All 3 colour pickers render |
| 13 | [ ] | ProfileType colour round-trip | On the shrimp profile: change `theme_primary` from `#0c9286` to something like `#ff00ff`, save. Reload the page → confirm the new value persisted. Then restore to `#0c9286`. | Save persists; reload shows new colour |
| 14 | [ ] | Project change form | Open any project — confirm `ProjectParameterSetting` inline table renders at the bottom; the `parameter` column is an **autocomplete typeahead** (search by typing). Edit a row's `min_threshold` and save → reload confirms persistence. | Inline visible; autocomplete works; edit persists |
| 15 | [ ] | Standalone gone | Navigate to `/admin/module_project/projectparametersetting/` → expect 404 (or no link in admin index). | Page does not exist as a standalone admin |
| 16 | [ ] | FE regression | Start the FE dev server (`npm run dev` in `frontend/`). Log in (existing demo creds). Navigate Dashboard → Overview → Historical for an existing project. **The FE still reads hardcoded config — confirm pages render exactly as before Part 1.** | App loads, no console errors, all pages render |

---

## Verification Block — Programmatic Smoke (items 1-9)

Run this as one shell command. Each section is independent; failures print clearly.

```bash
# 1. Fresh DB reload (in case any other work has touched the scratch DB)
export PGPASSWORD='aquaculture'
dropdb -h localhost -U postgres --if-exists aquaculture
createdb -h localhost -U postgres aquaculture
psql -h localhost -U postgres -d aquaculture -v ON_ERROR_STOP=1 -q \
    -f backend/sql/aquashield_current_local_share.sql

# 2. Django check
python manage.py check

# 3. Whole-arc programmatic smoke
python manage.py shell <<'PY'
import sys
from rest_framework.test import APIClient
from module_user.models import User
from module_project.models import (
    GrowthIndicator, ParameterType, ProfileType, Project, ProjectParameterSetting,
)
from module_sensor.models import SensorType

failures = []
def expect(label, cond, detail=""):
    print(f"  {'✅' if cond else '❌'}  {label}  {detail if not cond else ''}")
    if not cond:
        failures.append(label)

# --- 1. Counts ---
print("\n[1] Counts")
expect("ProfileType==4", ProfileType.objects.count() == 4, f"got {ProfileType.objects.count()}")
expect("ParameterType==22", ParameterType.objects.count() == 22, f"got {ParameterType.objects.count()}")
expect("GrowthIndicator==11", GrowthIndicator.objects.count() == 11, f"got {GrowthIndicator.objects.count()}")
expect("ProjectParameterSetting==41", ProjectParameterSetting.objects.count() == 41, f"got {ProjectParameterSetting.objects.count()}")
expect("Project>=3", Project.objects.count() >= 3, f"got {Project.objects.count()}")

# --- 2. Model relocation ---
print("\n[2] Model relocation")
try:
    from module_sensor.models import ParameterType as _PT  # noqa
    expect("module_sensor no longer exports ParameterType", False, "ImportError expected")
except ImportError:
    expect("module_sensor no longer exports ParameterType", True)

# --- 3. Lazy-import wiring ---
print("\n[3] SensorType.get_parameters() lazy import")
st = SensorType.objects.filter(parameter_ids__len__gt=0).first()
if st:
    params = st.get_parameters()
    expect("get_parameters returns ParameterType list", len(params) > 0 and all(isinstance(p, ParameterType) for p in params))
else:
    expect("SensorType has at least one row with parameter_ids", False, "no sensor_types with params")

# --- 4. Cross-module FK string (module_chart) ---
print("\n[4] module_chart FK string resolution")
from module_chart.models import ProjectVisualisation  # noqa
fk_field = ProjectVisualisation._meta.get_field('parameter')
expect("module_chart parameter FK -> module_project.ParameterType",
       fk_field.related_model is ParameterType,
       f"got {fk_field.related_model}")

# --- 5. Indicator catalogue integrity ---
print("\n[5] Indicator catalogue integrity")
param_codes  = set(ParameterType.objects.values_list('parameter_code', flat=True))
growth_codes = set(GrowthIndicator.objects.values_list('code', flat=True))
for pt in ProfileType.objects.all().order_by('code'):
    bad_kp = set(pt.key_parameter_indicators or []) - param_codes
    bad_kg = set(pt.key_growth_indicators or []) - growth_codes
    expect(f"  {pt.code}.key_parameter_indicators subset of catalogue", not bad_kp, f"orphans={bad_kp}")
    expect(f"  {pt.code}.key_growth_indicators subset of catalogue", not bad_kg, f"orphans={bad_kg}")

# --- 6. is_key_parameter integrity ---
print("\n[6] is_key_parameter mirror")
for p in Project.objects.select_related('profile_type').order_by('name'):
    flagged = set(ProjectParameterSetting.objects.filter(project=p, is_key_parameter=True).values_list('parameter__parameter_code', flat=True))
    expected = set(p.profile_type.key_parameter_indicators or [])
    expect(f"  {p.name} flagged == profile's key array", flagged == expected, f"diff={(flagged ^ expected)}")

# --- 7. New API endpoints ---
print("\n[7] New API endpoints")
user = User.objects.filter(is_active=True).first()
client = APIClient(); client.force_authenticate(user=user)
H = {'HTTP_HOST': 'localhost'}
for url, expected_count in [
    ('/api/profile-types/', 4),
    ('/api/parameter-types/', 22),
    ('/api/growth-indicators/', 11),
]:
    r = client.get(url, **H)
    body = r.json() if r.status_code == 200 else None
    expect(f"  GET {url}", r.status_code == 200 and isinstance(body, list) and len(body) == expected_count,
           f"status={r.status_code} body_type={type(body).__name__}")
# Themes are real
themes = {row['code']: row['theme']['primary'] for row in client.get('/api/profile-types/', **H).json()}
expect("  No #888888 placeholders", '#888888' not in themes.values(), f"themes={themes}")

# --- 8. Existing API regression ---
print("\n[8] Existing API regression")
r_list = client.get('/api/projects/', **H)
expect("  GET /api/projects/ -> 200", r_list.status_code == 200, f"status={r_list.status_code}")
plist = r_list.json()
plist = plist['results'] if isinstance(plist, dict) and 'results' in plist else plist
if plist:
    pid = plist[0]['project_id']
    r_detail = client.get(f'/api/projects/{pid}/', **H)
    expect(f"  GET /api/projects/{{id}}/ -> 200", r_detail.status_code == 200, f"status={r_detail.status_code}")
    r_cycles = client.get(f'/api/projects/{pid}/cycles/', **H)
    expect(f"  GET /api/projects/{{id}}/cycles/ -> 200", r_cycles.status_code == 200, f"status={r_cycles.status_code}")

# --- 9. Auth gate ---
print("\n[9] Auth gate")
anon = APIClient()
r = anon.get('/api/profile-types/', **H)
expect("  anon /api/profile-types/ -> 401", r.status_code == 401, f"status={r.status_code}")

# --- Summary ---
print()
if failures:
    print(f"FAIL: {len(failures)} item(s) failed:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("ALL GREEN ✅")
PY
```

Expected: `ALL GREEN ✅`. Any line with ❌ is a real gap that needs fixing before Phase 9 closes.

---

## Browser Smoke Walkthrough (items 10-16)

### Setup

```bash
cd backend && source venv/bin/activate && python manage.py runserver
# in a second terminal
cd frontend && npm run dev
```

### 10. Admin index

- Open `http://localhost:8000/admin/` and log in as the superuser.
- In the "Module Project" section, count entries → should be **4**:
  - Growth Indicators
  - Parameter Types
  - Profile Types
  - Projects
- Specifically confirm **no "Parameter Settings"** or "Project Parameter Settings" entry.

### 11. ProfileType list

- Click "Profile Types" → see all 4 rows (shrimp, fish, crab_hatchery, treatment).
- Each row has a per-row "Edit" button on the right.

### 12. ProfileType change form

- Click any profile (e.g., shrimp).
- Scroll to **Theme** section → should see 3 fields with native colour swatches (a coloured rectangle next to each label).
- Audit section is collapsed by default.

### 13. ProfileType colour round-trip

- On shrimp, click the **Primary colour** swatch → browser's colour picker opens.
- Pick a clearly different colour (e.g., bright magenta `#ff00ff`).
- Click "Save".
- Reload `/admin/module_project/profiletype/<shrimp-id>/change/` → confirm the new primary colour persisted.
- **Restore** to `#0C9286` afterwards (this is the source-of-truth seed value).

### 14. Project change form

- Navigate to any project (e.g., "Demo Shrimp Farm").
- Scroll to the bottom — **Parameter settings** inline table should render with the 4 existing rows.
- Click into the `parameter` field of any row → **typeahead** should let you search by code/name.
- Change a `min_threshold` value (note the original first!), save, reload → confirm persistence. Then restore.

### 15. Standalone gone

- Visit `http://localhost:8000/admin/module_project/projectparametersetting/` directly.
- Expect **Page not found (404)** or "You don't have permission" depending on routing.
- Confirm there's no link to this URL anywhere in the admin index.

### 16. FE regression

- In a browser, open `http://localhost:5173/` (Vite dev server).
- Log in with any existing demo user.
- Navigate the dashboard / overview / historical pages. Pick at least one project of each profile type if possible.
- **No console errors. All pages render as before Part 1.** (FE still reads hardcoded config — that's expected; Part 2 changes that.)

---

## Risks / Things to Watch

| Risk | Mitigation |
|---|---|
| Existing user's session DB might already be loaded with stale Phase 7 data (placeholder `#888888`) | The script starts with a fresh `dropdb`+`createdb`+seed-load. Browser smoke happens against the freshly-loaded DB. |
| Frontend FE consumes a stale cached `/api/profile-types/` (unlikely — it doesn't yet call it) | Hard refresh (Cmd+Shift+R) clears any cache. The FE in Phase 9 should not be calling these endpoints — Part 2 wires them. |
| Demo user credentials might be stale after the DB reset | Seed file restores demo users — they're in `users` INSERTs. No new credentials needed. |
| `SensorType.parameter_ids__len__gt=0` may not work with `managed=False` ArrayField | If the lookup fails, fall back to `.exclude(parameter_ids__isnull=True).exclude(parameter_ids=[])`. Or simpler: iterate and break on the first valid one. |
| `module_chart.ProjectVisualisation` may not be the right model name (verify before running) | Phase 9 grepping confirms — adjust the import in the smoke if the model is named differently. |

---

## Out of Scope for Phase 9

| Phase / Arc | Work |
|---|---|
| Phase 10 | Docs + file-touch tracker. |
| Part 2 | Frontend consumes the new endpoints; retire `frontend/src/config/profiles/`. |
| Two-repo port | Mirror the Part 1 changes into the prod repo (`/Users/thetnaungsoe/Desktop/AquaMonitoringv2`) — happens on explicit user signal. |

**Not in this phase:** new code, model changes, SQL changes, admin changes, view changes, FE work, port to prod, commits.

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | Programmatic smoke prints `ALL GREEN` (23/23 assertions pass) |
| [ ] | Admin index shows 4 entries (no standalone ProjectParameterSetting) — pending browser |
| [ ] | ProfileType change form renders 3 colour swatches — pending browser |
| [ ] | Colour-picker save+reload round-trip persists — pending browser |
| [ ] | Project change form has inline `ProjectParameterSetting` with autocomplete on `parameter` — pending browser |
| [ ] | `/admin/module_project/projectparametersetting/` is 404 — pending browser |
| [ ] | FE dev server boots, login works, no console errors on existing pages — pending browser |

---

## Files Touched in Phase 9

**None** — validation phase. If a gap surfaces during smoke, it gets fixed under its originating phase (e.g., a Phase 6 admin bug gets a Phase 6 follow-up edit) and Phase 9 re-runs the smoke. Phase 9 itself produces no diffs.

---

*Last updated: 2026-05-22*
