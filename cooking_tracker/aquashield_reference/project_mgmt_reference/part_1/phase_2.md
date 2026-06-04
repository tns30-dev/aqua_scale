# Part 1 — Phase 2 — `ProfileType` + `Project` Model Refinement

---

## Goal

Bring `module_project/models.py` into the target shape defined in `archive/class_diagram_finalization/view_profile_type.md` and `view_project.md`:

1. **Close the deferred breakage from Phase 1** — prune the four dead Python field declarations (`ProfileType.default_parameters`, `ProfileType.parameter_priority`, `Project.parameters`, `Project.parameter_priority`) so the ORM stops trying to SELECT now-absent DB columns.
2. **Add the new fields that landed in Phase 1's SQL** — `theme JSONField`, plus a previously-missing Python field for `key_growth_indicators`. Add audit columns (`created_at` / `created_by` / `updated_at` / `updated_by`) which exist in SQL but aren't on the Django models.
3. **Rename `ProfileType.key_indicators` → `key_parameter_indicators`** so the Python attribute matches the DB column name and the class diagram. Three caller files updated as a consequence.
4. **Drop the legacy `PROFILE_CHOICES` constraint on `ProfileType.name`** — Phase 1 already dropped the matching SQL CHECK; the Django `choices=` argument is now obsolete (`code` is the machine identifier; `name` is free-text display).
5. **Add class methods per the class diagram** — `ProfileType` gets five (`get_stages`, `get_stage_by_day`, `get_key_parameters`, `get_key_growth_indicators`, `get_cycle_length`). `Project` gets the four that DON'T depend on relocated models: `get_ponds`, `get_active_ponds`, `get_profile_type`, `get_owner`. The two methods that need `ProjectParameterSetting` (`get_parameter_settings`, `get_key_parameters`) land in Phase 3 alongside the relocation.

Source of truth: `project_mgmt_reference/overall.md` § "Target state" + `archive/class_diagram_finalization/view_profile_type.md` + `view_project.md`.

---

## Final Target for This Phase

```python
# module_project/models.py (after Phase 2)

class ProfileType(models.Model):
    profile_type_id = UUIDField(primary_key=True, ...)
    name           = CharField(max_length=100, unique=True, db_column='name')   # no choices=
    code           = CharField(max_length=100, unique=True, null=True, blank=True)
    description    = TextField(null=True, blank=True)
    stage_config   = JSONField(null=True, blank=True)
    key_parameter_indicators = ArrayField(CharField(max_length=100), ...)     # ← renamed from key_indicators
    key_growth_indicators    = ArrayField(CharField(max_length=100), ...)     # ← NEW
    theme          = JSONField(default=_default_theme, db_column='theme')      # ← NEW
    created_at     = DateTimeField(auto_now_add=True)
    created_by     = ForeignKey('module_user.User', null=True, blank=True, ...)
    updated_at     = DateTimeField(auto_now=True)
    updated_by     = ForeignKey('module_user.User', null=True, blank=True, ...)

    # ── methods ──────────────────────────────
    def get_stages(self) -> list[dict]: ...
    def get_stage_by_day(self, day_number: int) -> dict | None: ...
    def get_key_parameters(self) -> list[str]: ...
    def get_key_growth_indicators(self) -> list[str]: ...
    def get_cycle_length(self) -> int: ...

    # REMOVED: default_parameters, parameter_priority, PROFILE_CHOICES

class Project(models.Model):
    project_id      = UUIDField(primary_key=True, ...)
    owner           = ForeignKey('module_user.User', db_column='project_owner_id', ...)
    profile_type    = ForeignKey(ProfileType, on_delete=PROTECT, ...)
    name            = CharField(max_length=255)
    description     = TextField(null=True, blank=True)
    created_at      = DateTimeField(auto_now_add=True)
    created_by      = ForeignKey('module_user.User', null=True, blank=True, ...)
    updated_at      = DateTimeField(auto_now=True)
    updated_by      = ForeignKey('module_user.User', null=True, blank=True, ...)

    # ── methods (deps on ProjectParameterSetting deferred to Phase 3) ──
    def get_ponds(self) -> QuerySet: ...
    def get_active_ponds(self) -> QuerySet: ...
    def get_profile_type(self) -> ProfileType: ...
    def get_owner(self): ...

    # REMOVED: parameters, parameter_priority
```

Helper at module scope:

```python
def _default_theme() -> dict:
    return {"primary": "#888888", "gradient": {"from": "#888888", "to": "#cccccc"}}
```

Field default uses a callable so each new row gets a fresh dict (avoids the [shared-default-mutable trap](https://docs.djangoproject.com/en/5.2/ref/models/fields/#django.db.models.Field.default)).

---

## Checklist Tracking

| No. | Done | Area | Step | Expected Result | Verification |
|---|---|---|---|---|---|
| 1 | [x] | `models.py` — helper | Add a module-level helper `def _default_theme(): return {"primary": "#888888", "gradient": {"from": "#888888", "to": "#cccccc"}}` near the top of the file (just below imports) | Callable available before either class needs it | grep finds the def |
| 2 | [x] | `ProfileType` — drop choices | Remove the `PROFILE_CHOICES` constant + the `choices=PROFILE_CHOICES` argument on the `name` field | `name` is plain free-text | `ProfileType._meta.get_field('name').choices == []` |
| 3 | [x] | `ProfileType` — drop dead fields | Remove the `default_parameters` and `parameter_priority` field declarations entirely (closes the Phase 1 deferred breakage) | Fields gone | `ProfileType._meta.get_field('default_parameters')` raises `FieldDoesNotExist` |
| 4 | [x] | `ProfileType` — rename `key_indicators` | Rename `key_indicators = ArrayField(...)` → `key_parameter_indicators = ArrayField(...)`. `db_column` was already `'key_parameter_indicators'` so no DB-side change is needed | Python field name matches DB column | `ProfileType._meta.get_field('key_parameter_indicators')` returns the field; the old name raises `FieldDoesNotExist` |
| 5 | [x] | `ProfileType` — add `key_growth_indicators` | New `key_growth_indicators = ArrayField(CharField(max_length=100), null=True, blank=True, db_column='key_growth_indicators', help_text='Key growth metric codes')` | Field present, maps to existing DB column | `ProfileType.objects.first().key_growth_indicators` returns None or list |
| 6 | [x] | `ProfileType` — add `theme` | New `theme = JSONField(default=_default_theme, db_column='theme', help_text='Visual theme — primary + gradient')`. **Default must be a callable, not a literal dict** | Field present | `ProfileType.objects.first().theme` returns the placeholder dict |
| 7 | [x] | `ProfileType` — audit fields | Add `created_at = DateTimeField(auto_now_add=True)`, `updated_at = DateTimeField(auto_now=True)`, `created_by = ForeignKey('module_user.User', null=True, blank=True, on_delete=SET_NULL, db_column='created_by', related_name='+')`, `updated_by = ForeignKey('module_user.User', null=True, blank=True, on_delete=SET_NULL, db_column='updated_by', related_name='+')` | Audit columns reachable from ORM | `pt._meta.get_field('created_by')` resolves |
| 8 | [x] | `ProfileType` — `__str__` | Replace `self.get_name_display()` (which depended on `choices=`) with `self.name` or `self.code or self.name` | `str(pt)` returns a sensible label | shell smoke |
| 9 | [x] | `ProfileType` — `get_stages()` | Add method. Read `self.stage_config`. If it's a list, return it. If it's a dict containing a `"stages"` key (the `fish` profile's shape), return that array. If neither, return `[]`. | Returns a list of stage dicts | `pt.get_stages()` works for shrimp (list), fish (dict with `stages`), treatment (NULL → []) |
| 10 | [x] | `ProfileType` — `get_stage_by_day(day)` | Add method. Walks `get_stages()`; returns the stage whose `startDay <= day <= endDay`, else None | Day-to-stage lookup works | `pt.get_stage_by_day(15)` returns the right stage for a shrimp profile |
| 11 | [x] | `ProfileType` — `get_key_parameters()` | Add method. Returns `self.key_parameter_indicators or []` | Returns a list | shell smoke |
| 12 | [x] | `ProfileType` — `get_key_growth_indicators()` | Add method. Returns `self.key_growth_indicators or []` | Returns a list | shell smoke |
| 13 | [x] | `ProfileType` — `get_cycle_length()` | Add method. Returns the max `endDay` across all stages from `get_stages()`. Returns 0 if no stages | Returns total cycle length | `pt.get_cycle_length()` returns 90 for shrimp, 163 for fish, 192 for crab_hatchery |
| 14 | [x] | `Project` — drop dead fields | Remove the `parameters` and `parameter_priority` field declarations entirely | Fields gone | `Project._meta.get_field('parameters')` raises `FieldDoesNotExist` |
| 15 | [x] | `Project` — audit fields | Add `created_by`, `updated_at`, `updated_by` (same shape as ProfileType's audit fields). `created_at` already exists — keep it. | All four audit cols reachable | `pj._meta.get_field('updated_at')` resolves |
| 16 | [x] | `Project` — `get_ponds()` | Add method. `return self.ponds.all()` — uses the `related_name='ponds'` reverse FK that `Pond.project` (in `module_pond`) declares. If `related_name` isn't `ponds`, use `from module_pond.models import Pond` (lazy, inside method) and `Pond.objects.filter(project=self)` | Returns a Pond queryset | `Project.objects.first().get_ponds().count()` returns the project's pond count |
| 17 | [x] | `Project` — `get_active_ponds()` | Add method. Filters `get_ponds()` to `status='active'` | Returns active ponds only | shell smoke |
| 18 | [x] | `Project` — `get_profile_type()` + `get_owner()` | Trivial accessors: `return self.profile_type` / `return self.owner` | Method exists | shell smoke |
| 19 | [x] | Caller update — `serializers.py` | Line ~30: `'key_indicators'` → `'key_parameter_indicators'` in the serializer's `fields` tuple | Serializer references new field name | `grep -n "key_indicators\b" module_project/serializers.py` returns 0 |
| 20 | [x] | Caller update — `seed_demo_data.py` | Five occurrences of `key_indicators` (4 in seed data dicts, 1 in the `defaults={...}` argument): rename to `key_parameter_indicators` | Seed command can run without `FieldError` | `grep -n "key_indicators\b" module_project/management/commands/seed_demo_data.py` returns 0 |
| 21 | [x] | Caller update — `views.py` | Line ~203: `project.profile_type.key_indicators` → `project.profile_type.key_parameter_indicators` | View reads from new attribute | `grep -n "\.key_indicators\b" module_project/views.py` returns 0 |
| 22 | [x] | `manage.py check` | Exit 0 | Django config valid | `python manage.py check` |
| 23 | [x] | ORM smoke — read each profile | Django shell: `from module_project.models import ProfileType; for pt in ProfileType.objects.all(): print(pt.code, pt.name, pt.theme['primary'])` | All 4 profile types readable end-to-end | Shell prints 4 lines |
| 24 | [x] | ORM smoke — methods | `pt = ProfileType.objects.get(code='shrimp'); print(pt.get_cycle_length(), len(pt.get_stages()), pt.get_key_parameters(), pt.get_key_growth_indicators())` | Methods return sensible values | `get_cycle_length()` == 90 for shrimp; `get_stages()` returns 4 stages |
| 25 | [x] | ORM smoke — projects | `from module_project.models import Project; pj = Project.objects.first(); print(pj.name, pj.get_owner(), pj.get_profile_type(), pj.get_ponds().count())` | All four `Project` methods work | Shell smoke green |
| 26 | [x] | Deferred breakage refresh | Update the section below — Phase 1's breakage is closed. Phase 2 introduces no NEW deferred breakage (all callers were updated in items 19-21). | Section accurate | Below |

---

## Deferred Breakage — Consolidated (after Phase 2)

Phase 1's deferred breakage is fully closed:
- `ProfileType` no longer references `default_parameters` / `parameter_priority` columns → ORM read/write works.
- `Project` no longer references `parameters` / `parameter_priority` columns → ORM read/write works.
- All three caller files updated for the `key_indicators` → `key_parameter_indicators` rename.

**Phase 3 territory (not yet broken, but called out for visibility):**

- `module_sensor/models.py` still owns `ParameterType` and `ProjectParameterSetting`. Phase 3 moves them to `module_project/models.py`.
- `module_project` does NOT yet have `GrowthIndicator`. Phase 3 creates it.
- `Project.get_parameter_settings()` and `Project.get_key_parameters()` are intentionally absent from this phase — they need `ProjectParameterSetting` to exist in `module_project`. Added in Phase 3.

---

## Verification Block — to run after item 25

```bash
# 1. Django config check
python manage.py check
# expect: System check identified 0 issues (or 1 unrelated staticfiles warning)

# 2. Open Django shell and run:
python manage.py shell <<'PY'
from module_project.models import ProfileType, Project

print("--- ProfileType count + theme defaults ---")
for pt in ProfileType.objects.order_by('code'):
    print(f"  {pt.code}: theme.primary={pt.theme.get('primary')}, name={pt.name}")

print("--- Methods on shrimp ---")
shrimp = ProfileType.objects.get(code='shrimp')
print(f"  get_cycle_length() = {shrimp.get_cycle_length()}")
print(f"  len(get_stages())  = {len(shrimp.get_stages())}")
print(f"  get_key_parameters()        = {shrimp.get_key_parameters()}")
print(f"  get_key_growth_indicators() = {shrimp.get_key_growth_indicators()}")
print(f"  get_stage_by_day(15)        = {shrimp.get_stage_by_day(15)}")

print("--- Project ---")
for pj in Project.objects.all():
    print(f"  {pj.name}: owner={pj.get_owner()}, profile={pj.get_profile_type().code}, ponds={pj.get_ponds().count()}")
PY
```

Expected:

- 4 ProfileType rows, each with `theme.primary='#888888'` (placeholder; Phase 8 will overwrite with real colours).
- Shrimp: cycle_length=90, 4 stages, key_parameters=['temperature','ph','salinity','ammonia','nitrite'] (whatever the seed had), key_growth_indicators=['body_weight','daily_gain','fcr','mortality_rate'].

  Note: looking at the local_share seed, `key_parameter_indicators` actually carries growth-metric codes for shrimp (data quirk inherited from the previous intern's seed). Don't fix this in Phase 2 — Phase 8 reseeds.

- `get_stage_by_day(15)` returns the "Early Growth Monitoring" stage (startDay=11, endDay=40) for shrimp.

- 3 Project rows, each with owner, profile, and a non-zero pond count (16 ponds across the 3 projects per memory).

---

## Out of Scope for Phase 2

| Phase | Work |
|---|---|
| Phase 3 | Move `ParameterType` + `ProjectParameterSetting` from `module_sensor` to `module_project`. Create `GrowthIndicator`. Add `Project.get_parameter_settings()` + `get_key_parameters()` methods (need `ProjectParameterSetting`). |
| Phase 4 | Cross-module FK + import sweep (`module_chart` FK string, `module_data_ingestion` direct imports, scripts). |
| Phase 5 | Admin + serializer migration. |
| Phase 6 | Project admin shape — including the decomposed `theme` form with native HTML5 `<input type="color">`. |
| Phase 7 | Views + URLs (`GET /api/profile-types/`). |
| Phase 8 | Seed real per-profile theme values. |
| Phase 9 | Manual smoke + DB validation across the whole arc. |
| Phase 10 | Docs. |

**Not in this phase:** any SQL change, any admin/serializer/view change. Phase 2 is purely Python model surgery + the three caller updates that fall out of the field rename.

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `models.py` `ProfileType` has no `default_parameters`, `parameter_priority`, `PROFILE_CHOICES`. Has `key_parameter_indicators` (renamed), `key_growth_indicators` (new), `theme` (new), audit fields (new). All five class methods present. |
| [x] | `models.py` `Project` has no `parameters`, `parameter_priority`. Has audit fields (new). Four class methods present. |
| [x] | `serializers.py`, `seed_demo_data.py`, `views.py` updated to reference `key_parameter_indicators` (not `key_indicators`). No leftover `key_indicators` references in Python sources. |
| [x] | `manage.py check` exits 0. |
| [x] | ORM smoke block above prints expected values for all 4 profile types + all projects. |
| [x] | `ProfileType.objects.first().theme` returns a dict (not a string). |
| [x] | `ProfileType.objects.first().get_cycle_length()` returns a non-zero int for profiles with stages. |
| [x] | `Project.objects.first().get_ponds().count()` returns a sensible number. |

---

## Files Touched in Phase 2

To be filled in as items are checked off.

| File | What changed |
|---|---|
| `backend/module_project/models.py` | Helper `_default_theme()` added. `ProfileType`: dropped `PROFILE_CHOICES` + `default_parameters` + `parameter_priority`; renamed `key_indicators` → `key_parameter_indicators`; added `key_growth_indicators`, `theme`, audit cols; added 5 class methods; updated `__str__`. `Project`: dropped `parameters` + `parameter_priority`; added 3 audit cols; added 4 class methods. |
| `backend/module_project/serializers.py` | One token rename: `'key_indicators'` → `'key_parameter_indicators'` in the serializer's `fields` tuple. |
| `backend/module_project/management/commands/seed_demo_data.py` | Five `key_indicators` references renamed to `key_parameter_indicators`. |
| `backend/module_project/views.py` | One reference renamed: `project.profile_type.key_indicators` → `key_parameter_indicators`. |

---

*Last updated: 2026-05-22*
