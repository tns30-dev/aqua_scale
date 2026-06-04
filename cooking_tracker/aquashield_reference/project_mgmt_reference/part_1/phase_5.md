# Part 1 — Phase 5 — Admin + Serializer Migration

---

## Goal

Re-register the three relocated/new models under `module_project.admin` and `module_project.serializers`, and refresh the existing `ProfileTypeAdmin` / `ProjectAdmin` to reflect the Phase 2 model changes.

1. **Fix `ProjectAdmin.fieldsets`** — it still references the dead `parameters` + `parameter_priority` fields. Currently `manage.py check` passes (Django resolves fieldsets lazily) but the Project change-form will 500 on first visit. Drop those references.
2. **Refresh `ProfileTypeAdmin`** — it shows only `name` + `description`. Update to surface the new fields (`code`, `key_parameter_indicators`, `key_growth_indicators`, `theme`, audit columns). Keep the form simple — **the decomposed theme colour-picker UX lands in Phase 6**, not here. For Phase 5, `theme` renders as Django's default JSON textarea (acceptable interim).
3. **Add `ParameterTypeAdmin`** — same shape as the removed `module_sensor` version.
4. **Add `GrowthIndicatorAdmin`** — new (no previous admin).
5. **Add `ProjectParameterSettingAdmin`** — standalone admin for Phase 5. **Phase 6 converts this into an inline under `ProjectAdmin` per D3-A**; for now the standalone changelist is fine.
6. **Add three serializers** to `module_project/serializers.py`: `ParameterTypeSerializer`, `GrowthIndicatorSerializer`, `ProjectParameterSettingSerializer`. The first two unblock `GET /api/parameter-types/` and `GET /api/growth-indicators/` in Phase 7 if Part 2 (FE) needs them.

Posture: vanilla `admin.ModelAdmin` throughout Phase 5 (matches the existing `module_project/admin.py` style). **Phase 6 may upgrade to `unfold.admin.ModelAdmin`** when polishing the Project admin shape + colour picker; not in scope here.

Source of truth: `project_mgmt_reference/overall.md` § "Resolved decisions" (D3-A) + § "Out of scope" sketches.

---

## Final Target for This Phase

```text
module_project/admin.py (after Phase 5)
  ProfileTypeAdmin          ← refreshed: shows code/name/audit; theme as JSON textarea (Phase 6 polishes)
  ProjectAdmin              ← refreshed: dead-field fieldset entries gone
  ParameterTypeAdmin        ← NEW (re-registered from module_sensor)
  GrowthIndicatorAdmin      ← NEW
  ProjectParameterSettingAdmin ← NEW (standalone for now; becomes inline in Phase 6)

module_project/serializers.py (after Phase 5)
  ProfileTypeSerializer            ← refreshed (Phase 2 already updated field list)
  ProjectSerializer                ← refreshed (Phase 2 already updated field list)
  ProjectDetailSerializer          ← unchanged
  ParameterTypeSerializer          ← NEW
  GrowthIndicatorSerializer        ← NEW
  ProjectParameterSettingSerializer ← NEW
```

No model changes. No SQL changes. Pure admin + serializer surface work.

---

## Checklist Tracking

| No. | Done | Area | Step | Expected Result | Verification |
|---|---|---|---|---|---|
| 1 | [x] | `module_project/admin.py` — ProjectAdmin | Drop the `('Configuration', {'fields': ('parameters', 'parameter_priority'), ...})` fieldset block — those fields are gone from the model since Phase 2. Reshape the fieldsets to: `('Basic Info', ('name', 'description', 'owner', 'profile_type'))`, `('Audit', ('project_id', 'created_at', 'updated_at', 'created_by', 'updated_by'))`. Add `'updated_at'`, `'created_by'`, `'updated_by'` to `readonly_fields` (audit cols auto-populate). | Project change form renders without crashing | Open `/admin/module_project/project/<id>/change/` — no `FieldError` |
| 2 | [x] | `module_project/admin.py` — ProfileTypeAdmin | Refresh `list_display` to `('code', 'name', 'description')`. Add `search_fields = ('code', 'name')`. Add `readonly_fields = ('profile_type_id', 'created_at', 'updated_at')`. Define `fieldsets`: Identity (code, name, description), Stages (stage_config), Key indicators (key_parameter_indicators, key_growth_indicators), Theme (theme), Audit (profile_type_id, created_at, updated_at, created_by, updated_by). **No theme colour picker** — Phase 6 wires that. | ProfileType change form shows all fields | Manual smoke |
| 3 | [x] | `module_project/admin.py` — ParameterTypeAdmin | New `@admin.register(ParameterType)` block. `list_display = ('parameter_code', 'parameter_name', 'unit', 'data_type')`, `list_filter = ('data_type',)`, `search_fields = ('parameter_code', 'parameter_name')`, `readonly_fields = ('parameter_id',)`. Same shape as the previously-removed `module_sensor` version. | ParameterType admin reachable at `/admin/module_project/parametertype/` | URL resolves; list shows 22 rows |
| 4 | [x] | `module_project/admin.py` — GrowthIndicatorAdmin | New `@admin.register(GrowthIndicator)` block. `list_display = ('code', 'name', 'unit', 'data_type')`, `search_fields = ('code', 'name')`, `readonly_fields = ('growth_indicator_id',)`. | GrowthIndicator admin reachable at `/admin/module_project/growthindicator/` | URL resolves; list shows 11 rows |
| 5 | [x] | `module_project/admin.py` — ProjectParameterSettingAdmin | New `@admin.register(ProjectParameterSetting)` block. `list_display = ('project', 'parameter', 'min_threshold', 'max_threshold', 'is_key_parameter')`, `list_filter = ('project', 'is_key_parameter')`, `search_fields = ('project__name', 'parameter__parameter_code')`, `list_select_related = ('project', 'parameter')`, `readonly_fields = ('project_parameter_setting_id',)`. Standalone admin — Phase 6 converts this into an inline under `ProjectAdmin`. | Admin reachable; rows visible | URL resolves; list shows 39 rows |
| 6 | [x] | `module_project/admin.py` — imports | Update the top-of-file `from .models import ProfileType, Project` to include `ParameterType, GrowthIndicator, ProjectParameterSetting`. Update the module docstring to mention all 5 registered models. | Imports clean | grep |
| 7 | [x] | `module_project/serializers.py` — ParameterTypeSerializer | Add a `ParameterTypeSerializer(serializers.ModelSerializer)`. Fields: `parameter_id, parameter_code, parameter_name, unit, data_type`. `read_only_fields = ('parameter_id',)`. Same shape as the previously-removed `module_sensor` version. | Serializer importable | shell smoke ✅ alkalinity row |
| 8 | [x] | `module_project/serializers.py` — GrowthIndicatorSerializer | New `GrowthIndicatorSerializer(serializers.ModelSerializer)`. Fields: `growth_indicator_id, code, name, unit, data_type`. `read_only_fields = ('growth_indicator_id',)`. | Serializer importable | shell smoke ✅ body_weight row |
| 9 | [x] | `module_project/serializers.py` — ProjectParameterSettingSerializer | New `ProjectParameterSettingSerializer(serializers.ModelSerializer)`. Pull parameter display fields via SerializerMethodField or `source='parameter.parameter_name'` etc. Fields: `project_parameter_setting_id, project, parameter, parameter_code, parameter_name, parameter_unit, min_threshold, max_threshold, is_key_parameter`. | Serializer importable | shell smoke ✅ temperature setting |
| 10 | [x] | `module_project/serializers.py` — imports | Update the top-of-file `from .models import ProfileType, Project` to include the 3 added models. | Imports clean | grep |
| 11 | [x] | Verification — `manage.py check` | Exit 0 | Django config valid | `python manage.py check` — only pre-existing staticfiles.W004 warning |
| 12 | [ ] | Verification — admin index | `python manage.py runserver` (or RequestFactory) — confirm `/admin/` shows 5 entries under "Module Project": ProfileType, Project, ParameterType, GrowthIndicator, ProjectParameterSetting | Five entries visible | **Manual smoke — verify in browser** |
| 13 | [ ] | Verification — each admin loads | Open each of the 5 changelists. None should 500. | All five pages render | **Manual smoke — verify in browser** |
| 14 | [ ] | Verification — Project change form | Open `/admin/.../project/<id>/change/` — must not raise `FieldError` on the now-dropped fieldset entries | Change form renders | **Manual smoke — verify in browser** |
| 15 | [x] | Verification — serializer smoke | Django shell: instantiate each serializer with an existing instance, call `.data`, verify the dict shape | All three serializers serialise clean | shell smoke ran — three populated dicts returned |

---

## Verification Block — to run after item 11

```bash
# 1. Django config check
python manage.py check
# expect: exit 0 (only the staticfiles.W004 warning)

# 2. Serializer smoke
python manage.py shell <<'PY'
from module_project.models import (
    ParameterType, GrowthIndicator, ProjectParameterSetting,
)
from module_project.serializers import (
    ParameterTypeSerializer, GrowthIndicatorSerializer,
    ProjectParameterSettingSerializer,
)

print("--- ParameterTypeSerializer ---")
pt = ParameterType.objects.first()
print(ParameterTypeSerializer(pt).data)

print("--- GrowthIndicatorSerializer ---")
gi = GrowthIndicator.objects.first()
if gi:
    print(GrowthIndicatorSerializer(gi).data)
else:
    print("(growth_indicators table is empty — Phase 8 seeds)")

print("--- ProjectParameterSettingSerializer ---")
pps = ProjectParameterSetting.objects.select_related('project','parameter').first()
print(ProjectParameterSettingSerializer(pps).data)
PY
```

Expected: each `.data` returns a dict with the declared fields. No exceptions.

---

## Deferred Breakage — Consolidated (after Phase 5)

**Closed by this phase:**

- All three relocated/new models now have admin pages on `/admin/module_project/`.
- `ProjectAdmin.fieldsets` no longer references dead `parameters`/`parameter_priority` fields → Project change form no longer 500s.
- DRF serializers for `ParameterType`, `GrowthIndicator`, `ProjectParameterSetting` are available for Phase 7 to wire into `views.py`.

**Phase 6 territory (not broken; deferred polish):**

- `ProfileType.theme` renders as Django's default JSON textarea. Phase 6 swaps in the decomposed colour-picker form (native HTML5 `<input type="color">` × 3 per the colour-picker plan).
- `ProjectParameterSetting` admin is standalone. Phase 6 converts to inline under `ProjectAdmin` per D3-A.
- Per-row Edit buttons / list_select_related on `ProjectAdmin` etc. — Phase 6 polish.

---

## Out of Scope for Phase 5

| Phase | Work |
|---|---|
| Phase 6 | Project admin shape: theme decomposed form (native colour pickers), `ProjectParameterSetting` inline under `Project`, list-display polish, `unfold.admin.ModelAdmin` upgrade if needed. |
| Phase 7 | Views + URLs (`GET /api/profile-types/`, optionally `/api/parameter-types/`, `/api/growth-indicators/`). |
| Phase 8 | Seed real per-profile theme values + populate `is_key_parameter` flags from each profile's `key_parameter_indicators` array. |
| Phase 9 | Manual smoke + DB validation across the whole arc. |
| Phase 10 | Docs. |

**Not in this phase:** model changes (Phase 2/3 owned that), SQL changes (Phase 1), view changes (Phase 7).

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `module_project/admin.py` registers 5 models: ProfileType, Project, ParameterType, GrowthIndicator, ProjectParameterSetting |
| [x] | `ProjectAdmin.fieldsets` no longer references `parameters` / `parameter_priority` |
| [x] | `module_project/serializers.py` exports 6 serializers (existing 3 + 3 new) |
| [x] | `manage.py check` exits 0 |
| [ ] | Each admin changelist page resolves (manual smoke — to verify in browser) |
| [ ] | Project change form renders without `FieldError` (manual smoke — to verify in browser) |
| [x] | All three new serializers serialise an instance cleanly (shell smoke block) |

---

## Files Touched in Phase 5

To be filled in as items are checked off.

| File | What changed |
|---|---|
| `backend/module_project/admin.py` | Refreshed `ProfileTypeAdmin` (new field list + fieldsets, no colour picker yet). Refreshed `ProjectAdmin` (dead-field fieldset entries dropped). Added `ParameterTypeAdmin`, `GrowthIndicatorAdmin`, `ProjectParameterSettingAdmin`. Updated imports + module docstring. |
| `backend/module_project/serializers.py` | Added `ParameterTypeSerializer`, `GrowthIndicatorSerializer`, `ProjectParameterSettingSerializer`. Updated imports. |

---

*Last updated: 2026-05-22*
