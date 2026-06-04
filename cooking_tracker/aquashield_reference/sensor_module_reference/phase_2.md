# Phase 2 — SensorType Admin

---

## Goal

Build the Django admin for `SensorType` (table `sensor_types`), including the headline piece: a **custom multi-select widget for `parameter_ids`** (D2) so an admin ticks parameters from the `ParameterType` catalogue instead of typing UUIDs. Mirror the `IndicatorCheckboxSelectMultiple` pattern from `module_project`.

---

## What SensorType is

Hardware catalogue: "a WQS-3000 sensor measures temperature, pH, salinity." `parameter_ids` is a `UUID[]` of `ParameterType` IDs (ParameterType lives in `module_project` now). DB CHECK: `parameter_ids` must be non-empty.

---

## Admin shape

```
SensorTypeAdmin
  list_display  : name, model_number, manufacturer, parameter_count, is_active
  search_fields : name, model_number
  list_filter   : is_active
  ordering      : name
  readonly      : sensor_type_id, created_at, updated_at
  form          : SensorTypeAdminForm  (custom parameter_ids widget)
  fieldsets     : Identity(name, model_number, manufacturer, description)
                  Capabilities(parameter_ids)
                  Status(is_active)
                  Audit(sensor_type_id, created_at, updated_at)  [collapse]
```

`parameter_count` = `len(obj.parameter_ids or [])` (display method).

## The `parameter_ids` widget (D2)

The model field is `ArrayField(UUIDField)`. The admin form overrides it with a choice field whose **choices come from the ParameterType catalogue**:

- `SensorTypeAdminForm` declares `parameter_ids = forms.MultipleChoiceField(widget=<checkbox picker>, required=True)`.
- `__init__` populates `choices` dynamically: `[(str(pt.parameter_id), f"{pt.parameter_name} ({pt.parameter_code})") for pt in ParameterType.objects.order_by('parameter_name')]` — so new parameters appear without a redeploy. (Import `ParameterType` from `module_project.models`.)
- `__init__` sets `initial` from the instance's `parameter_ids` (cast UUIDs → str for the form).
- `clean_parameter_ids` returns the selected list (as the value stored back into the array column). Validates **non-empty** (mirrors the CHECK) — raise `ValidationError("Select at least one parameter.")` if empty.
- Reuse the project widget template if a generic checkbox-grid widget exists; otherwise a `CheckboxSelectMultiple` subclass pointing at a small template (column-flow grid) like `module_project`'s.

> Confirm during build: ParameterType PK column name (`parameter_id`) and label columns (`parameter_name` / `parameter_code`) against the live `parameter_types` table.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Pre-check | Confirm `ParameterType` import path + field names (`parameter_id`, `parameter_name`, `parameter_code`) from `module_project.models` / live DB. | shell introspection |
| 2 | [x] | Form | Create `SensorTypeAdminForm(forms.ModelForm)` with the custom `parameter_ids` `MultipleChoiceField` + dynamic choices in `__init__` + `initial` from instance. | form instantiates |
| 3 | [x] | Form validation | `clean_parameter_ids` returns the UUID list and rejects empty selection (mirrors `cardinality>0` CHECK). | unit test valid/empty |
| 4 | [x] | Widget | Checkbox-grid widget (reuse module_project's pattern/template, or a `CheckboxSelectMultiple` subclass). | renders in admin |
| 5 | [x] | Admin | `@admin.register(SensorType)` `SensorTypeAdmin(ModelAdmin)` with list/search/filter/readonly/fieldsets + `parameter_count` method + `form = SensorTypeAdminForm`. | add/change pages render |
| 6 | [x] | Round-trip | Edit a SensorType: tick/untick parameters, save, reopen — selection persists; `parameter_ids` UUIDs correct in DB. | manual + DB check |
| 7 | [x] | Verify | `manage.py check` clean; ruff clean on `admin.py`/new form file. | commands pass |

---

## Verification Block

```bash
cd /Users/thetnaungsoe/Desktop/AquaMonitoringv2/backend
./venv/bin/python manage.py check 2>&1 | grep -iE "error|issue"
./venv/bin/ruff check module_sensor/admin.py

# Form round-trips parameter_ids to/from UUID[]
./venv/bin/python manage.py shell <<'PY'
from module_sensor.models import SensorType
st = SensorType.objects.first()
print("parameter_ids:", st.parameter_ids if st else "no rows")
PY
```
Manual: open `/admin/module_sensor/sensortype/` → add + change pages render; parameter checkboxes show names; empty selection is rejected; valid save round-trips.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `ParameterType` field names differ from assumption | Step 1 introspects live `parameter_types` before coding the choices. |
| `ArrayField` ↔ `MultipleChoiceField` value mismatch (str vs UUID) | `clean_parameter_ids` normalizes; round-trip test (step 6) catches it. |
| Unfold admin widget quirks (per project-mgmt amendment notes) | Reuse the already-working project widget pattern. |
| `managed=False` + array CHECK can't be enforced by DB on save through Django | Enforced at form level (step 3). |

---

## Out of scope

| Item | Why |
|---|---|
| IoTDevice / ProjectSensor admin | Phases 3 / 4 |
| Consolidated cross-model validation | Phase 5 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `SensorType` registered; add/change pages render |
| [x] | `parameter_ids` editable as a parameter checklist (names, not UUIDs) |
| [x] | Empty `parameter_ids` rejected at the form |
| [x] | Selection round-trips to `UUID[]` correctly |
| [x] | `manage.py check` + ruff clean |

---

## Files Touched in Phase 2

| File | What changed |
|---|---|
| `backend/module_sensor/admin.py` | `SensorTypeAdmin` registration. |
| `backend/module_sensor/forms.py` (new) | `SensorTypeAdminForm` + `parameter_ids` widget. |
| `backend/module_sensor/templates/...` (maybe) | Checkbox-grid widget template if not reusing project's. |

---

*Last updated: 2026-06-02*