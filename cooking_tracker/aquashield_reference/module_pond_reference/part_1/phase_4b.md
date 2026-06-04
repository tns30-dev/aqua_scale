# Part 1 — Phase 4b — Admin Polish Round 2

---

## Why this phase exists

Phase 4 polished the *structure* of each admin (Unfold, edit_link, list_filter, fieldsets, PondTreatmentInline). Browser smoke surfaced gaps Phase 4 didn't address:

1. **Raw JSON textareas** still in place for `Pond.metadata` + `CycleStageMetric.metrics`. Admins shouldn't hand-edit JSON.
2. **Helper text noise** — model fields carry developer-flavoured `help_text` ("Short machine code (e.g., 'biobloc')", "Operational state. DB CHECK constraint chk_ponds_status mirrors this enum.", etc.) that leaks implementation details into the UI.
3. **Redundant `_id` rows** — every admin lists its UUID PK in `readonly_fields`, which surfaces it on the edit form. Admins don't need UUIDs in their face.

This is **the exact lesson from `feedback_admin_no_ugly_widgets.md`** — audit ALL fields, not just the one flagged. I missed it in Phase 4. Phase 4b retrofits.

---

## Resolved decisions for this phase

### D7 — Both JSONB editors use a simple key/value-pairs widget

User explicitly rejected:
- Profile-coupled schemas (`pond_metadata_schema` on `profile_types`) — too tightly coupled.
- Catalogue tables (`pond_metadata_schemas`) — over-engineered for the value.
- Unified all-fields form — cluttered.

Chosen: **flexible row-based editors**. Admin manages rows with Add/Remove buttons. No predeclared schema.

| Editor | Row shape | Submitted JSON |
|---|---|---|
| **Pond.metadata** | 2 cells: `key` (text) + `value` (text) | `{key1: "value1", key2: "value2", ...}` |
| **CycleStageMetric.metrics** | 4 cells: `parameter_code` (text) + `avg` (number) + `min` (number) + `max` (number) | `{code1: {avg, min, max}, code2: {avg, min, max}, ...}` |

The stage-metric value shape is locked because the live data is 100% `{avg, min, max}` (240/240 rows verified by SQL); admins shouldn't need to know they're filling a nested dict.

Both widgets use the same Alpine.js + custom-template pattern that worked in project-mgmt Phase 6e (stage_config editor).

---

## Scope per concern

### A. Help-text cleanup (model)

Remove `help_text=` from these fields:

| Field | Current text |
|---|---|
| `Treatment.code` | "Short machine code (e.g., 'biobloc')" |
| `Treatment.name` | (verbose if present) |
| `Treatment.description` | (verbose if present) |
| `PondTreatment.*` | (all helper texts) |
| `Pond.status` | "Operational state. DB CHECK constraint chk_ponds_status mirrors this enum." |
| `Pond.metadata` | "Pond metadata (company, GPS, biomass, etc.)" |
| `CycleDailyHealth.day_number` | "Day in cycle (1-90 for shrimp, 1-180 for fish, 1-192 for crab)" |
| `CycleStageMetric.stage_name` | "Growth stage name (e.g., 'Post-Larvae Stocking')" |
| `CycleStageMetric.metrics` | "Per-parameter avg/min/max, keyed by parameter_type" |

The developer-flavoured `help_text` was useful when documenting the model; harmful as user-facing UI copy.

### B. Drop `_id` from admin `readonly_fields`

All 6 admins currently include their UUID PK in `readonly_fields`. UUIDs aren't useful on the edit form. Drop:

| Admin | Drop from readonly_fields |
|---|---|
| `PondAdmin` | `'pond_id'` (and update `fieldsets` Audit section to remove the reference) |
| `CycleAdmin` | `'cycle_id'` (same) |
| `CycleDailyHealthAdmin` | `'health_id'` |
| `CycleStageMetricAdmin` | `'metric_id'` |
| `TreatmentAdmin` | `'treatment_id'` |
| `PondTreatmentAdmin` | `'pond_treatment_id'` |

The PK fields have `editable=False` on the model, so removing them from `readonly_fields` makes them vanish from the form (the admin only auto-includes editable fields).

### C. `Pond.metadata` editor — key/value-pairs widget

New `KeyValuePairsWidget(forms.Widget)` + Alpine template:

```
┌──────────────────────────────────────────────────────────┐
│ Pond metadata                              [+ Add field] │
├──────────────────────────────────────────────────────────┤
│ # │ Key                  │ Value                    │ X  │
│ 1 │ [company_name      ] │ [Coastal Marine        ] │[X] │
│ 2 │ [biomass_kg        ] │ [420                   ] │[X] │
│ 3 │ [disease_risk      ] │ [low                   ] │[X] │
│ … │                                                      │
└──────────────────────────────────────────────────────────┘
```

Value is a plain text input (numbers, strings, dates all coerced to strings on the JSON side). If we ever need richer typing, that's Part 3 polish.

Serialized form:
```json
{"company_name": "Coastal Marine Hatchery", "biomass_kg": "420", ...}
```

Note: values arrive at the BE as strings even for numerics. JSONField stores whatever shape we give it. FE consumers (if any read these values) coerce.

### D. `CycleStageMetric.metrics` editor — 4-column rows

New `StageMetricsWidget(forms.Widget)` + Alpine template:

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage metrics                                  [+ Add metric]   │
├─────────────────────────────────────────────────────────────────┤
│ # │ Parameter code   │ Avg     │ Min    │ Max     │ X           │
│ 1 │ [body_weight   ] │ [3.0  ] │ [1.5 ] │ [4.5  ] │ [X]         │
│ 2 │ [daily_gain    ] │ [0.11 ] │ [0.08] │ [0.15 ] │ [X]         │
│ 3 │ [fcr           ] │ [2.25 ] │ [2.0 ] │ [2.5  ] │ [X]         │
│ 4 │ [mortality_rate] │ [0.9  ] │ [0.3 ] │ [1.5  ] │ [X]         │
└─────────────────────────────────────────────────────────────────┘
```

Serialized:
```json
{"body_weight": {"avg": 3.0, "min": 1.5, "max": 4.5}, "daily_gain": {...}, ...}
```

Empty rows (no parameter code) get skipped on save.

---

## Checklist Tracking

### A. Model help_text cleanup

| No. | Done | Step | Verification |
|---|---|---|---|
| 1 | [x] | Treatment.code help_text stripped (only one on Treatment). | done |
| 2 | [x] | PondTreatment.* — 4 help_texts stripped (ended_at, notes, created_by, updated_by). | done |
| 3 | [x] | Pond.metadata + Pond.status help_texts stripped. | done |
| 4 | [x] | CycleDailyHealth.day_number help_text stripped. | done |
| 5 | [x] | CycleStageMetric.stage_name + .metrics help_texts stripped. **Total: `grep -c help_text models.py` → 0.** | ✅ |

### B. Admin readonly_fields cleanup

| 6 | [x] | `admin.py` — dropped `pond_id`/`cycle_id`/`health_id`/`metric_id`/`treatment_id`/`pond_treatment_id` from each admin's `readonly_fields` + Audit fieldset references. | done |

### C. Pond.metadata key/value editor

| 7 | [x] | New `backend/module_pond/forms.py` — `KeyValuePairsWidget(forms.Widget)` with `template_name`. | done |
| 8 | [x] | New `backend/module_pond/templates/module_pond/widgets/key_value_editor.html` — Alpine.js + inline `<style>` + table UI bound to a hidden input. | done |
| 9 | [x] | `PondAdminForm(forms.ModelForm)` in `forms.py` — swaps `metadata.widget` to `KeyValuePairsWidget()`. | done |
| 10 | [x] | Wired `form = PondAdminForm` on `PondAdmin`. | done |

### D. CycleStageMetric.metrics 4-column editor

| 11 | [x] | `StageMetricsWidget(forms.Widget)` with own `template_name`. | done |
| 12 | [x] | New `backend/module_pond/templates/module_pond/widgets/stage_metrics_editor.html` — 4-column row editor. | done |
| 13 | [x] | `CycleStageMetricAdminForm(forms.ModelForm)` — swaps `metrics.widget` to `StageMetricsWidget()`. | done |
| 14 | [x] | Wired `form = CycleStageMetricAdminForm` on `CycleStageMetricAdmin`. | done |

### E. Verification

| 15 | [x] | `manage.py check` exits 0 (only pre-existing staticfiles.W004). | ✅ |
| 16 | [x] | Render smoke: Pond widget = 4746 chars + 6/6 markers; StageMetric widget = 4728 chars + 6/6 markers. | ✅ |
| 17 | [x] | Round-trip smoke: PondAdminForm with `{company_name: TestCo, biomass_kg: 999, disease_risk: low}` → `is_valid=True`, cleaned_data is the exact Python dict. CycleStageMetricAdminForm with 2 metrics → `is_valid=True`, cleaned_data is the exact nested-dict shape. Transaction rolled back. | ✅ |
| 18 | [ ] | Browser smoke (user) — Pond change form: metadata renders as key/value table; round-trip persists. | **Pending** |
| 19 | [ ] | Browser smoke (user) — CycleStageMetric change form: metrics renders as 4-column table; pre-existing rows visible; round-trip persists. | **Pending** |
| 20 | [ ] | Browser smoke (user) — all 6 admin edit forms: no `_id` rows; no developer help_text on any field. | **Pending** |

---

## Verification Block — after items 14

```bash
cd backend && source venv/bin/activate
python manage.py check

python manage.py shell <<'PY'
from module_pond.models import Pond, CycleStageMetric
from module_pond.forms import PondAdminForm, CycleStageMetricAdminForm

# Render smoke
pond = Pond.objects.first()
pf = PondAdminForm(instance=pond)
html = str(pf['metadata'])
print(f"PondAdminForm.metadata widget: {len(html)} chars")
for marker in ('x-data', 'x-for', 'type="hidden"', 'keyValueEditor(', 'Add field'):
    print(f"  '{marker}' present: {marker in html}")

m = CycleStageMetric.objects.first()
if m:
    mf = CycleStageMetricAdminForm(instance=m)
    html2 = str(mf['metrics'])
    print(f"\nCycleStageMetricAdminForm.metrics widget: {len(html2)} chars")
    for marker in ('x-data', 'x-for', 'type="hidden"', 'stageMetricsEditor(', 'Add metric'):
        print(f"  '{marker}' present: {marker in html2}")

# Round-trip smoke (rolled back via transaction)
import json
from django.db import transaction
with transaction.atomic():
    new_meta = {'company_name': 'TestCo', 'biomass_kg': '999'}
    data = {
        'name':        pond.name,
        'project':     pond.project_id,
        'description': pond.description or '',
        'metadata':    json.dumps(new_meta),
        'status':      'active',
    }
    f2 = PondAdminForm(data=data, instance=pond)
    print(f"\nPondAdminForm bound is_valid: {f2.is_valid()}")
    if f2.is_valid():
        print(f"  cleaned metadata: {f2.cleaned_data['metadata']}")
    else:
        print(f"  errors: {f2.errors}")
    transaction.set_rollback(True)
PY
```

Expected:
- Widget renders with all 5 markers.
- Round-trip parses `'{"company_name":"TestCo", ...}'` JSON string into a Python dict.
- Rollback returns Pond to its seed state.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Numeric values typed as strings end up stored as strings in JSONB | Acceptable for Pond.metadata (freeform). For CycleStageMetric, the widget coerces avg/min/max to floats during serialize via `parseFloat()`. |
| Removing `*_id` from readonly_fields might break some admin's audit section | The PK columns have `editable=False` — they simply vanish from forms. Verified by browser smoke (item 20). |
| Existing Pond.metadata has mixed types (numbers + strings + dates as strings + nested company name etc.) | The widget reads everything as a string for editing. On save, JSON parse coerces back. Round-trip preserves shape (numbers stay numbers if typed as numbers in JSON). |
| Alpine.js not loading | Verified in project-mgmt Phase 6e — Unfold loads Alpine via `defer`. Same path. |
| Browser caches old admin.css / template | Hard refresh (Cmd+Shift+R) clears. |

---

## Out of scope

| Item | Where |
|---|---|
| Schema-defined / profile-aware editors | Rejected in this phase (D7) |
| Cycle-aware Day Number widget on CycleDailyHealth | User flagged this for "next time"; not in 4b |
| Display labels / units alongside parameter codes in stage metrics | Could be a Part 3 polish — for now admins know their codes |
| FE rendering of these JSONB fields | Part 2 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [ ] | No model field carries developer-flavoured `help_text` |
| [ ] | No admin edit form shows the UUID PK as a row |
| [ ] | Pond.metadata renders as a key/value-pairs editor; round-trips to JSON |
| [ ] | CycleStageMetric.metrics renders as a 4-column row editor; round-trips to nested JSON |
| [ ] | `manage.py check` exits 0 |
| [ ] | Shell smoke (render + round-trip) passes for both forms |
| [ ] | Browser smoke (user) confirms cleanups on all 6 admin forms |

---

## Files Touched in Phase 4b

| File | What changed |
|---|---|
| `backend/module_pond/models.py` | Stripped `help_text` from ~10 fields across 6 models. |
| `backend/module_pond/admin.py` | Removed `*_id` entries from `readonly_fields` (and Audit `fieldsets` where present) on all 6 admins. Wired `form = PondAdminForm` on PondAdmin + `form = CycleStageMetricAdminForm` on CycleStageMetricAdmin. |
| `backend/module_pond/forms.py` (new) | `KeyValuePairsWidget` + `StageMetricsWidget` + `PondAdminForm` + `CycleStageMetricAdminForm`. |
| `backend/module_pond/templates/module_pond/widgets/key_value_editor.html` (new) | Alpine.js key/value-pairs table editor (Pond.metadata). |
| `backend/module_pond/templates/module_pond/widgets/stage_metrics_editor.html` (new) | Alpine.js 4-column rows editor (CycleStageMetric.metrics). |

Seed files untouched.

---

*Last updated: 2026-05-23*
