# Part 1 — Phase 6b — Indicator Pickers (Admin UI Follow-up)

---

## Goal

Replace the two raw-text ArrayField widgets on the `ProfileType` change form with **checkbox lists driven by the catalogue tables** — admins tick codes, never type them.

This is a Phase 6 follow-up: the original Phase 6 polished `theme` but left `key_parameter_indicators` and `key_growth_indicators` rendering as comma-separated text. Admins were expected to type `temperature,ph,dissolved_oxygen,salinity` with zero validation. Unacceptable.

**Out of scope:** the `stage_config` JSON textarea — that's a heavier Alpine.js editor; deferred to Part 3 polish per the scope question we just resolved.

---

## Design

### `key_parameter_indicators`

- Form field: `MultipleChoiceField(widget=CheckboxSelectMultiple, required=False)`.
- Choices: every `ParameterType.parameter_code` (22 entries), populated dynamically in `__init__` so new catalogue entries appear without code changes.
- Initial value: current `instance.key_parameter_indicators` list (TEXT[] from DB).
- On save: ModelForm's standard `_post_clean` copies the cleaned list back into the model's ArrayField — no manual `save()` write needed.
- Empty selection writes `[]` (not `NULL`) — semantically equivalent; the read-side `pt.get_key_parameters()` already handles both.

### `key_growth_indicators`

Identical pattern, choices come from `GrowthIndicator.code` (11 entries).

### Why declare-on-form vs override-widget?

Considered overriding the ArrayField's widget on the model. Rejected — model-level widget changes leak into other admins and into DRF; declaring on the admin form keeps the change scoped to the admin UI.

---

## Final Target

```python
# module_project/forms.py — ProfileTypeAdminForm (existing class, extended)
key_parameter_indicators = forms.MultipleChoiceField(
    widget=forms.CheckboxSelectMultiple,
    required=False,
    help_text='Sensor parameters this profile cares about.',
)
key_growth_indicators = forms.MultipleChoiceField(
    widget=forms.CheckboxSelectMultiple,
    required=False,
    help_text='Growth metrics this profile reports on.',
)
# __init__ populates .choices from catalogue + .initial from instance
```

No new files. No admin changes (the fieldset already references these field names). No model changes. No serializer changes.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `forms.py` — choice helpers | Added `_parameter_code_choices()` + `_growth_code_choices()`. | grep |
| 2 | [x] | `forms.py` — declared fields | Declared both `MultipleChoiceField(widget=CheckboxSelectMultiple, required=False)` on `ProfileTypeAdminForm`. | grep |
| 3 | [x] | `forms.py` — `__init__` wiring | Choices populated dynamically; initial values pulled from `self.instance` arrays when `pk` is set. | shell smoke ✅ |
| 4 | [x] | `forms.py` — imports | Added `GrowthIndicator, ParameterType` to model imports. | grep |
| 5 | [x] | Verification — `manage.py check` | Exit 0 | only pre-existing staticfiles.W004 |
| 6 | [x] | Verification — form initial values | shrimp form: kp choices=22, kp initial=`['temperature','ph','dissolved_oxygen','salinity']` matches DB; kg choices=11, kg initial=`['body_weight','daily_gain','fcr','mortality_rate']` matches DB | shell smoke ✅ |
| 7 | [x] | Verification — round-trip save | Bound form with `kp=['ph','temperature']` + `kg=['fcr']` validated, saved, refetched showed exact values; rollback restored original | shell smoke ✅ ASSERT OK |
| 8 | [ ] | Verification — browser | Open `/admin/module_project/profiletype/<shrimp>/change/`. Key parameter indicators section now renders as a checkbox grid (22 boxes); the 4 currently-set codes are pre-ticked. Tick one extra, save, reload — change persists. Then restore. | **Manual smoke — verify in browser** |
| 9 | [x] | UX follow-up — column layout | Wrap the `CheckboxSelectMultiple` rendering in a CSS-grid template that caps at 10 rows per column then flows right. 22 parameter codes → 3 columns (10+10+2); 11 growth → 2 columns (10+1). Created `module_project/templates/module_project/widgets/indicator_checkbox.html` + `IndicatorCheckboxSelectMultiple` widget subclass. | shell smoke: renders 5009 chars, 4 `checked` attrs match instance |

---

## Verification Block — to run after item 5

```bash
python manage.py check

python manage.py shell <<'PY'
from module_project.models import ProfileType, ParameterType, GrowthIndicator
from module_project.forms import ProfileTypeAdminForm

# --- 1. Initial values ---
shrimp = ProfileType.objects.get(code='shrimp')
form = ProfileTypeAdminForm(instance=shrimp)
print("--- shrimp form initial state ---")
print(f"  key_parameter_indicators choices count: {len(form.fields['key_parameter_indicators'].choices)}")
print(f"  key_parameter_indicators initial:       {form['key_parameter_indicators'].value()}")
print(f"  key_growth_indicators   choices count: {len(form.fields['key_growth_indicators'].choices)}")
print(f"  key_growth_indicators   initial:       {form['key_growth_indicators'].value()}")
print(f"  expected (DB):                          {shrimp.key_parameter_indicators}, {shrimp.key_growth_indicators}")

# --- 2. Round-trip save (rolled back) ---
from django.db import transaction
print()
print("--- round-trip save ---")
with transaction.atomic():
    data = {
        'code': shrimp.code,
        'name': shrimp.name,
        'description': shrimp.description or '',
        'stage_config': '[]',  # any valid JSON
        'key_parameter_indicators': ['ph', 'temperature'],  # NEW selection
        'key_growth_indicators': ['fcr'],                   # NEW selection
        'theme_primary': '#0C9286',
        'theme_gradient_from': '#0C9286',
        'theme_gradient_to': '#00796B',
    }
    f2 = ProfileTypeAdminForm(data=data, instance=shrimp)
    print(f"  is_valid:  {f2.is_valid()}")
    if not f2.is_valid():
        print(f"  errors:    {f2.errors}")
    else:
        saved = f2.save()
        refetched = ProfileType.objects.get(pk=shrimp.pk)
        print(f"  refetched.key_parameter_indicators: {refetched.key_parameter_indicators}")
        print(f"  refetched.key_growth_indicators:    {refetched.key_growth_indicators}")
        assert refetched.key_parameter_indicators == ['ph', 'temperature']
        assert refetched.key_growth_indicators == ['fcr']
        print("  ASSERT OK")
    transaction.set_rollback(True)

# --- 3. Confirm rollback ---
final = ProfileType.objects.get(code='shrimp')
print()
print(f"Post-rollback (should match original):  {final.key_parameter_indicators}, {final.key_growth_indicators}")
PY
```

Expected:
- Both `.choices` counts match catalogue sizes (22 / 11).
- Initial values match current DB.
- Round-trip save writes selection correctly.
- Rollback returns DB to seed state.

---

## Out of Scope

| Item | Why |
|---|---|
| `stage_config` editor | Bigger work (Alpine.js, formset-style add/remove rows). Deferred to Part 3 per user decision. |
| Sorting / search inside the checkbox list | 22 / 11 entries fits one screen comfortably; no need. |
| Showing parameter unit / display name alongside the code | Could be a Part 3 enhancement. Current form shows `code → code` which is unambiguous. |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `module_project/forms.py` exports the modified `ProfileTypeAdminForm` with both indicator fields as `MultipleChoiceField(widget=CheckboxSelectMultiple)` |
| [x] | `manage.py check` exits 0 |
| [x] | Shell smoke: form binds, validates, round-trips correctly |
| [ ] | Browser smoke: ProfileType change form shows 2 × checkbox grids (22 + 11 boxes); existing selections pre-ticked; save round-trip persists (pending visual confirm) |

---

## Files Touched in Phase 6b

| File | What changed |
|---|---|
| `backend/module_project/forms.py` | Added `_parameter_code_choices()` + `_growth_code_choices()` helpers; added `IndicatorCheckboxSelectMultiple` widget subclass (10-rows-per-column grid layout); declared `key_parameter_indicators` + `key_growth_indicators` as `MultipleChoiceField(widget=IndicatorCheckboxSelectMultiple)` on `ProfileTypeAdminForm`; extended `__init__` to populate choices dynamically + initial values from the instance. |
| `backend/module_project/templates/module_project/widgets/indicator_checkbox.html` (new) | CheckboxSelectMultiple template with inline CSS grid (`grid-template-rows: repeat(10, auto); grid-auto-flow: column`) — caps each column at 10 rows then wraps right. |

---

*Last updated: 2026-05-22*
