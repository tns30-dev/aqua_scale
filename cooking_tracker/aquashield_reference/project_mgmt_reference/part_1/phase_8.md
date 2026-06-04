# Part 1 — Phase 8 — Seed Profile Themes + Fix Indicator Arrays + Populate `is_key_parameter`

---

## Goal

Make the four existing profile rows render correctly in Part 2 by fixing the four data quirks surfaced during earlier phases:

1. **Theme is the placeholder `#888888`** on every row — `/api/profile-types/` returns visually identical (grey) themes for shrimp/fish/crab_hatchery/treatment. Part 2 needs the real colours.
2. **`key_parameter_indicators` holds growth metrics by mistake** (the seed swap bug). Shrimp has `body_weight, daily_gain, fcr, mortality_rate` here — all growth metrics, not sensor parameters.
3. **`key_growth_indicators` is NULL on all four rows** — the column where the growth metrics belong is empty.
4. **`project_parameter_settings.is_key_parameter` is FALSE on all 39 rows** — no project flags any parameter as key. Part 2's "highlight key parameters" rendering would be empty.

Plus one minor data fix: **fish's `feed_conversion_ratio` doesn't exist in the `GrowthIndicator` catalogue** — the actual code is `fcr`. Fix to `fcr` while we're moving it.

---

## Why bundle all four

Each one alone is a 5-line fix, but they share the same target rows + same workflow (edit `aquashield_current_local_share.sql`, drop/recreate DB, verify). Splitting them into 4 phases would be ceremony for ceremony's sake. They're also load-bearing **together** for Part 2 — fixing only theme would still leave the FE rendering an empty "key parameters" list.

---

## Source of truth — proposed values

### Theme (from `frontend/src/config/profiles/`)

| Profile | primary | gradient.from | gradient.to | Source |
|---|---|---|---|---|
| shrimp | `#0C9286` | `#0C9286` | `#00796B` | `shrimpProfile.ts:8-15` |
| fish | `#7C3AED` | `#7C3AED` | `#6D28D9` | `fishProfile.ts:8-15` |
| crab_hatchery | `#F97316` | `#F97316` | `#FB923C` | `index.ts:20-25` |
| treatment | `#06B6D4` | `#06B6D4` | `#22D3EE` | `index.ts:36-41` |

`secondary` and `accent` from the FE config are **dropped** — they were never consumed by any FE component (verified earlier during Phase 1 discussion; that's why theme JSONB is `{primary, gradient}` only).

### `key_parameter_indicators` (sensor parameters only — must be a subset of `parameter_types.parameter_code`)

| Profile | Proposed value | Rationale |
|---|---|---|
| shrimp | `['temperature', 'ph', 'dissolved_oxygen', 'salinity']` | FE `shrimpProfile.ts` priority 1-4 |
| fish | `['temperature', 'ph', 'dissolved_oxygen', 'ammonia']` | FE `fishProfile.ts` priority 1-4 |
| crab_hatchery | `['temperature', 'ph', 'dissolved_oxygen', 'salinity', 'calcium']` | ERD seed description flags calcium (molting) + salinity (estuarine) as critical |
| treatment | `['ph', 'alkalinity', 'turbidity', 'dissolved_oxygen']` | Water-treatment-relevant sensor set (treatment has no FE config) |

All proposed codes verified against `ParameterType.objects.values_list('parameter_code')` — exist in the catalogue.

### `key_growth_indicators` (growth metrics only — must be a subset of `growth_indicators.code`)

| Profile | Proposed value | Rationale |
|---|---|---|
| shrimp | `['body_weight', 'daily_gain', 'fcr', 'mortality_rate']` | Moved from the misplaced `key_parameter_indicators` |
| fish | `['disease_risk_index', 'length_gained', 'fcr', 'condition_factor']` | Moved + **`feed_conversion_ratio` → `fcr`** (existing entry doesn't match catalogue) |
| crab_hatchery | `['water_quality_index', 'stress_index', 'survival_proxy']` | Moved (calcium goes to sensor params instead) |
| treatment | `NULL` | Treatment doesn't track growth metrics — water purification, not organism cultivation |

All proposed codes verified against `GrowthIndicator.objects.values_list('code')` — exist in the catalogue. The previously-invalid `feed_conversion_ratio` is renamed to `fcr`.

### `is_key_parameter` (on `project_parameter_settings`)

Derive from the **corrected** `key_parameter_indicators`. A single SQL UPDATE statement at the end of the seed file:

```sql
UPDATE project_parameter_settings pps
SET is_key_parameter = TRUE
FROM projects p
JOIN profile_types pt ON pt.profile_type_id = p.profile_type_id
JOIN parameter_types prm ON prm.parameter_id = pps.parameter_id
WHERE pps.project_id = p.project_id
  AND prm.parameter_code = ANY(pt.key_parameter_indicators);
```

Semantics: a project_parameter_setting row is flagged key if its parameter's code appears in the project's profile's `key_parameter_indicators`. Per D1, this mirrors the template — admins can override later via the inline.

---

## Approach — inline INSERTs vs UPDATEs

Two seed edits, two different strategies:

| Target | Strategy | Why |
|---|---|---|
| `profile_types` (4 rows) | **Inline edit the existing INSERTs** — add `theme` column to the column list + value tuples; fix `key_parameter_indicators` + `key_growth_indicators` in place. | The INSERTs already exist; editing 4 lines beats appending 4 UPDATEs that just patch what we should've inserted. |
| `project_parameter_settings` (39 rows) | **Append one UPDATE statement** at the end of the seed file. | Editing 39 inline values is a slog. The flag is derivable in one SQL with a JOIN. Easier to write, easier to re-derive if the indicator arrays change later. |

Both edits target `backend/sql/aquashield_current_local_share.sql`. Phase 1's pattern (drop/recreate scratch DB) applies again.

---

## Final Target for This Phase

```text
backend/sql/aquashield_current_local_share.sql

  -- existing block, edited inline:
  INSERT INTO public.profile_types (..., theme) VALUES (..., '{...real theme JSONB...}');  ← x4 rows
    - column list gains `theme`
    - shrimp/fish/crab_hatchery/treatment indicator arrays fixed

  -- new statement appended at the end:
  UPDATE project_parameter_settings pps
  SET is_key_parameter = TRUE
  FROM projects p
  JOIN profile_types pt ON pt.profile_type_id = p.profile_type_id
  JOIN parameter_types prm ON prm.parameter_id = pps.parameter_id
  WHERE pps.project_id = p.project_id
    AND prm.parameter_code = ANY(pt.key_parameter_indicators);
```

No model changes. No admin changes. No view changes. No FE changes.

---

## Checklist Tracking

| No. | Done | Area | Step | Expected Result | Verification |
|---|---|---|---|---|---|
| 1 | [x] | SQL — column list | In `aquashield_current_local_share.sql`, add `theme` to the column list on each of the 4 `INSERT INTO public.profile_types` statements (lines ~4563-4566). | Column list ends `..., updated_by, theme` | grep |
| 2 | [x] | SQL — shrimp row | Edit shrimp INSERT (line ~4564): `key_parameter_indicators` → `'{temperature,ph,dissolved_oxygen,salinity}'`; `key_growth_indicators` → `'{body_weight,daily_gain,fcr,mortality_rate}'`; add `theme` value `'{"primary":"#0C9286","gradient":{"from":"#0C9286","to":"#00796B"}}'`. | Row reflects shrimp theme + corrected arrays | scratch reload ✅ |
| 3 | [x] | SQL — fish row | Edit fish INSERT (line ~4566): `key_parameter_indicators` → `'{temperature,ph,dissolved_oxygen,ammonia}'`; `key_growth_indicators` → `'{disease_risk_index,length_gained,fcr,condition_factor}'` (note: `feed_conversion_ratio` → `fcr`); add `theme` `'{"primary":"#7C3AED","gradient":{"from":"#7C3AED","to":"#6D28D9"}}'`. | Row reflects fish theme + corrected arrays | scratch reload ✅ |
| 4 | [x] | SQL — crab_hatchery row | Edit crab_hatchery INSERT (line ~4565): `key_parameter_indicators` → `'{temperature,ph,dissolved_oxygen,salinity,calcium}'`; `key_growth_indicators` → `'{water_quality_index,stress_index,survival_proxy}'`; add `theme` `'{"primary":"#F97316","gradient":{"from":"#F97316","to":"#FB923C"}}'`. | Row reflects crab_hatchery theme + corrected arrays | scratch reload ✅ |
| 5 | [x] | SQL — treatment row | Edit treatment INSERT (line ~4563): `key_parameter_indicators` → `'{ph,alkalinity,turbidity,dissolved_oxygen}'`; `key_growth_indicators` stays NULL; add `theme` `'{"primary":"#06B6D4","gradient":{"from":"#06B6D4","to":"#22D3EE"}}'`. | Row reflects treatment theme + corrected arrays | scratch reload ✅ |
| 6 | [x] | SQL — `is_key_parameter` UPDATE | Append the UPDATE statement at the end of the seed file. **Two corrections during execution:** (a) Schema-qualify all table refs (`public.project_parameter_settings` etc.) — the seed file sets `search_path=''` at line 13; (b) use comma-separated FROM (`FROM public.projects p, public.profile_types pt, public.parameter_types prm`) instead of `JOIN ... ON` — Postgres rejects references to the UPDATE target table inside non-leftmost JOIN ON clauses. | Statement present in file | scratch reload ✅ |
| 6b | [x] | SQL — missing dissolved_oxygen rows | **Added during verification:** 2 missing `project_parameter_settings` rows for Demo Fish Farm + Demo Shrimp Farm (thresholds 5-10 per FE config). Without these, the UPDATE couldn't flag DO because the rows didn't exist. Now total=41, flagged=13. | Per-project flagged set matches profile array exactly | spot-check ALL MATCH: True |
| 7 | [x] | Reload scratch DB | Drop and recreate the local DB; psql -f the seed file. | No SQL errors | psql exit=0 on final reload |
| 8 | [x] | Verification — `manage.py check` | Exit 0 | Django config valid | check exit=0 (only pre-existing staticfiles.W004) |
| 9 | [x] | Verification — profile theme via API | Shell smoke: `GET /api/profile-types/` returns real per-profile theme JSONB (no `#888888` placeholders); spot-check shrimp.theme.primary == "#0C9286" etc. | All 4 themes correct | shrimp=#0C9286, fish=#7C3AED, crab_hatchery=#F97316, treatment=#06B6D4 — all real |
| 10 | [x] | Verification — indicator arrays | Shell smoke: each profile's `key_parameter_indicators` is a subset of `ParameterType.parameter_code`; each `key_growth_indicators` is a subset of `GrowthIndicator.code` (or NULL for treatment). | No orphan codes | bad_kp=OK and bad_kg=OK for all 4 profiles |
| 11 | [x] | Verification — `is_key_parameter` | Shell smoke: `ProjectParameterSetting.objects.filter(is_key_parameter=True).count()` > 0; spot-check one project to confirm flagged params match its profile's `key_parameter_indicators`. | Flags populated | total=41, flagged=13, ALL MATCH=True across all 3 demo projects |

---

## Verification Block — to run after item 8

```bash
# 1. Django config check
python manage.py check

# 2. Theme + indicator + flag smoke
python manage.py shell <<'PY'
from rest_framework.test import APIClient
from module_user.models import User
from module_project.models import (
    GrowthIndicator, ParameterType, ProfileType, ProjectParameterSetting,
)

H = {'HTTP_HOST': 'localhost'}
user = User.objects.filter(is_active=True).first()
client = APIClient()
client.force_authenticate(user=user)

# --- 1. Theme via API ---
print("--- /api/profile-types/ themes ---")
r = client.get('/api/profile-types/', **H)
for row in r.json():
    print(f"  {row['code']:>15s}  theme={row['theme']}")

# --- 2. Indicator subset check ---
print("\n--- Indicator catalogue subset check ---")
param_codes  = set(ParameterType.objects.values_list('parameter_code', flat=True))
growth_codes = set(GrowthIndicator.objects.values_list('code', flat=True))
for pt in ProfileType.objects.all().order_by('code'):
    kp = set(pt.key_parameter_indicators or [])
    kg = set(pt.key_growth_indicators or [])
    bad_kp = kp - param_codes
    bad_kg = kg - growth_codes
    print(f"  {pt.code:>15s}  kp={sorted(kp)}  bad_kp={bad_kp or '∅'}  kg={sorted(kg)}  bad_kg={bad_kg or '∅'}")

# --- 3. is_key_parameter populated ---
print("\n--- is_key_parameter rollup ---")
total = ProjectParameterSetting.objects.count()
flagged = ProjectParameterSetting.objects.filter(is_key_parameter=True).count()
print(f"  total settings: {total}  flagged: {flagged}")

# Spot-check one project: the flagged params should equal the profile's key array
from module_pond.models import Pond  # unused but proves env
from module_project.models import Project
proj = Project.objects.select_related('profile_type').first()
flagged_codes = set(
    ProjectParameterSetting.objects
    .filter(project=proj, is_key_parameter=True)
    .values_list('parameter__parameter_code', flat=True)
)
expected = set(proj.profile_type.key_parameter_indicators or [])
print(f"  spot-check  project={proj.name}  profile={proj.profile_type.code}")
print(f"    flagged codes:  {sorted(flagged_codes)}")
print(f"    profile key:    {sorted(expected)}")
print(f"    match: {flagged_codes == expected}")
PY
```

Expected:
- Each profile's `theme` is the real per-profile colours (no `#888888`).
- `bad_kp` and `bad_kg` are `∅` (or `∅` shown) for every profile — every code resolves to the catalogue.
- `flagged > 0`; spot-check `match: True`.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| INSERT column-list/value-list misalignment (4 inline edits, easy to typo) | Re-run the seed in a scratch DB and rely on PG to reject mismatched arity. Smoke verifies row content. |
| Postgres ARRAY literal syntax (`'{a,b,c}'` vs `ARRAY['a','b','c']`) | Existing seeds use the curly-brace literal form (`'{body_weight,daily_gain,...}'`). Match that style. |
| JSON-in-SQL escaping (the theme value has double quotes inside single quotes) | Standard pattern: `'{"primary":"#0C9286","gradient":{"from":"#0C9286","to":"#00796B"}}'`. Postgres parses the OUTER single-quote string, json/jsonb type cast (implicit on theme column) parses the inner JSON. |
| `feed_conversion_ratio` → `fcr` rename — if any FE code reads the old name, it'll break in Part 2 | Part 2 reads from the API; the API serialises whatever's in the column. Phase 8 is the right place to fix because the FE will see the corrected name immediately. |
| Other modules (chart service, data ingestion) may have hardcoded indicator codes | Spot-checked: `grep -rn "feed_conversion_ratio" backend/` returns no matches outside the SQL seed. No other module relies on the old code. |
| UPDATE timing — must run AFTER profile_types AND project_parameter_settings INSERTs | Append at the END of the seed file (after all data INSERTs). |
| `treatment` projects (if any exist) — its `key_parameter_indicators` is now non-empty, so its is_key_parameter rows will flip. | This is the intended behaviour. If there are no treatment projects, the UPDATE simply does nothing for that profile. |

---

## Out of Scope for Phase 8

| Phase | Work |
|---|---|
| Phase 9 | Manual smoke across the whole arc. |
| Phase 10 | Docs. |
| Part 2 | FE actually consumes these corrected values. |

**Not in this phase:** model/admin/serializer/view changes, port to prod repo (separate user-signal step), tests.

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | All 4 `profile_types` INSERTs carry real theme JSONB |
| [x] | All 4 profiles have `key_parameter_indicators` containing only `parameter_types.parameter_code` values |
| [x] | All 4 profiles have `key_growth_indicators` containing only `growth_indicators.code` values (or NULL for treatment) |
| [x] | `project_parameter_settings.is_key_parameter` count = 13 (and per-project spot-check matches the profile's key array exactly across all 3 demo projects) |
| [x] | Scratch DB loads without errors |
| [x] | `manage.py check` exits 0 |
| [x] | `GET /api/profile-types/` returns the corrected payload |

---

## Files Touched in Phase 8

To be filled in as items are checked off.

| File | What changed |
|---|---|
| `backend/sql/aquashield_current_local_share.sql` | (1) Added `theme` column to the 4 `profile_types` INSERTs with the real per-profile JSONB. (2) Fixed swapped indicator arrays on all 4 rows. (3) Renamed `feed_conversion_ratio` → `fcr` in fish. (4) Added 2 missing `dissolved_oxygen` rows to `project_parameter_settings` (Demo Fish Farm + Demo Shrimp Farm; thresholds 5-10). (5) Appended one comma-FROM, schema-qualified UPDATE statement to populate `project_parameter_settings.is_key_parameter` from the corrected profile arrays. |

---

*Last updated: 2026-05-22*
