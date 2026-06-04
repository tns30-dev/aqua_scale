# Part 1 — Phase 6 — Project Admin Shape (Theme Picker + Inline)

---

## Goal

Make `module_project` admin **look and feel as polished as `module_user`** — drop the embarrassing JSON textarea, add native colour pickers, and turn `ProjectParameterSetting` into an inline under `Project` per D3-A.

Five concrete deliverables:

1. **Upgrade to `unfold.admin.ModelAdmin`** across `module_project/admin.py` (matches `module_user/admin.py:19`). Same dark theme, same widgets, same dropdown polish.
2. **Decomposed theme form on `ProfileTypeAdmin`** — three native HTML5 `<input type="color">` widgets for `theme.primary`, `theme.gradient.from`, `theme.gradient.to`. The underlying JSONB column stays as the source of truth — synthetic form fields read/write into it. Plain JSON textarea is gone.
3. **`ProjectParameterSettingInline` (TabularInline) under `ProjectAdmin`** — admins edit per-project thresholds + the `is_key_parameter` flag inline on the Project change page.
4. **Remove standalone `ProjectParameterSettingAdmin` registration** per D3-A (inline-only).
5. **Per-row "Edit" button** on `ProfileTypeAdmin.list_display` and `ProjectAdmin.list_display` (matches `module_user/admin.py:114`).

Posture: pure admin-shape work. No model changes, no SQL changes, no serializer changes, no API changes. Form layer only.

---

## Why now (not Phase 5)

Phase 5 deliberately kept the admin vanilla:

- Phase 5 was about *re-registering* the relocated models (`ParameterType`, `GrowthIndicator`, `ProjectParameterSetting`) and dropping a latent fieldset bug. Surface coverage, not polish.
- Theme JSONB rendered as a textarea was an acceptable interim — but as soon as anyone opens the change form they see `{"primary": "#888888", "gradient": {"from": "#888888", "to": "#cccccc"}}` and has to hand-edit JSON. Unacceptable for the final state.
- `ProjectParameterSetting` standalone admin was an acceptable interim — but D3-A says inline only.

Phase 6 closes both gaps.

---

## Design — Decomposed Theme Form

### The challenge

`ProfileType.theme` is a `JSONField` storing `{"primary": "#hex", "gradient": {"from": "#hex", "to": "#hex"}}`. The Django admin renders JSONFields as a textarea. We want **three native HTML5 colour pickers** instead, with the JSONB reassembled on save.

### Approach (Option A — synthetic form fields)

Use a custom `forms.ModelForm` that:

- **Hides** `theme` from `Meta.fields` (the JSONB textarea disappears entirely).
- **Adds three synthetic `CharField`s** — `theme_primary`, `theme_gradient_from`, `theme_gradient_to` — each rendered with `widget=forms.TextInput(attrs={'type': 'color'})`. That turns the browser's native input into a colour swatch + colour picker dialogue.
- **`__init__`** populates the three synthetic fields from `self.instance.theme` (falling back to the placeholder defaults if a key is missing).
- **`save(commit=True)`** reassembles the three values back into `instance.theme` as the JSONB shape `{"primary": ..., "gradient": {"from": ..., "to": ...}}` before super-saving.

Rejected alternatives:

- **Coloris.js / Pickr library** — added bundle weight + dependency. Native `<input type="color">` is browser-native, zero JS, sufficient.
- **Live gradient preview swatch** — needs Alpine.js + a custom form template. Defer to Part 3 polish (out of scope here).
- **Six VARCHAR(7) columns instead of JSONB** — explicitly rejected during design (D2). Adding visual tokens later (hover, focus, contrast) is a JSONB write, not a schema migration.

### Visual layout (rendered)

```
┌──────────────────────────────────────────────────────────┐
│ Theme                                                    │
│                                                          │
│   Theme primary           [▣ #3B82F6]                    │
│   Theme gradient from     [▣ #60A5FA]                    │
│   Theme gradient to       [▣ #1E40AF]                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Each `[▣ #hex]` is a native colour swatch button. Click it → browser's native colour picker dialog opens. Pick a colour → swatch updates. Save → JSONB written.

---

## Design — `ProjectParameterSetting` Inline

### Shape

`unfold.admin.TabularInline` (matches `UserProjectInline` in `module_user/admin.py:52`). One row per parameter setting, compact horizontal layout.

```python
class ProjectParameterSettingInline(TabularInline):
    model = ProjectParameterSetting
    fk_name = "project"
    extra = 0
    fields = (
        "parameter",
        "min_threshold",
        "max_threshold",
        "is_key_parameter",
    )
    readonly_fields = ()
    verbose_name = "Parameter setting"
    verbose_name_plural = "Parameter settings"
```

### `parameter` dropdown polish

The ParameterType dropdown can balloon to ~22 entries. Two options to make it usable:

- **A — Unfold standard select** with `formfield_for_foreignkey` overriding `empty_label = "Select a parameter"` (mirrors `UserProjectInline.formfield_for_foreignkey`).
- **B — `autocomplete_fields = ['parameter']`** — typeahead search. Requires `ParameterTypeAdmin.search_fields` (Phase 5 already set this ✅).

**Going with B (autocomplete).** 22 entries × dozens of projects = the inline is a search-shaped problem. Autocomplete keeps the table compact and avoids a tall dropdown.

### What disappears

Phase 5's standalone `ProjectParameterSettingAdmin` registration goes away. After Phase 6 the only way to edit a setting is on the Project change page. This is the intended UX per D3-A.

---

## Final Target for This Phase

```text
module_project/admin.py (after Phase 6)
  ProfileTypeAdmin(ModelAdmin)             ← unfold; theme decomposed (3 colour pickers); per-row Edit
  ProjectAdmin(ModelAdmin)                 ← unfold; inlines=[ProjectParameterSettingInline]; per-row Edit
  ParameterTypeAdmin(ModelAdmin)           ← unfold (standalone)
  GrowthIndicatorAdmin(ModelAdmin)         ← unfold (standalone)
  ProjectParameterSettingInline(TabularInline) ← NEW
  (standalone ProjectParameterSettingAdmin GONE — inline only per D3-A)

  ProfileTypeAdminForm(ModelForm)          ← NEW (decomposed theme; lives in this file or
                                                  a new module_project/forms.py)
```

No model changes. No SQL changes. No serializer changes.

---

## Checklist Tracking

| No. | Done | Area | Step | Expected Result | Verification |
|---|---|---|---|---|---|
| 1 | [x] | `module_project/admin.py` — imports | Replace `from django.contrib import admin` keeping `@admin.register(...)`, plus add `from unfold.admin import ModelAdmin, TabularInline`. (We keep `from django.contrib import admin` because the `@admin.register` decorator + autocomplete plumbing still live there; only the base class changes.) Also add `from django import forms` and `from django.urls import reverse` + `from django.utils.html import format_html` for the per-row Edit button. | Imports clean, no `admin.ModelAdmin` references remain | grep |
| 2 | [x] | `module_project/forms.py` (new file) | Create `ProfileTypeAdminForm(forms.ModelForm)`. Three synthetic CharFields `theme_primary`, `theme_gradient_from`, `theme_gradient_to` — each `widget=forms.TextInput(attrs={'type': 'color'})`, `required=True`. `Meta.model = ProfileType`, `Meta.fields = [...all-but-theme...]` (theme is fully replaced by the synthetic trio). `__init__` populates the three synthetic fields from `instance.theme` (with `_default_theme()` fallback for missing keys). `save(commit=True)` reassembles into `instance.theme` then super-saves. | Form importable; renders 3 colour pickers; round-trips to JSONB cleanly | shell smoke ✅ |
| 3 | [x] | `module_project/admin.py` — ProfileTypeAdmin upgrade | Change base class `admin.ModelAdmin` → `ModelAdmin` (unfold). Add `form = ProfileTypeAdminForm`. Update the `'Theme'` fieldset to use the three synthetic field names (`theme_primary`, `theme_gradient_from`, `theme_gradient_to`) instead of `'theme'`. | Change form renders 3 colour pickers in the Theme section | Browser smoke (item 14) |
| 4 | [x] | `module_project/admin.py` — ProfileTypeAdmin Edit button | Add `edit_link` method (copy `module_user/admin.py:114` pattern). Append `'edit_link'` to `list_display`. | Each ProfileType row in changelist has an Edit button | Browser smoke (item 17) |
| 5 | [x] | `module_project/admin.py` — ProjectParameterSettingInline | New class `ProjectParameterSettingInline(TabularInline)`. `model = ProjectParameterSetting`, `fk_name = 'project'`, `extra = 0`, `fields = ('parameter', 'min_threshold', 'max_threshold', 'is_key_parameter')`, `autocomplete_fields = ['parameter']`, `verbose_name = 'Parameter setting'`, `verbose_name_plural = 'Parameter settings'`. | Inline class importable; ready to attach to ProjectAdmin | Item 6 ✅ |
| 6 | [x] | `module_project/admin.py` — ProjectAdmin upgrade | Change base class to `ModelAdmin` (unfold). Add `inlines = [ProjectParameterSettingInline]`. | Project change form shows inline parameter-setting table | Browser smoke (item 15) |
| 7 | [x] | `module_project/admin.py` — ProjectAdmin Edit button | Add `edit_link` method (same pattern). Append `'edit_link'` to `list_display`. | Each Project row has an Edit button | Browser smoke (item 17) |
| 8 | [x] | `module_project/admin.py` — ParameterTypeAdmin upgrade | Change base class to `ModelAdmin` (unfold). Confirm `search_fields = ['parameter_code', 'parameter_name']` (set in Phase 5 — required by the inline's `autocomplete_fields`). | ParameterType admin still works; autocomplete on inline works | Browser smoke (item 15) |
| 9 | [x] | `module_project/admin.py` — GrowthIndicatorAdmin upgrade | Change base class to `ModelAdmin` (unfold). | GrowthIndicator admin still works | manage.py check ✅ |
| 10 | [x] | `module_project/admin.py` — drop standalone `ProjectParameterSettingAdmin` | Remove the entire `@admin.register(ProjectParameterSetting)` block per D3-A. Drop `ProjectParameterSetting` from the top-of-file import (no — keep it, the inline needs it). | Standalone admin gone; `/admin/module_project/projectparametersetting/` 404s | Browser smoke (item 16) |
| 11 | [x] | `module_project/admin.py` — docstring | Update module docstring: list registered = ProfileType, Project, ParameterType, GrowthIndicator. Note ProjectParameterSetting is inline-only under Project per D3-A. | Docstring matches reality | grep |
| 12 | [x] | Verification — `manage.py check` | Exit 0 | Django config valid | `python manage.py check` — only pre-existing staticfiles.W004 warning |
| 13 | [x] | Verification — form round-trip | Shell smoke: load a ProfileType, bind `ProfileTypeAdminForm` with `theme_primary='#aabbcc'` etc., `.is_valid()` → True, save, refetch, confirm `instance.theme == {"primary":"#aabbcc","gradient":{"from":...,"to":...}}` | Round-trip works | shell smoke ran — initial values populated, bound form normalised `'  #112233  '` → `'#112233'` + lowercased `#AABBCC` → `#aabbcc`, JSONB reassembled, rollback clean |
| 14 | [ ] | Verification — ProfileType change form | Open `/admin/module_project/profiletype/<id>/change/` — 3 colour swatches in Theme section; click one opens browser colour picker; save persists to JSONB | Browser shows native colour pickers | **Manual smoke — verify in browser** |
| 15 | [ ] | Verification — Project change form | Open `/admin/module_project/project/<id>/change/` — inline table at bottom showing parameter settings; `parameter` field is an autocomplete typeahead | Inline visible & functional | **Manual smoke — verify in browser** |
| 16 | [ ] | Verification — ProjectParameterSetting standalone gone | Visit `/admin/module_project/projectparametersetting/` — should 404 (or not appear in admin index at all) | Standalone changelist gone | **Manual smoke — verify in browser** |
| 17 | [ ] | Verification — changelist Edit buttons | Both ProfileType + Project changelists show a per-row "Edit" button matching `module_user/admin.py:114` pattern | Edit buttons visible | **Manual smoke — verify in browser** |

---

## Verification Block — to run after item 12

```bash
# 1. Django config check
python manage.py check
# expect: exit 0 (only pre-existing staticfiles.W004 warning)

# 2. Form round-trip
python manage.py shell <<'PY'
from module_project.models import ProfileType
from module_project.forms import ProfileTypeAdminForm

pt = ProfileType.objects.first()
print("Before:", pt.theme)

form = ProfileTypeAdminForm(
    data={
        # carry forward existing non-theme values via initial
        **{k: v for k, v in {
            'code': pt.code,
            'name': pt.name,
            'description': pt.description or '',
            # stage_config + key indicators omitted for brevity — populate as needed
        }.items() if v is not None},
        'theme_primary': '#aabbcc',
        'theme_gradient_from': '#112233',
        'theme_gradient_to': '#445566',
    },
    instance=pt,
)
# is_valid() will fail unless all required fields are provided.
# For real smoke, easier to instantiate form bound to instance and check initial:
unbound = ProfileTypeAdminForm(instance=pt)
print("Initial primary:", unbound['theme_primary'].value())
print("Initial gradient.from:", unbound['theme_gradient_from'].value())
print("Initial gradient.to:", unbound['theme_gradient_to'].value())
PY
```

Expected: initial values match `pt.theme` keys; defaults applied when keys missing.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Existing rows have `theme = NULL` or malformed | `_default_theme()` already gives every row the placeholder shape (Phase 1 SQL set NOT NULL DEFAULT). The form's `__init__` falls back to `_default_theme()` if a key is missing. |
| HTML5 `<input type="color">` only accepts `#rrggbb` (6-hex, lowercase) | Add a clean-up in `clean_theme_primary` (etc.) to normalise — strip whitespace, lowercase. |
| `autocomplete_fields = ['parameter']` requires `ParameterTypeAdmin.search_fields` set | Phase 5 already set `search_fields = ['parameter_code', 'parameter_name']` ✅ |
| Removing standalone `ProjectParameterSettingAdmin` breaks any direct URL | We grep for `/admin/.*/projectparametersetting/` first. Manual smoke confirms no bookmarks point there. |
| Unfold ModelAdmin upgrade subtly changes existing list_display rendering | Compare ProfileType / Project changelists before & after upgrade. If Unfold strips the audit columns, restore in `list_display`. |
| Adding `'edit_link'` as last list_display column when changelist links the first column too | Match `module_user` — both work. Cosmetic only. |

---

## Out of Scope for Phase 6

| Phase | Work |
|---|---|
| Phase 7 | Views + URLs: `GET /api/profile-types/`, optionally `/api/parameter-types/`, `/api/growth-indicators/`. |
| Phase 8 | Seed real per-profile theme JSONB + populate `is_key_parameter` flags. |
| Phase 9 | Manual smoke + DB validation across the whole arc. |
| Phase 10 | Docs. |
| Part 3 polish | Live gradient preview swatch via Alpine.js; richer stage_config editor (currently still JSON textarea). |

**Not in this phase:** model changes (Phase 2/3 owned), SQL changes (Phase 1), serializer changes (Phase 5), view changes (Phase 7), seed data (Phase 8), front-end work (Part 2).

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `module_project/admin.py` uses `unfold.admin.ModelAdmin` for all 4 standalone admins |
| [x] | `module_project/forms.py` exists and exports `ProfileTypeAdminForm` |
| [x] | ProfileType change form renders 3 native colour pickers; round-trip to JSONB works (shell-verified; visual confirm pending) |
| [x] | Project change form has `ProjectParameterSetting` inline (TabularInline) with autocomplete on `parameter` |
| [x] | Standalone `ProjectParameterSettingAdmin` registration removed |
| [x] | ProfileType + Project changelists show per-row Edit buttons |
| [x] | `manage.py check` exits 0 |
| [ ] | Browser smoke confirms each of the above visually (items 14-17) |

---

## Files Touched in Phase 6

To be filled in as items are checked off.

| File | What changed |
|---|---|
| `backend/module_project/admin.py` | Upgraded all admins to `unfold.admin.ModelAdmin`. Added `ProjectParameterSettingInline` (TabularInline). Wired `form = ProfileTypeAdminForm` on `ProfileTypeAdmin` with the 3-colour-picker Theme fieldset. Wired `inlines = [ProjectParameterSettingInline]` on `ProjectAdmin`. Removed standalone `ProjectParameterSettingAdmin`. Added `edit_link` method + column on ProfileType + Project admins. |
| `backend/module_project/forms.py` (new) | `ProfileTypeAdminForm(forms.ModelForm)` — decomposes `theme` JSONB into 3 synthetic HTML5 colour-picker CharFields and reassembles on save. |

---

*Last updated: 2026-05-22*
