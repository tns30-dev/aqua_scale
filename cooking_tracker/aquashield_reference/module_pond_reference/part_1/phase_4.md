# Part 1 — Phase 4 — Admin Polish

---

## Goal

Bring `module_pond/admin.py` to the polish level of `module_project/admin.py` post-project-mgmt. Every admin in this module currently uses vanilla `admin.ModelAdmin`; Phase 4 upgrades all 6 to Unfold, adds per-row Edit buttons, list filters, fieldsets, and surfaces the audit columns Phases 1-3 added. Plus the headline UX win: `PondTreatment` as an **inline** under `PondAdmin` so admins manage treatments alongside the pond.

---

## What's NOT in scope

- **Custom JSON editor for `Pond.metadata`** — shape is freeform (company / GPS / biomass / …). Stays as the default JSONB textarea; building a structured editor for unstructured data is wasteful.
- **Custom editor for `CycleStageMetric.metrics`** — same reasoning. Plus admins rarely hand-edit this (it's computed by the chart pipeline). Stays a JSONB textarea.
- **Stage_config-style structured editor** — that's project-mgmt territory (Phase 6e there). The Pond module has no analogous "list of structured rows" JSONB.

---

## Per-admin work

### `PondAdmin`

Currently: `list_display = ['name', 'project', 'pond_id']`, `readonly_fields = ['pond_id']`. Plain `admin.ModelAdmin`.

After:
- Base class → `unfold.admin.ModelAdmin`.
- `list_display`: `['name', 'project', 'status', 'edit_link']`. Drop `pond_id` from changelist (UUIDs don't help scan).
- `list_filter`: `['status', 'project']`.
- `search_fields`: `['name']`.
- `readonly_fields`: `['pond_id', 'created_at', 'updated_at', 'created_by', 'updated_by']`.
- `fieldsets`: Identity / Description / Metadata / Status / Audit (collapsed).
- `inlines = [PondTreatmentInline]`.
- `edit_link` method (mirrors `module_user/admin.py:114` pattern).

### `CycleAdmin`

Currently: `list_display = ['pond', 'start_date', 'end_date', 'status', 'current_day']`, readonly `['cycle_id', 'created_at', 'current_day']`. Plain.

After:
- Base class → `unfold.admin.ModelAdmin`.
- `list_display`: `['pond', 'start_date', 'end_date', 'status', 'current_day', 'edit_link']`.
- `list_filter`: `['status', 'pond__project']` (project-level filter is more useful than pond-level).
- `search_fields`: `['pond__name']`.
- `readonly_fields`: `['cycle_id', 'current_day', 'created_at', 'updated_at', 'created_by', 'updated_by']`.
- `fieldsets`: Identity / Lifecycle / Audit (collapsed).
- `edit_link` method.

### `CycleDailyHealthAdmin`

Currently: `list_display = ['cycle', 'day_number', 'date', 'health_status', 'alert_count']`, readonly `['health_id', 'created_at']`. Plain.

After:
- Base class → `unfold.admin.ModelAdmin`.
- `list_display`: stays the same + `'edit_link'`.
- `list_filter`: `['health_status', 'cycle__pond__project']`.
- `readonly_fields`: `['health_id', 'created_at', 'updated_at', 'created_by', 'updated_by']`.
- `edit_link` method.

### `CycleStageMetricAdmin`

Currently: `list_display = ['cycle', 'stage_name', 'calculated_at']`, readonly `['metric_id', 'calculated_at']`. Plain.

After:
- Base class → `unfold.admin.ModelAdmin`.
- `list_display`: `['cycle', 'stage_name', 'calculated_at', 'edit_link']`.
- `list_filter`: `['stage_name', 'cycle__pond__project']`.
- `readonly_fields`: `['metric_id', 'calculated_at', 'created_at', 'updated_at', 'created_by', 'updated_by']`.
- `edit_link` method.

### `TreatmentAdmin`

Currently: `list_display = ['name', 'code', 'is_active', 'updated_at']`, readonly `['treatment_id', 'created_at', 'updated_at']`. Plain.

After:
- Base class → `unfold.admin.ModelAdmin`.
- `list_display`: `['name', 'is_active', 'updated_at', 'edit_link']`. **Drop `code`** from changelist per the convention established in project-mgmt (code stays in search_fields; searchable but not shown).
- `list_filter`: `['is_active']`.
- `search_fields`: `['name', 'code']` — required by the autocomplete on `PondTreatmentInline.treatment`.
- `readonly_fields`: stays `['treatment_id', 'created_at', 'updated_at']`.
- `edit_link` method.

### `PondTreatmentAdmin` + `PondTreatmentInline`

The standalone `PondTreatmentAdmin` stays (admins can also browse pond treatments globally), polished similarly. **New**: `PondTreatmentInline` registered under `PondAdmin` so admins create/edit treatments while editing the pond.

`PondTreatmentInline` (TabularInline):
```python
model = PondTreatment
fk_name = 'pond'
extra = 0
fields = ('treatment', 'started_at', 'ended_at', 'notes')
autocomplete_fields = ['treatment']
verbose_name = 'Treatment'
verbose_name_plural = 'Treatments'
```

`PondTreatmentAdmin` standalone:
- Base class → `unfold.admin.ModelAdmin`.
- `list_display`: `['pond', 'treatment', 'started_at', 'ended_at', 'is_active', 'edit_link']`.
- `list_filter`: `['pond__project']`.
- `search_fields`: `['pond__name', 'treatment__name', 'notes']`.
- `readonly_fields`: `['pond_treatment_id', 'created_at', 'updated_at', 'is_active']`.
- `autocomplete_fields = ['pond', 'treatment']`.
- `edit_link` method.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `admin.py` — imports | Top-of-file imports include `unfold.admin.ModelAdmin/TabularInline`, `django.urls.reverse`, `django.utils.html.format_html`. | done |
| 2 | [x] | `admin.py` — `PondTreatmentInline` | TabularInline with `autocomplete_fields=['treatment']`. | done |
| 3 | [x] | `PondAdmin` upgrade | Unfold, `list_display = [name, project, status, edit_link]`, `list_filter = [status, project]`, fieldsets (Identity/Description/Metadata/Status/Audit), `inlines = [PondTreatmentInline]`. | done — admin registry confirms |
| 4 | [x] | `CycleAdmin` upgrade | Unfold; Identity/Lifecycle/Audit fieldsets; `current_day` + `edit_link` columns; `list_filter = [status, pond__project]`. | done |
| 5 | [x] | `CycleDailyHealthAdmin` upgrade | Unfold; `edit_link`; `list_filter = [health_status, cycle__pond__project]`. | done |
| 6 | [x] | `CycleStageMetricAdmin` upgrade | Unfold; `edit_link`; `list_filter = [stage_name, cycle__pond__project]`. | done |
| 7 | [x] | `TreatmentAdmin` upgrade | Unfold; `code` dropped from `list_display` but retained in `search_fields=['name','code','description']` (autocomplete works); `list_filter = [is_active]`. | done |
| 8 | [x] | `PondTreatmentAdmin` upgrade | Unfold; `edit_link`; `autocomplete_fields = [pond, treatment]`; `list_filter = [pond__project]`. | done |
| 9 | [x] | Verification — `manage.py check` | Exit 0 (only pre-existing staticfiles.W004). | ✅ |
| 10 | [ ] | Verification — browser smoke (user) | Open each of the 6 admin pages; PondTreatment inline visible on Pond change form; autocomplete on `treatment` works. | **Pending manual smoke** |

---

## Verification Block — after item 8

```bash
cd backend && source venv/bin/activate
python manage.py check

# Sanity: confirm Unfold base + admin URL resolution
python manage.py shell <<'PY'
from django.contrib import admin as dj_admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from module_pond.models import Pond, Cycle, CycleDailyHealth, CycleStageMetric, Treatment, PondTreatment

for model in (Pond, Cycle, CycleDailyHealth, CycleStageMetric, Treatment, PondTreatment):
    site_admin = dj_admin.site._registry[model]
    is_unfold = isinstance(site_admin, UnfoldModelAdmin)
    has_edit_link = 'edit_link' in (site_admin.list_display or [])
    print(f"  {model.__name__:25s}  unfold={is_unfold}  edit_link={has_edit_link}  list_filter={getattr(site_admin, 'list_filter', None)}")
PY
```

Expected:
- All 6 models registered with Unfold's `ModelAdmin`.
- All 6 have `edit_link` in `list_display`.
- `list_filter` set per the per-admin table above.

---

## Browser smoke walkthrough (item 10)

1. `/admin/module_pond/pond/` — see 16 ponds. Columns: name, project, status, Edit. Sidebar filters by status + project. Open `Pond A` → form has Identity / Description / Metadata / Status / Audit fieldsets. **Treatment inline visible** at the bottom with an "Add another Treatment" row + autocomplete on the treatment FK.
2. `/admin/module_pond/cycle/` — list shows pond / dates / status / current day / Edit. Filters by status + project. Open a cycle → audit fieldset collapsed.
3. `/admin/module_pond/cycledailyhealth/` — list filterable by health_status + project.
4. `/admin/module_pond/cyclestagemetric/` — list filterable by stage_name + project. Metrics JSON shown as the default textarea.
5. `/admin/module_pond/treatment/` — name + is_active + updated_at + Edit. Filter by is_active. Search by name OR code.
6. `/admin/module_pond/pondtreatment/` — pond + treatment + dates + is_active + Edit. Autocomplete on pond + treatment.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `PondTreatmentInline.autocomplete_fields = ['treatment']` requires `TreatmentAdmin.search_fields` | Item 7 explicitly adds `search_fields=['name', 'code']` for this reason. |
| Switching to `unfold.admin.ModelAdmin` subtly changes existing list_display rendering | Compare browser shots if anything looks off. The class swap is identical-API in 99% of cases. |
| `PondTreatment.is_active` is a property (derived from dates), not a column | Already in `readonly_fields` today. `list_display` includes it — Django allows callable + property + computed values. No change. |
| Unfold's autocomplete widget requires the autocomplete *AJAX endpoint* (`/admin/autocomplete/`) — Django's stock | Already configured app-wide; works in module_project. No setup needed. |
| `cycle__pond__project` filter spans 2 hops — could be slow on huge tables | Tables are small (≤41 rows). Acceptable. |

---

## Out of scope

| Item | Where |
|---|---|
| Custom JSON editor for `Pond.metadata` / `CycleStageMetric.metrics` | Out of scope per top of doc — variable shapes, rarely hand-edited |
| Cycle inline under PondAdmin | Decision: too much clutter on the pond form. Cycles stay standalone. |
| Treatment seed catalogue rows | Phase 7 |
| Serializers / views | Phase 5 + 6 |
| Browser screenshots / styling tweaks | Out of scope; relies on Unfold's defaults |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | All 6 admins inherit from `unfold.admin.ModelAdmin` |
| [x] | All 6 admins expose an `edit_link` column in `list_display` |
| [x] | `list_filter` configured per the per-admin table |
| [x] | `PondTreatmentInline` registered under `PondAdmin` with autocomplete on `treatment` |
| [x] | `TreatmentAdmin.search_fields = ['name', 'code']` (kept the existing 3-field list incl. `'description'`; autocomplete works against `name`+`code`) |
| [x] | `manage.py check` exits 0 |
| [ ] | Browser smoke (user-verified) confirms each changelist + change-form renders cleanly — pending visual confirm |

---

## Files Touched in Phase 4

| File | What changed |
|---|---|
| `backend/module_pond/admin.py` | Full rewrite: all 6 admins upgraded to `unfold.admin.ModelAdmin`. Added `PondTreatmentInline` (TabularInline) registered under `PondAdmin`. Added `edit_link` method on each admin. Refreshed `list_display`, `list_filter`, `readonly_fields`, and `fieldsets` per the per-admin table above. `TreatmentAdmin` gains `search_fields=['name', 'code']` to unblock the inline autocomplete. |

---

*Last updated: 2026-05-23*
