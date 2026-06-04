# Part 1 — Phase 5 — Serializers

---

## Goal

Surface the new Phase 1-3 fields on the existing serializers and add the missing serializers for `Treatment` + `PondTreatment` so Phase 6 can wire up read-only endpoints.

After Phase 5:
- `PondSerializer` exposes `status`, `is_active`, `created_at`, `updated_at`.
- `CycleSerializer` exposes `updated_at`, `duration_days`, `is_ongoing`.
- `CycleDailyHealthSerializer` exposes `updated_at`, `is_alert`.
- `CycleStageMetricSerializer` exposes `created_at`, `updated_at`, `parameter_codes`.
- **New** `TreatmentSerializer` + `PondTreatmentSerializer`.
- `PondDetailSerializer` adds an `active_treatments` list (current treatments on the pond — `ended_at` is NULL).

---

## Convention (per D4)

Existing module_pond serializers use snake_case (DRF defaults). The single outlier — `CycleDetailSerializer.get_daily_health` hand-emits camelCase (`dayNumber`, `healthStatus`, `alertCount`) — has been in production; FE consumers depend on it. **We leave that outlier alone** to avoid a regression. New fields + new serializers stay snake_case. The FE handles conversion via per-endpoint mappers in `api.service.ts` (the pattern established in project-mgmt Phase 7).

---

## Per-serializer work

### `PondSerializer` — add `status` + audit + `is_active`

```python
status     = serializers.CharField(read_only=True)
is_active  = serializers.SerializerMethodField()
created_at = serializers.DateTimeField(read_only=True)
updated_at = serializers.DateTimeField(read_only=True)

def get_is_active(self, obj):
    return obj.is_active()
```

Audit FK fields (`created_by`, `updated_by`) are intentionally **not** exposed — UUIDs of internal users aren't useful to the FE.

### `CycleSerializer` — add `updated_at` + `duration_days` + `is_ongoing`

```python
updated_at    = serializers.DateTimeField(read_only=True)
duration_days = serializers.SerializerMethodField()
is_ongoing    = serializers.SerializerMethodField()

def get_duration_days(self, obj):
    return obj.duration_days()

def get_is_ongoing(self, obj):
    return obj.is_ongoing()
```

`status` already exposed, so `is_completed` / `is_terminated` can be derived client-side. Only `is_ongoing` is surfaced as a method to mirror `Pond.is_active`'s shape.

### `CycleDailyHealthSerializer` — add `updated_at` + `is_alert`

```python
updated_at = serializers.DateTimeField(read_only=True)
is_alert   = serializers.SerializerMethodField()

def get_is_alert(self, obj):
    return obj.is_alert()
```

### `CycleStageMetricSerializer` — add audit cols + `parameter_codes`

```python
created_at      = serializers.DateTimeField(read_only=True)
updated_at      = serializers.DateTimeField(read_only=True)
parameter_codes = serializers.SerializerMethodField()

def get_parameter_codes(self, obj):
    return obj.get_parameter_codes()
```

The `metrics` JSONB still rides through as a free-form dict — FE consumers can iterate `parameter_codes` and look up each one.

### NEW — `TreatmentSerializer`

```python
class TreatmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Treatment
        fields = [
            'treatment_id',
            'code',
            'name',
            'description',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['treatment_id', 'created_at', 'updated_at']
```

### NEW — `PondTreatmentSerializer`

```python
class PondTreatmentSerializer(serializers.ModelSerializer):
    treatment_name        = serializers.CharField(source='treatment.name', read_only=True)
    treatment_code        = serializers.CharField(source='treatment.code', read_only=True)
    treatment_description = serializers.CharField(source='treatment.description', read_only=True, allow_null=True)
    is_active             = serializers.SerializerMethodField()

    class Meta:
        model = PondTreatment
        fields = [
            'pond_treatment_id',
            'pond',
            'treatment',
            'treatment_name',
            'treatment_code',
            'treatment_description',
            'started_at',
            'ended_at',
            'notes',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'pond_treatment_id',
            'created_at',
            'updated_at',
            'is_active',
        ]

    def get_is_active(self, obj):
        return obj.is_active
```

`is_active` on `PondTreatment` is a property (derived from `started_at <= today < ended_at`, or `ended_at IS NULL`). The SerializerMethodField surfaces it.

### `PondDetailSerializer` — add `active_treatments`

```python
class PondDetailSerializer(PondSerializer):
    current_cycle      = serializers.SerializerMethodField()
    sensor_count       = serializers.SerializerMethodField()
    active_treatments  = serializers.SerializerMethodField()    # NEW

    class Meta(PondSerializer.Meta):
        fields = PondSerializer.Meta.fields + [
            'current_cycle',
            'sensor_count',
            'active_treatments',
        ]

    def get_active_treatments(self, obj):
        # "Active" = treatment row whose ended_at is NULL (open-ended).
        active = obj.treatments.filter(ended_at__isnull=True).select_related('treatment')
        return PondTreatmentSerializer(active, many=True).data
```

`obj.treatments` is the reverse FK from `PondTreatment.pond` (related_name='treatments' — need to verify on the model).

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Imports | Extended `from .models import` to include `Treatment`, `PondTreatment`. | done |
| 2 | [x] | `PondSerializer` | Added `status`, `is_active` (method), `created_at`, `updated_at`. | done |
| 3 | [x] | `CycleSerializer` | Added `updated_at`, `duration_days`, `is_ongoing` (both methods). | done |
| 4 | [x] | `CycleDailyHealthSerializer` | Added `updated_at`, `is_alert` (method). | done |
| 5 | [x] | `CycleStageMetricSerializer` | Added `created_at`, `updated_at`, `parameter_codes` (method). | done |
| 6 | [x] | `TreatmentSerializer` (new) | Full ModelSerializer with all fields. | done |
| 7 | [x] | `PondTreatmentSerializer` (new) | Full ModelSerializer + `treatment_name`/`treatment_code`/`treatment_description` derived + `is_active` method. | done |
| 8 | [x] | `PondDetailSerializer` | Added `active_treatments` SerializerMethodField (filters PondTreatment by `ended_at__isnull=True`). | done |
| 9 | [x] | Verify Pond model's reverse name to PondTreatment | Confirmed `PondTreatment.pond` uses `related_name='treatments'` → `pond.treatments` works. | done |
| 10 | [x] | Side-fix — `get_sensor_count` was broken | `obj.sensors.count()` referenced the dropped `sensors` table. Changed to `obj.project_sensors.count()` (live FK from `ProjectSensor.pond`). Inline comment explains. | done |
| 11 | [x] | Verification — `manage.py check` | Exit 0 (only pre-existing staticfiles.W004). | ✅ |
| 12 | [x] | Verification — shell smoke | All 7 serializers render cleanly. Cycle `Pond A 2025-07-01` → `duration_days=90, is_ongoing=false`. DailyHealth → `is_alert=true`. StageMetric → 4-key `parameter_codes` + full `metrics` JSONB. Treatment 'BioBloc' returned. PondTreatment count=0 (Phase 7 seeds). | ✅ |

---

## Verification Block — after item 8

```bash
cd backend && source venv/bin/activate
python manage.py check

python manage.py shell <<'PY'
from module_pond.models import Pond, Cycle, CycleDailyHealth, CycleStageMetric, Treatment, PondTreatment
from module_pond.serializers import (
    PondSerializer, PondDetailSerializer,
    CycleSerializer, CycleDailyHealthSerializer, CycleStageMetricSerializer,
    TreatmentSerializer, PondTreatmentSerializer,
)
import json

def show(label, data):
    print(f"\n=== {label} ===")
    print(json.dumps(data, default=str, indent=2)[:600])

pond = Pond.objects.first()
show("PondSerializer", PondSerializer(pond).data)
show("PondDetailSerializer", PondDetailSerializer(pond).data)

cycle = Cycle.objects.first()
show("CycleSerializer", CycleSerializer(cycle).data)

h = CycleDailyHealth.objects.first()
if h:
    show("CycleDailyHealthSerializer", CycleDailyHealthSerializer(h).data)

m = CycleStageMetric.objects.first()
if m:
    show("CycleStageMetricSerializer", CycleStageMetricSerializer(m).data)

t = Treatment.objects.first()
if t:
    show("TreatmentSerializer", TreatmentSerializer(t).data)
else:
    print("\n(no Treatment rows in seed yet — Phase 7 seeds)")

pt = PondTreatment.objects.first()
if pt:
    show("PondTreatmentSerializer", PondTreatmentSerializer(pt).data)
else:
    print("\n(no PondTreatment rows in seed yet — Phase 7 seeds)")
PY
```

Expected:
- Pond → status='active', is_active=True, created_at/updated_at present.
- Cycle → duration_days int, is_ongoing bool matching status.
- DailyHealth → is_alert bool matches alert_count > 0.
- StageMetric → parameter_codes list of strings.
- Treatment + PondTreatment → may be empty (seeded in Phase 7); structures still parseable when empty.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `PondTreatment.pond` `related_name` mismatch — step 8 assumes `obj.treatments` | Item 9 verifies. If the model uses a different name (e.g., `pond_treatments`), update both the model + the serializer call. |
| Treatment + PondTreatment tables are empty in seed | Shell smoke handles gracefully (`if t:` guard); Phase 7 will seed sample rows. |
| Adding fields to existing serializers might break FE consumers expecting specific keys | All additions; nothing removed. Existing keys remain. Adding fields is backward-compatible. |
| `PondTreatmentSerializer.is_active` returns a property — risk of accidentally serializing a bound method | Wrapped in SerializerMethodField + explicit `obj.is_active` access. Verified by smoke. |
| `CycleDetailSerializer.get_daily_health` outlier stays camelCase | Documented as intentional. FE consumers of that endpoint continue to work. |

---

## Out of scope

| Item | Where |
|---|---|
| Views + URLs to surface these endpoints | Phase 6 |
| Seed Treatment + PondTreatment catalogue rows | Phase 7 |
| FE-side mapper updates | Part 2 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `PondSerializer` exposes `status`, `is_active`, `created_at`, `updated_at` |
| [x] | `CycleSerializer` exposes `updated_at`, `duration_days`, `is_ongoing` |
| [x] | `CycleDailyHealthSerializer` exposes `updated_at`, `is_alert` |
| [x] | `CycleStageMetricSerializer` exposes `created_at`, `updated_at`, `parameter_codes` |
| [x] | `TreatmentSerializer` + `PondTreatmentSerializer` exist with the field lists above |
| [x] | `PondDetailSerializer` exposes `active_treatments` |
| [x] | `manage.py check` exits 0 |
| [x] | Shell smoke renders every serializer cleanly |

---

## Files Touched in Phase 5

| File | What changed |
|---|---|
| `backend/module_pond/serializers.py` | Extended imports. Added new fields + method handlers to `PondSerializer`, `CycleSerializer`, `CycleDailyHealthSerializer`, `CycleStageMetricSerializer`. Added `TreatmentSerializer` + `PondTreatmentSerializer`. Extended `PondDetailSerializer` with `active_treatments`. |

---

*Last updated: 2026-05-23*
