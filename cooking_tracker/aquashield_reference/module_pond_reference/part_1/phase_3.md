# Part 1 — Phase 3 — Cycle / Daily Health / Stage Metric Refinement

---

## Goal

Surface the Phase 1 audit columns on `Cycle`, `CycleDailyHealth`, `CycleStageMetric`, and add the class methods consumers will need. Pure Python — no SQL.

After Phase 3:
- All three models declare the audit columns Phase 1 added to the DB.
- `Cycle` gains predicates (`is_ongoing` / `is_completed` / `is_terminated`), `duration_days()`, `get_profile_type()`, `get_current_stage()`.
- `CycleDailyHealth` gains `is_alert()`.
- `CycleStageMetric` gains `get_parameter_metric()` + `get_parameter_codes()` for typed access to the JSONB.

---

## What's NOT in scope (already done in earlier arcs)

- `Cycle.STATUS_CHOICES` + `choices=` on the field — already present.
- `CycleDailyHealth.HEALTH_CHOICES` + `choices=` on the field — already present.
- Tightening the underlying CHECK constraints — DB already has them from the seed.

So Phase 3 is **narrower than overall.md sketched**: only audit columns + class methods.

---

## Target shape (the additions only)

### `Cycle` — add 3 audit cols + 5 class methods

```python
updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
created_by = models.ForeignKey(
    'module_user.User', null=True, blank=True,
    on_delete=models.SET_NULL, db_column='created_by', related_name='+',
)
updated_by = models.ForeignKey(
    'module_user.User', null=True, blank=True,
    on_delete=models.SET_NULL, db_column='updated_by', related_name='+',
)

# ── Class methods ─────────────────────────────────

def is_ongoing(self) -> bool:
    return self.status == 'ongoing'

def is_completed(self) -> bool:
    return self.status == 'completed'

def is_terminated(self) -> bool:
    return self.status == 'terminated'

def duration_days(self) -> int:
    """Cycle length in days. For completed cycles uses end_date;
    for ongoing cycles uses today (matches current_day semantics)."""
    from datetime import date
    end = self.end_date if self.end_date else date.today()
    return (end - self.start_date).days + 1

def get_profile_type(self):
    """Convenience: pond → project → profile_type. None if any link is missing."""
    if self.pond and self.pond.project:
        return self.pond.project.profile_type
    return None

def get_current_stage(self):
    """Return the stage dict that today's day_number falls into.
    Delegates to ProfileType.get_stage_by_day. None if no profile or no match."""
    profile = self.get_profile_type()
    if not profile:
        return None
    return profile.get_stage_by_day(self.current_day)
```

### `CycleDailyHealth` — add 3 audit cols + 1 predicate

```python
updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
created_by = models.ForeignKey(
    'module_user.User', null=True, blank=True,
    on_delete=models.SET_NULL, db_column='created_by', related_name='+',
)
updated_by = models.ForeignKey(
    'module_user.User', null=True, blank=True,
    on_delete=models.SET_NULL, db_column='updated_by', related_name='+',
)

def is_alert(self) -> bool:
    """True iff this day recorded one or more alerts."""
    return self.alert_count > 0
```

### `CycleStageMetric` — add 4 audit cols + 2 JSONB helpers

```python
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

def get_parameter_codes(self) -> list[str]:
    """Return the list of parameter codes present in this metric snapshot."""
    return list((self.metrics or {}).keys())

def get_parameter_metric(self, parameter_code: str) -> dict | None:
    """Return {avg, min, max} for a specific parameter, or None if not recorded."""
    return (self.metrics or {}).get(parameter_code)
```

`calculated_at` is preserved (semantic: "when this stage's metric was last recomputed"). `updated_at` is "when the row was last touched at all". They diverge if we ever edit metadata without recomputing.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `Cycle` — audit cols | `updated_at`, `created_by`, `updated_by` added. | done |
| 2 | [x] | `Cycle` — class methods | Added all 6: `is_ongoing`, `is_completed`, `is_terminated`, `duration_days`, `get_profile_type`, `get_current_stage`. | done |
| 3 | [x] | `CycleDailyHealth` — audit cols | `updated_at`, `created_by`, `updated_by` added. | done |
| 4 | [x] | `CycleDailyHealth` — `is_alert()` | Method present. | done |
| 5 | [x] | `CycleStageMetric` — audit cols | `created_at`, `updated_at`, `created_by`, `updated_by` added; `calculated_at` preserved. | done |
| 6 | [x] | `CycleStageMetric` — JSONB helpers | `get_parameter_codes`, `get_parameter_metric` added. | done |
| 7 | [x] | Verification — `manage.py check` | Exit 0 (only pre-existing staticfiles.W004). | ✅ |
| 8 | [x] | Verification — shell smoke | Cycle `Pond A - Cycle 2025-07-01` reports status=completed, duration=90 days, current_stage = "Harvest Ready"; DailyHealth `is_alert()=True` (alert_count=1); StageMetric returned 4 parameter codes incl. `'fcr'` with `{avg:2.25, max:2.5, min:2}`. All audit timestamps populated. | ✅ |

---

## Verification Block — after item 6

```bash
cd backend && source venv/bin/activate
python manage.py check

python manage.py shell <<'PY'
from module_pond.models import Cycle, CycleDailyHealth, CycleStageMetric

# 1. Cycle
c = Cycle.objects.first()
print("=== Cycle ===")
print(f"  {c}  status={c.status!r}")
print(f"  is_ongoing/completed/terminated: {c.is_ongoing()}/{c.is_completed()}/{c.is_terminated()}")
print(f"  duration_days={c.duration_days()}  current_day={c.current_day}")
profile = c.get_profile_type()
print(f"  profile: {profile.code if profile else None}")
print(f"  current_stage: {c.get_current_stage()}")
print(f"  updated_at: {c.updated_at}")

# 2. CycleDailyHealth
h = CycleDailyHealth.objects.first()
if h:
    print("\n=== CycleDailyHealth ===")
    print(f"  {h}  alert_count={h.alert_count}  is_alert()={h.is_alert()}")
    print(f"  updated_at: {h.updated_at}")
else:
    print("\n(no CycleDailyHealth rows in seed)")

# 3. CycleStageMetric
m = CycleStageMetric.objects.first()
if m:
    print("\n=== CycleStageMetric ===")
    print(f"  cycle={m.cycle}  stage={m.stage_name}")
    codes = m.get_parameter_codes()
    print(f"  parameter codes ({len(codes)}): {codes[:5]}{'...' if len(codes)>5 else ''}")
    if codes:
        print(f"  metric for {codes[0]!r}: {m.get_parameter_metric(codes[0])}")
    print(f"  calculated_at: {m.calculated_at}")
    print(f"  created_at: {m.created_at}")
    print(f"  updated_at: {m.updated_at}")
else:
    print("\n(no CycleStageMetric rows in seed)")
PY
```

Expected:
- Cycle predicates return mutually exclusive booleans matching `status`.
- `duration_days()` is a positive int.
- `get_profile_type()` returns the linked `ProfileType` instance.
- `get_current_stage()` returns a dict (or None for terminated/old cycles).
- DailyHealth `is_alert()` returns True iff `alert_count > 0`.
- StageMetric JSONB helpers return list-of-strings + dict-of-stats.
- All `updated_at` / `created_at` fields populated.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `Cycle.duration_days()` for `terminated` cycles with no `end_date` would use today | Acceptable — terminated-without-end is degenerate data. Caller can check `is_terminated()` first. |
| `get_current_stage()` for a completed/terminated cycle still uses today's day | Same caveat. `current_day` already handles end_date for non-ongoing cycles. |
| `get_parameter_metric()` returns None for unknown codes vs missing rows — caller can't distinguish | Acceptable for an MVP. If consumers need disambiguation later, add `has_parameter()`. |
| Adding `auto_now_add=True` on `CycleStageMetric.created_at` only fires through Django ORM saves. Existing rows have `now()` from the Phase 1 DEFAULT. New rows created via ORM also work. | Two-sided defaults match. |

---

## Out of scope for Phase 3

| Item | Where |
|---|---|
| Admin polish (Unfold, list filters, edit_link, JSON widgets) | Phase 4 |
| Serializer / view exposure | Phases 5 + 6 |
| Treatment / PondTreatment model changes | Phase 4 (admin inline) + Phase 5 (serializers) |
| Rich stage-name → stage-config mapping enforcement | Out of scope for this arc |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `Cycle` has 3 new audit fields + 6 new class methods |
| [x] | `CycleDailyHealth` has 3 new audit fields + `is_alert()` |
| [x] | `CycleStageMetric` has 4 new audit fields + 2 JSONB helpers |
| [x] | `manage.py check` exits 0 |
| [x] | Shell smoke exercises every new method cleanly |

---

## Files Touched in Phase 3

| File | What changed |
|---|---|
| `backend/module_pond/models.py` | Added audit fields + class methods on `Cycle` (3 cols, 6 methods), `CycleDailyHealth` (3 cols, 1 method), `CycleStageMetric` (4 cols, 2 methods). |

---

*Last updated: 2026-05-23*
