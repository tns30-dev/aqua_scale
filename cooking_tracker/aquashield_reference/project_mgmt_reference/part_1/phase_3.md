# Part 1 — Phase 3 — Model Relocation + Cross-Module Sweep

---

## Goal

Move the three project-domain reference models into `module_project` and update every caller in the same pass:

1. **Move `ParameterType`** from `module_sensor/models.py` → `module_project/models.py`. Same `db_table = 'parameter_types'`, same fields. Verbatim copy.
2. **Move `ProjectParameterSetting`** from `module_sensor/models.py` → `module_project/models.py`. Same `db_table = 'project_parameter_settings'`. Keeps its `is_within_threshold(value)` + `get_violation_message(value)` methods (matches class diagram).
3. **Create `GrowthIndicator`** in `module_project/models.py` — a brand-new Django model for the existing `growth_indicators` SQL table. No model existed before.
4. **Sweep all callers** so Django stays bootable: cross-module FK string in `module_chart/models.py`; direct imports in `module_chart/services/`, `module_data_ingestion`, scripts; clean out `module_sensor/admin.py` + `module_sensor/serializers.py` entries for the two moved models.
5. **Add the deferred `Project` methods** — `get_parameter_settings()` and `get_key_parameters()` (held back from Phase 2 because they need `ProjectParameterSetting` in this module first).

---

## Scope note — phases combined

`overall.md` lists Phase 3 (model relocation) and Phase 4 (cross-module sweep) as separate. **They have to land together** because the moment `ParameterType` is removed from `module_sensor.models`, every caller doing `from module_sensor.models import ParameterType` ImportErrors at Django startup. There's no intermediate state where `manage.py check` stays green if we split them.

So this phase covers both. What `overall.md` called Phase 4 is **absorbed here**. Subsequent phases keep their original numbers (Phase 5 = admin/serializer migration, Phase 6 = project admin shape, etc.) — a thin "Phase 4" gap remains in numbering only.

Source of truth: `project_mgmt_reference/overall.md` § "Module ownership reshape" + § "Cross-module references to relocate".

---

## Final Target for This Phase

```text
module_project/models.py (after Phase 3)
  ProfileType                 ← unchanged from Phase 2
  Project                     ← unchanged from Phase 2 + gains 2 methods
    get_parameter_settings()      ← NEW (uses ProjectParameterSetting reverse FK)
    get_key_parameters()          ← NEW (filters is_key_parameter=True)
  ParameterType               ← MOVED FROM module_sensor
  GrowthIndicator             ← NEW
  ProjectParameterSetting     ← MOVED FROM module_sensor

module_sensor/models.py (after Phase 3)
  SensorType                  ← stays; get_parameters() uses lazy import
  Sensor                      ← stays
  SensorMessage               ← stays
  IoTDevice / SensorReading   ← stays
  ParameterType               ← REMOVED (moved to module_project)
  ProjectParameterSetting     ← REMOVED (moved to module_project)

module_sensor/admin.py
  Sensor / SensorType / IoTDevice admin ← stays
  ParameterType admin                   ← REMOVED (re-registered in module_project at Phase 5)
  ProjectParameterSetting admin         ← REMOVED (re-registered as inline at Phase 5)

module_sensor/serializers.py
  Sensor / SensorType / Reading / Ingest ← stays
  ParameterTypeSerializer                ← REMOVED (re-added in module_project at Phase 5)
  ProjectParameterSettingSerializer      ← REMOVED (re-added if needed at Phase 5)

module_chart/models.py
  FK string 'module_sensor.ParameterType' → 'module_project.ParameterType'
```

`GrowthIndicator` model shape (matches the existing `growth_indicators` SQL table):

```python
class GrowthIndicator(models.Model):
    growth_indicator_id = UUIDField(primary_key=True, default=uuid.uuid4, db_column=...)
    code      = CharField(max_length=50, unique=True, db_column='code')
    name      = CharField(max_length=100, db_column='name')
    unit      = CharField(max_length=20, null=True, blank=True, db_column='unit')
    data_type = CharField(max_length=50, default='float', db_column='data_type')

    class Meta:
        db_table = 'growth_indicators'
        managed  = False
        ordering = ['code']

    def __str__(self):
        return self.name or self.code
```

---

## Checklist Tracking

| No. | Done | Area | Step | Expected Result | Verification |
|---|---|---|---|---|---|
| 1 | [x] | `module_project/models.py` | Add `ParameterType` class — copy verbatim from `module_sensor/models.py` (lines 10–88). Keep `db_table='parameter_types'`, `managed=False`, all fields + `DATA_TYPE_CHOICES`, `name` property, `__str__`. | Class present in module_project | `python -c "from module_project.models import ParameterType"` exits 0 |
| 2 | [x] | `module_project/models.py` | Add `ProjectParameterSetting` class — copy from `module_sensor/models.py` lines 509–582. Keep `db_table='project_parameter_settings'`, `unique_together=[['project','parameter']]`, `is_within_threshold(value)`, `get_violation_message(value)`. **Note:** the FK to `ParameterType` is now a direct reference (same module) — change `parameter = models.ForeignKey(ParameterType, ...)` keeps working. The FK to `Project` was already a string `'module_project.Project'` — keep it. | Class present | `python -c "from module_project.models import ProjectParameterSetting"` exits 0 |
| 3 | [x] | `module_project/models.py` | Add new `GrowthIndicator` class per the Final Target shape. `managed=False`. | Class present, maps to `growth_indicators` table | `python -c "from module_project.models import GrowthIndicator; print(GrowthIndicator._meta.db_table)"` prints `growth_indicators` |
| 4 | [x] | `module_project/models.py` — Project | Add `get_parameter_settings(self)` returning `self.parameter_settings.all()` (uses the `related_name='parameter_settings'` reverse FK from `ProjectParameterSetting.project`) | Method exists | `Project.objects.first().get_parameter_settings()` returns queryset |
| 5 | [x] | `module_project/models.py` — Project | Add `get_key_parameters(self)` returning `self.parameter_settings.filter(is_key_parameter=True)` | Method exists | shell smoke |
| 6 | [x] | `module_sensor/models.py` | Delete the `ParameterType` class (lines 10–88) | Class gone | `grep -n "^class ParameterType" module_sensor/models.py` returns 0 |
| 7 | [x] | `module_sensor/models.py` | Delete the `ProjectParameterSetting` class | Class gone | `grep -n "^class ProjectParameterSetting" module_sensor/models.py` returns 0 |
| 8 | [x] | `module_sensor/models.py` | `SensorType.get_parameters()` body: change to lazy import — `from module_project.models import ParameterType` inside the method body, then `return ParameterType.objects.filter(...)`. The string-FK ArrayField on line 131 (`parameter_ids`) stores raw UUIDs and needs no change. | Method works after relocation | Shell: `sensor_type.get_parameters()` returns queryset |
| 9 | [x] | `module_sensor/admin.py` | Remove imports of `ParameterType` and `ProjectParameterSetting` from `.models`. Remove the `@admin.register(ParameterType)` block + `@admin.register(ProjectParameterSetting)` block (and their admin classes). Keep Sensor / SensorType / IoTDevice registrations. | Admin file imports cleanly | grep returns 0 |
| 10 | [x] | `module_sensor/serializers.py` | Same — remove `ParameterType, ProjectParameterSetting` from the import line; remove `ParameterTypeSerializer` and `ProjectParameterSettingSerializer` class definitions. Keep Sensor / SensorType / Reading / Ingest serializers. | Serializers file imports cleanly | grep returns 0 |
| 11 | [x] | `module_chart/models.py:31` | Change FK string `'module_sensor.ParameterType'` → `'module_project.ParameterType'` | Django can resolve the FK | `manage.py check` doesn't complain about the FK |
| 12 | [x] | `module_chart/services/chart_service.py:261` | `from module_sensor.models import ParameterType` → `from module_project.models import ParameterType` | Import resolves | grep |
| 13 | [x] | `module_data_ingestion/services.py:160` | `from module_sensor.models import ProjectParameterSetting` → `from module_project.models import ProjectParameterSetting` | Import resolves | grep |
| 14 | [x] | `module_data_ingestion/consumers.py:204` | Same change | Import resolves | grep |
| 15 | [x] | `module_data_ingestion/management/commands/seed_reading_partitions.py:16` | `from module_sensor.models import ParameterType` → `from module_project.models import ParameterType` | Import resolves | grep |
| 16 | [x] | `module_project/management/commands/seed_demo_data.py:19` | Line is `from module_sensor.models import ParameterType, SensorType, Sensor, ProjectParameterSetting`. Split it: `from module_project.models import ParameterType, ProjectParameterSetting` + `from module_sensor.models import SensorType, Sensor` | Both imports resolve | grep |
| 17 | [x] | `scripts/data_simulator.py:38` | `from module_sensor.models import ParameterType` → `from module_project.models import ParameterType` | Import resolves | grep |
| 18 | [x] | `scripts/verification/test_sensor_models.py:19` | Currently `from module_sensor.models import ParameterType, SensorType, Sensor, ProjectParameterSetting`. Split as in item 16. | Both imports resolve | grep |
| 19 | [x] | Sweep — any other callers | `grep -rn "from module_sensor.models import.*\\(ParameterType\\|ProjectParameterSetting\\)" backend/` to catch any sites missed | All hits updated | grep returns 0 |
| 20 | [x] | `manage.py check` | Run check after items 1-19 land together. Expected: exit 0. | Django boots clean | Exit 0 |
| 21 | [x] | ORM smoke — model presence | Django shell: import each of `ParameterType`, `ProjectParameterSetting`, `GrowthIndicator` from `module_project.models`; print `objects.count()` for each | 3 models reachable | `ParameterType.objects.count()` ≈ 23 (per seed); `ProjectParameterSetting.objects.count()` ≈ 24 (per seed: 8 params × 3 projects); `GrowthIndicator.objects.count()` = 0 (table empty — Phase 8 seeds) |
| 22 | [x] | ORM smoke — Project methods | `pj = Project.objects.get(name='Demo Shrimp Farm'); print(pj.get_parameter_settings().count(), pj.get_key_parameters().count())` | Methods return sensible counts | Shrimp shows ≈ 8 total settings, ≈ 5 key |
| 23 | [x] | ORM smoke — SensorType lazy import | `from module_sensor.models import SensorType; st = SensorType.objects.first(); print(st.get_parameters().count())` | Lazy import works | Some count > 0 |
| 24 | [x] | Deferred breakage refresh | Update section below; note admin/serializer entries are temporarily missing for the two moved models (Phase 5 re-adds under module_project). | Section accurate | Below |

---

## Deferred Breakage — Consolidated (after Phase 3)

**Fully closed by this phase:**

- All callers of `from module_sensor.models import ParameterType / ProjectParameterSetting` updated to import from `module_project.models`.
- `module_chart/models.py` FK string updated.
- `SensorType.get_parameters()` uses lazy import to avoid circular-load issues.
- `manage.py check` exits clean.

**Temporarily missing (closed by Phase 5):**

| Surface | What's missing | Closes in |
|---|---|---|
| Django admin | `ParameterType` admin page | Phase 5 (re-registered under `module_project.admin`) |
| Django admin | `ProjectParameterSetting` admin page | Phase 5 (added as inline under `Project` per D3-A) |
| Django admin | `GrowthIndicator` admin page | Phase 5 (new registration under `module_project.admin`) |
| DRF | `ParameterTypeSerializer` | Phase 5 (re-added under `module_project.serializers` if any view still needs it) |
| DRF | `ProjectParameterSettingSerializer` | Phase 5 |
| DRF | `GrowthIndicatorSerializer` | Phase 5 (only added if Part 2 FE needs `/api/growth-indicators/`) |

The admin / serializer disappearance is **expected**. Between Phase 3 and Phase 5, the only way to inspect these tables is via Django shell or `psql`. No application code path is broken because all callers were updated; only the admin GUI surface is briefly gone.

---

## Verification Block — to run after item 19

```bash
# 1. Django config check
python manage.py check
# expect: exit 0 (only the staticfiles.W004 warning)

# 2. Confirm zero residual references
grep -rn "from module_sensor.models import.*\(ParameterType\|ProjectParameterSetting\)" backend/ 2>/dev/null \
  | grep -v __pycache__
# expect: 0 lines

# 3. ORM smoke
python manage.py shell <<'PY'
from module_project.models import (
    ParameterType, ProjectParameterSetting, GrowthIndicator,
    Project, ProfileType,
)
print("--- Relocated models ---")
print(f"  ParameterType.count()           = {ParameterType.objects.count()}")
print(f"  ProjectParameterSetting.count() = {ProjectParameterSetting.objects.count()}")
print(f"  GrowthIndicator.count()         = {GrowthIndicator.objects.count()}  # Phase 8 seeds")

print("--- Project methods (new in Phase 3) ---")
for pj in Project.objects.all():
    n_all = pj.get_parameter_settings().count()
    n_key = pj.get_key_parameters().count()
    print(f"  {pj.name}: {n_all} settings ({n_key} key)")

print("--- SensorType.get_parameters() (lazy import) ---")
from module_sensor.models import SensorType
for st in SensorType.objects.all()[:3]:
    print(f"  {st}: {st.get_parameters().count()} parameters")
PY
```

Expected: 4 ProfileType, 3 Project, ~23 ParameterType, some non-zero ProjectParameterSetting, 0 GrowthIndicator (empty table). Sensor types each reach a positive parameter count.

---

## Out of Scope for Phase 3

| Phase | Work |
|---|---|
| Phase 5 | Re-register `ParameterType`, `ProjectParameterSetting`, `GrowthIndicator` admin entries under `module_project.admin`. Add inline for `ProjectParameterSetting` under Project change form (per D3-A). Add serializers under `module_project.serializers` if needed. |
| Phase 6 | Project admin shape: theme colour-picker form, audit fields readonly, etc. |
| Phase 7 | Views + URLs: `GET /api/profile-types/`. |
| Phase 8 | Seed real per-profile theme values + seed `growth_indicators` table. |
| Phase 9 | Manual smoke + DB validation. |
| Phase 10 | Docs. |

**Not in this phase:** any SQL change (Phase 1 owned that), any new admin/serializer entries (Phase 5).

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `module_project/models.py` exports `ParameterType`, `ProjectParameterSetting`, `GrowthIndicator` |
| [x] | `module_sensor/models.py` no longer defines `ParameterType` or `ProjectParameterSetting` |
| [x] | `module_sensor/admin.py` no longer registers either of those models |
| [x] | `module_sensor/serializers.py` no longer exports their serializers |
| [x] | `module_chart/models.py` FK string points at `'module_project.ParameterType'` |
| [x] | `grep -rn "from module_sensor.models import.*\(ParameterType\|ProjectParameterSetting\)" backend/` returns 0 |
| [x] | `manage.py check` exits 0 |
| [x] | ORM smoke block above runs end-to-end |
| [x] | `Project.objects.first().get_parameter_settings()` and `get_key_parameters()` both return querysets |
| [x] | `SensorType.get_parameters()` still works (lazy import) |

---

## Files Touched in Phase 3

To be filled in as items are checked off.

### Model files

| File | What changed |
|---|---|
| `backend/module_project/models.py` | Added `ParameterType`, `ProjectParameterSetting`, `GrowthIndicator` classes. Added `Project.get_parameter_settings()` and `Project.get_key_parameters()` methods. |
| `backend/module_sensor/models.py` | Removed `ParameterType` class. Removed `ProjectParameterSetting` class. Changed `SensorType.get_parameters()` to use a lazy import from `module_project.models`. |

### Admin / serializer cleanup (module_sensor side)

| File | What changed |
|---|---|
| `backend/module_sensor/admin.py` | Dropped `ParameterType` + `ProjectParameterSetting` from imports. Removed `ParameterTypeAdmin` + `ProjectParameterSettingAdmin` (~30 lines). |
| `backend/module_sensor/serializers.py` | Dropped both names from imports. Removed `ParameterTypeSerializer` + `ProjectParameterSettingSerializer`. |

### Cross-module import updates

| File | What changed |
|---|---|
| `backend/module_chart/models.py` | FK string `'module_sensor.ParameterType'` → `'module_project.ParameterType'`. |
| `backend/module_chart/services/chart_service.py` | Import path. |
| `backend/module_data_ingestion/services.py` | Import path. |
| `backend/module_data_ingestion/consumers.py` | Import path. |
| `backend/module_data_ingestion/management/commands/seed_reading_partitions.py` | Import path. |
| `backend/module_project/management/commands/seed_demo_data.py` | Split import: `ParameterType, ProjectParameterSetting` from `module_project.models`; `SensorType, Sensor` from `module_sensor.models`. |
| `backend/scripts/data_simulator.py` | Import path. |
| `backend/scripts/verification/test_sensor_models.py` | Split import (same shape as item 16). |

---

*Last updated: 2026-05-22*
