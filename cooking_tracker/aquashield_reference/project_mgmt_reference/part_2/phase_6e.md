# Part 2 — Phase 6e — Stage Config Structured Editor

---

## Goal

Replace the raw JSON textarea for `ProfileType.stage_config` with a structured 5-column table editor (Option A from the sketches you picked). After Phase 6e, admins can add / remove / edit stages without typing JSON, with `stage_number` auto-derived from row position and `cycleLengthDays` computed from the max `endDay`.

This closes the last big UX gap on the ProfileType change form.

---

## Locked design (from earlier discussion)

| Decision | Choice |
|---|---|
| Layout | Option A — compact 5-column table |
| Field set per row | `name` / `startDay` / `endDay` / `description` (4 user-editable) |
| `stage_number` | auto-derived from row position (1, 2, 3, …) — NOT user-editable |
| `cycleLengthDays` | auto-computed from `max(endDay)`; optional manual override field below the table |
| Save shape | canonical wrapped dict: `{stages: [...], cycleLengthDays: N}` (or `null` for empty) |
| Tech | Alpine.js (bundled with django-unfold — confirmed loaded via `defer` in `unfold/layouts/skeleton.html`) |
| Server-side validation | Out of scope here; trust the UI for Phase 6e; add validation in Part 3 polish if needed |

---

## Architecture

### Widget — `StageConfigEditorWidget(forms.HiddenInput)`

Subclass `HiddenInput` so the underlying form-field machinery still treats this as a single input bound to `cleaned_data['stage_config']`. Override `template_name` to point at our custom template. The template:

1. Renders a `<input type="hidden" name="{{ widget.name }}" :value="serialized">` whose value is updated by Alpine on every state change. Django's form submission picks up this single input as the value for `stage_config`. `JSONField.to_python` parses it.
2. Renders the visible Alpine-managed UI (table, add button, cycle-length row).
3. Embeds inline `<style>` for table polish that doesn't clash with Unfold.

### Alpine state

```js
function stageEditor(initialJsonStr) {
  return {
    stages: [],
    cycleLengthDaysOverride: null,

    init() {
      // Tolerate three input shapes: null, plain list (legacy), wrapped dict (canonical).
      if (!initialJsonStr || initialJsonStr === 'null') return;
      try {
        const parsed = JSON.parse(initialJsonStr);
        if (Array.isArray(parsed)) {
          this.stages = parsed;
        } else if (parsed && Array.isArray(parsed.stages)) {
          this.stages = parsed.stages;
          if (typeof parsed.cycleLengthDays === 'number') {
            this.cycleLengthDaysOverride = parsed.cycleLengthDays;
          }
        }
      } catch (e) {
        console.warn('stage_config initial value not parseable', e);
      }
    },

    addStage() {
      const last = this.stages[this.stages.length - 1];
      const lastEnd = last ? (parseInt(last.endDay) || 0) : 0;
      this.stages.push({
        name: '',
        startDay: lastEnd + 1,
        endDay: lastEnd + 1,
        description: '',
      });
    },

    removeStage(i) { this.stages.splice(i, 1); },

    get computedCycleLength() {
      return this.stages.reduce(
        (max, s) => Math.max(max, parseInt(s.endDay) || 0),
        0
      );
    },

    get serialized() {
      if (this.stages.length === 0) return 'null';
      return JSON.stringify({
        stages: this.stages.map((s, i) => ({
          name: s.name,
          startDay: parseInt(s.startDay) || 0,
          endDay: parseInt(s.endDay) || 0,
          description: s.description || '',
          stage_number: i + 1,
        })),
        cycleLengthDays: this.cycleLengthDaysOverride || this.computedCycleLength,
      });
    },
  };
}
```

Notes on the serialize step:
- `stage_number` is computed from the row index — never stored in Alpine state. Deleting a row renumbers automatically.
- Empty stages list serialises to `'null'` (not `'{"stages":[],...}'`) so new profiles without stages stay as DB `NULL`.
- `cycleLengthDays` writes the override if set, else the computed max.

### Wiring on the form

`ProfileTypeAdminForm.__init__`:

```python
self.fields['stage_config'].widget = StageConfigEditorWidget()
```

Or via `Meta.widgets`. Either works; `__init__` keeps the change scoped to this form without affecting other JSONField rendering elsewhere.

No save() override needed — `JSONField.to_python` already parses the hidden input's JSON string into Python dict on submit.

---

## Visual target

```
┌──────────────────────────────────────────────────────────────────────┐
│ Stages                                          [+ Add stage]        │
├──────────────────────────────────────────────────────────────────────┤
│  # │ Name             │ Start │ End │ Description           │  X    │
│  1 │ [Stocking      ] │ [  1] │ [ 7]│ [Initial larvae...]   │ [X]   │
│  2 │ [Early Growth  ] │ [  8] │ [30]│ [Active feeding...]   │ [X]   │
│  3 │ [Grow-out      ] │ [ 31] │ [70]│ [Optimal growth...]   │ [X]   │
│                                                                      │
│ Cycle Length: [   ] days   (auto: 70 from max endDay)                │
└──────────────────────────────────────────────────────────────────────┘
```

`#` column is read-only (Alpine `x-text`). The other 4 are inputs. Description is a single-line text field for the compact layout — full-width textarea was Option B which we rejected.

---

## Files involved

1. `backend/module_project/templates/module_project/widgets/stage_config_editor.html` (new) — widget template with inline `<style>` + `<script>` + Alpine UI.
2. `backend/module_project/forms.py` — add `StageConfigEditorWidget` class; wire it into `ProfileTypeAdminForm.__init__`.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Template — create `stage_config_editor.html` | New file at `backend/module_project/templates/module_project/widgets/stage_config_editor.html`. Inline `<style>` (Unfold-friendly via `var(--border-default-color, ...)`), `stageEditor()` Alpine factory, 5-column table UI bound to it, hidden input + cycle-length row + empty-state placeholder. | done |
| 2 | [x] | `forms.py` — `StageConfigEditorWidget` class | Added `class StageConfigEditorWidget(forms.HiddenInput)` pointing at the template. | done |
| 3 | [x] | `forms.py` — wire widget | `ProfileTypeAdminForm.__init__` now swaps `self.fields['stage_config'].widget = StageConfigEditorWidget()` after the indicator-choices init. | done |
| 4 | [x] | Verification — `manage.py check` | Exit 0 (only pre-existing staticfiles.W004). | ✅ |
| 5 | [x] | Verification — form render smoke | shrimp render: 6394 chars; all 6 markers present (`x-data`, `x-for`, `type="hidden"`, `stageEditor(`, `Add stage`, `stage-editor`); initial value properly escapejs'd. | ✅ |
| 6 | [x] | Verification — round-trip parse | Bound form with `stages=[Test Stocking, Test Growout]` + `cycleLengthDays=60` → `is_valid=True` → `cleaned_data['stage_config']` is a Python dict (not string) → refetched DB row matches input exactly. Empty/null case (octopus): renders with `stageEditor('null')` — Alpine init() handles as no-op. | ✅ |
| 7 | [ ] | Verification — browser smoke (user) | (a) Open `/admin/.../profiletype/<shrimp>/change/`. Scroll to Stages section. (b) See the 5-column table populated with the 4 shrimp stages. (c) Edit a row, save, reload — change persists. (d) Add a new stage via `+ Add stage`, save, reload — present. (e) Delete a stage via Remove, save, reload — gone. (f) Open `/admin/.../profiletype/<octopus>/change/` (no stage_config) — see empty-state row; add 2 stages; save; refetch confirms `stage_config = {"stages": [...], "cycleLengthDays": N}`. | **Pending manual smoke** |

---

## Verification Block — to run after item 3

```bash
cd backend && source venv/bin/activate
python manage.py check

python manage.py shell <<'PY'
from module_project.models import ProfileType
from module_project.forms import ProfileTypeAdminForm

shrimp = ProfileType.objects.get(code='shrimp')
form = ProfileTypeAdminForm(instance=shrimp)
html = str(form['stage_config'])
print(f"render length: {len(html)}")
for marker in ['x-data', 'x-for', 'type="hidden"', 'stageEditor(', 'Add stage']:
    print(f"  '{marker}' in output: {marker in html}")

# Round-trip test
import json
data_in = {'stages': [
    {'name': 'Test 1', 'startDay': 1, 'endDay': 10, 'description': '', 'stage_number': 1},
], 'cycleLengthDays': 10}
form2 = ProfileTypeAdminForm(
    data={
        'code': shrimp.code, 'name': shrimp.name, 'description': shrimp.description or '',
        'stage_config': json.dumps(data_in),
        'key_parameter_indicators': shrimp.key_parameter_indicators,
        'key_growth_indicators': shrimp.key_growth_indicators,
        'theme_primary': shrimp.theme['primary'],
        'theme_gradient_from': shrimp.theme['gradient']['from'],
        'theme_gradient_to': shrimp.theme['gradient']['to'],
    },
    instance=shrimp,
)
print(f"\nis_valid: {form2.is_valid()}")
if not form2.is_valid():
    print(f"errors: {form2.errors}")
else:
    print(f"cleaned stage_config: {form2.cleaned_data['stage_config']}")
PY
```

Expected:
- All 5 markers present in render output.
- `is_valid: True`.
- `cleaned stage_config` is the parsed Python dict matching `data_in`.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Initial value is the legacy plain-list shape (shrimp / crab_hatchery seeds) | Alpine `init()` handles both shapes. Once user saves, value is rewritten as canonical wrapped dict — one-way migration. |
| Empty stages on save | Serializer emits `'null'`; JSONField parses to `None`; DB stores NULL. Matches octopus's current state. |
| Alpine.js not loaded (admin page misconfig) | Verified via `unfold/templates/unfold/layouts/skeleton.html` — Alpine loaded as `defer` scripts. If skeleton ever changes, our widget would silently render the hidden input without the UI. A `<noscript>` fallback to a `textarea` could be added; out of scope for Phase 6e. |
| User types `startDay > endDay` or overlapping ranges | No client-side validation in Phase 6e. Trust the user. Server-side validation = Part 3 polish. |
| Long descriptions overflow the row | Description input is single-line — long text scrolls horizontally inside the cell. Option B (cards) was rejected; admins with long descriptions can use Option B's textarea pattern in Part 3 if needed. |
| Multiple admin tabs editing the same ProfileType | Last writer wins — same as Django admin's general behaviour. Out of scope for this phase. |
| Hidden input value contains a string with `</script>` or quotes | We pipe the initial value through `|escapejs` in the template; the `:value` binding uses Alpine which is text-content safe. |

---

## Out of scope

| Item | Why |
|---|---|
| Server-side validation of stage ordering / non-overlapping ranges | Part 3 polish |
| Reordering rows via drag-and-drop | Part 3 polish — user can edit start/end values manually |
| Multi-line description editor | Rejected in favour of Option A's compact layout |
| Visual diff before save | Out of scope |
| Two-repo port | Standard workflow |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `stage_config_editor.html` template exists at the expected path |
| [x] | `StageConfigEditorWidget` class in `forms.py` referencing the template |
| [x] | `ProfileTypeAdminForm.__init__` swaps in the custom widget on `stage_config` |
| [x] | `manage.py check` clean |
| [x] | Shell smoke: widget renders the Alpine markup; round-trip parse works |
| [ ] | Browser smoke: edit existing stages persists; add/remove rows works; empty profile (octopus) supports adding stages from scratch (**pending visual confirm**) |

---

## Files Touched in Phase 6e

| File | What changed |
|---|---|
| `backend/module_project/templates/module_project/widgets/stage_config_editor.html` (new) | Custom widget template with inline `<style>`, Alpine `stageEditor()` factory in a `<script>`, and a 5-column table UI bound to a hidden input named after the form field. Tolerates the two legacy stage_config shapes; serialises to the canonical wrapped dict. |
| `backend/module_project/forms.py` | Added `StageConfigEditorWidget(forms.HiddenInput)` class pointing at the template; wired it into `ProfileTypeAdminForm.__init__` so the `stage_config` field renders with the custom UI. |

---

*Last updated: 2026-05-22*
