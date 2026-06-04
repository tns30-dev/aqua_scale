# Part 1 — Phase 2 — Pond Model Refinement

---

## Goal

Surface the new Phase 1 columns on the Django `Pond` model and add the class methods the rest of the arc (admin, serializers, views) will lean on. Pure Python — **no SQL touched**.

After Phase 2:
- `Pond` model declares `status`, `created_at`, `updated_at`, `created_by`, `updated_by`.
- `status` has `choices=` matching D1's 5-state enum — admin renders a dropdown automatically (no custom widget needed).
- Class methods `is_active()`, `get_active_cycle()`, `get_latest_cycle()` exposed for serializer + view consumers.
- Cross-module quick audit logs whether any `Pond.name` slip exists comparable to the `auth/me` `.code` vs `.name` bug we fixed in project_mgmt Phase 6d.

---

## Target shape

```python
class Pond(models.Model):
    """
    Individual ponds/tanks within a project.
    Maps to existing 'ponds' table.
    """

    STATUS_CHOICES = [
        ('active',         'Active'),
        ('draining',       'Draining'),
        ('cleaning',       'Cleaning'),
        ('maintenance',    'Maintenance'),
        ('decommissioned', 'Decommissioned'),
    ]

    pond_id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column='pond_id')
    project     = models.ForeignKey('module_project.Project', on_delete=models.CASCADE, db_column='project_id', related_name='ponds')
    name        = models.CharField(max_length=255, db_column='name')
    description = models.TextField(null=True, blank=True, db_column='description')
    metadata    = models.JSONField(null=True, blank=True, db_column='metadata', help_text='Pond metadata (company, GPS, biomass, etc.)')

    status      = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        db_column='status',
        help_text='Operational state. CHECK constraint chk_ponds_status enforces this enum at the DB level.',
    )

    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
    created_by = models.ForeignKey(
        'module_user.User', null=True, blank=True,
        on_delete=models.SET_NULL, db_column='created_by', related_name='+',
    )
    updated_by = models.ForeignKey(
        'module_user.User', null=True, blank=True,
        on_delete=models.SET_NULL, db_column='updated_by', related_name='+',
    )

    class Meta:
        db_table = 'ponds'
        managed = False
        verbose_name = 'Pond'
        verbose_name_plural = 'Ponds'
        ordering = ['name']

    def __str__(self):
        return self.name

    # ── Class methods ───────────────────────────────

    def is_active(self) -> bool:
        """True iff `status == 'active'`. The other 4 states are all
        non-active operationally, even if salvageable."""
        return self.status == 'active'

    def get_active_cycle(self):
        """Return the pond's ongoing Cycle (`status='ongoing'`) or None.
        Uses the existing related_name 'cycles' (Cycle.pond FK)."""
        return self.cycles.filter(status='ongoing').first()

    def get_latest_cycle(self):
        """Most recent Cycle on this pond by start_date, regardless of
        status. Returns None when the pond has never had a cycle."""
        return self.cycles.order_by('-start_date').first()
```

---

## Cross-module audit (quick)

Grep targets — looking for any place that compares against `pond.name` as if it were an identifier:

- `grep -rn "pond.name\|pond\.name" backend/ frontend/src/` (display use OK; comparison/lookup is the smell)
- `grep -rn "\.name ==" backend/module_*/` (any equality check against `.name` on pond/cycle/treatment)
- `grep -rn "\"name\":" backend/module_pond/serializers.py backend/module_pond/views.py` (response shapes — confirm `pond_id` is exposed alongside name)

Findings get noted in the checklist; fixes (if any) land as small follow-up edits inside this phase.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `module_pond/models.py` — `Pond.STATUS_CHOICES` | 5-tuple class attribute matching D1. | done |
| 2 | [x] | `module_pond/models.py` — `Pond.status` field | `CharField(choices=STATUS_CHOICES, default='active', ...)`. | done |
| 3 | [x] | `module_pond/models.py` — audit cols | `created_at` / `updated_at` / `created_by` / `updated_by` added (FK SET_NULL related_name='+'). | done |
| 4 | [x] | `module_pond/models.py` — class methods | Added `is_active`, `get_active_cycle`, `get_latest_cycle`. | done |
| 5 | [x] | `module_pond/models.py` — docstring | Class docstring lists the new fields. | done |
| 6 | [x] | Verification — `manage.py check` | Exit 0 (only pre-existing staticfiles.W004). | ✅ |
| 7 | [x] | Verification — shell smoke | After applying Phase 1 migration to dev DB: `Crab Tank A` reports `status='active'`, `created_at` + `updated_at` populated, `is_active()=True`, `active_cycle = latest_cycle = "Crab Tank A - Cycle 2025-06-01"`. Status counter: `{'active': 16}` across 16 ponds. | ✅ |
| 8 | [x] | Audit — cross-module `pond.name` slips | **No slips found.** All `pond_name`/`pondName` references in BE+FE are display labels (UI captions, WebSocket alert payloads). Pond serializers expose both `pond_id` (UUID) and `name` so consumers use the right one. The one filter pattern (`data_simulator.py:292`) is on `profile_type.name`, not Pond. | grep clean |

---

## Verification Block — after item 5

```bash
cd backend && source venv/bin/activate

# 1. Django check
python manage.py check

# 2. Shell smoke
python manage.py shell <<'PY'
from module_pond.models import Pond

p = Pond.objects.first()
print(f"pond: {p.name}  status={p.status!r}  created_at={p.created_at}  updated_at={p.updated_at}")
print(f"  is_active():       {p.is_active()}")
print(f"  active_cycle:      {p.get_active_cycle()}")
print(f"  latest_cycle:      {p.get_latest_cycle()}")

# Distribution of statuses
from collections import Counter
print(f"\nstatus counts: {Counter(Pond.objects.values_list('status', flat=True))}")
PY
```

Expected:
- `p.status == 'active'` for all rows (seed default).
- `is_active()` returns True.
- `get_active_cycle()` returns the row's ongoing Cycle if any (Demo ponds with running cycles), else None.
- `get_latest_cycle()` returns the most recent Cycle (any status).
- Status counter: `{'active': N}` where N is total pond count.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `STATUS_CHOICES` mismatches the DB CHECK constraint added in Phase 1 | Both list the same 5 codes verbatim. Mistype would be caught by `manage.py check` (no error) but would surface on first insert with the wrong value. Acceptable. |
| `auto_now_add` / `auto_now` only fire when the row goes through Django's ORM save. Since the table is `managed = False` and rows can be created via direct SQL, the timestamp behaviour relies on the DB defaults (`now()`) — Phase 1 set those. | The Phase 1 SQL added `DEFAULT now()` for both timestamps; Django's `auto_now*` adds belt-and-braces but isn't required. |
| FK to `module_user.User` could fail import if the module loads out of order | Using the string form `'module_user.User'` avoids the import-order issue (Django resolves lazily). Already the pattern used elsewhere. |
| Any consumer reading `pond.created_at` before Phase 1 ran would have got AttributeError | n/a — this is the *first* phase that surfaces those fields on the model. No prior consumer exists. |

---

## Out of scope for Phase 2

| Item | Where |
|---|---|
| Admin upgrades (Unfold + list_filter + edit_link + JSON widgets) | Phase 4 |
| Serializer/View updates | Phase 5 + 6 |
| Cycle / CycleDailyHealth / CycleStageMetric model refinements | Phase 3 |
| Seed data adjustments | Phase 7 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `Pond` model has `status` with `STATUS_CHOICES` matching D1 |
| [x] | `Pond` model has 4 audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`) |
| [x] | `Pond` model has 3 class methods (`is_active`, `get_active_cycle`, `get_latest_cycle`) |
| [x] | `manage.py check` exits 0 |
| [x] | Shell smoke: methods return correct types; all 16 seed ponds have status `'active'` |
| [x] | Cross-module audit performed; no slips found (logged above in item 8) |

---

## Files Touched in Phase 2

| File | What changed |
|---|---|
| `backend/module_pond/models.py` | Added `STATUS_CHOICES`, `status`, `created_at`, `updated_at`, `created_by`, `updated_by` fields on `Pond`. Added class methods `is_active`, `get_active_cycle`, `get_latest_cycle`. Updated docstring. |

---

*Last updated: 2026-05-23*
