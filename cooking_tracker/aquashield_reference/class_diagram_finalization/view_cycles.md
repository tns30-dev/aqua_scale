# Growth Cycles — Class Diagram

---

## Current State (what exists)

- `Cycle` model — exists, has `current_day` property
- `CycleDailyHealth` model — exists, no custom methods
- `CycleStageMetric` model — exists, has `parameter_type` as loose string (to be changed to JSONB `metrics`)

---

## Refined Class Diagram (3 classes)

### 1. Cycle

```
┌──────────────────────────────────────────────┐
│                  Cycle                       │
├──────────────────────────────────────────────┤
│ - cycle_id: UUID                             │
│ - pond_id: UUID                              │
│ - start_date: Date                           │
│ - end_date: Date                             │
│ - status: String                             │
│ - created_at: Timestamp                      │
│ - created_by: UUID                           │
│ - updated_at: Timestamp                      │
│ - updated_by: UUID                           │
├──────────────────────────────────────────────┤
│ + current_day(): int                         │
│ + is_ongoing(): Boolean                      │
│ + get_daily_health(): List<CycleDailyHealth> │
│ + get_health_for_day(day: int): CycleDailyHealth│
│ + get_stage_metrics(): List<CycleStageMetric>│
│ + get_metrics_for_stage(stage_name: String): CycleStageMetric│
│ + get_pond(): Pond                           │
│ + complete(): void                           │
│ + terminate(): void                          │
└──────────────────────────────────────────────┘
```

**Methods:**
- `current_day()` — already exists as property. Calculates days since `start_date`
- `is_ongoing()` — checks if `status == 'ongoing'`
- `get_daily_health()` — returns all daily health records for this cycle
- `get_health_for_day(day)` — returns health record for a specific day number
- `get_stage_metrics()` — returns all stage metrics for this cycle
- `get_metrics_for_stage(stage_name)` — returns metrics for a specific stage
- `get_pond()` — returns the pond this cycle belongs to
- `complete()` — sets `status = 'completed'`, `end_date = today`
- `terminate()` — sets `status = 'terminated'`, `end_date = today`

---

### 2. CycleDailyHealth

```
┌──────────────────────────────────────────────┐
│           CycleDailyHealth                   │
├──────────────────────────────────────────────┤
│ - health_id: UUID                            │
│ - cycle_id: UUID                             │
│ - day_number: Integer                        │
│ - date: Date                                 │
│ - health_status: String                      │
│ - alert_count: Integer                       │
│ - created_at: Timestamp                      │
├──────────────────────────────────────────────┤
│ + is_healthy(): Boolean                      │
│ + has_alerts(): Boolean                      │
│ + get_cycle(): Cycle                         │
└──────────────────────────────────────────────┘
```

**Methods:**
- `is_healthy()` — returns `true` if health_status is `'excellent'` or `'good'`
- `has_alerts()` — returns `true` if `alert_count > 0`
- `get_cycle()` — returns the parent cycle

---

### 3. CycleStageMetric

```
┌──────────────────────────────────────────────┐
│          CycleStageMetric                    │
├──────────────────────────────────────────────┤
│ - metric_id: UUID                            │
│ - cycle_id: UUID                             │
│ - stage_name: String                         │
│ - metrics: JSONB                             │
│ - calculated_at: Timestamp                   │
├──────────────────────────────────────────────┤
│ + get_indicator_value(code: String): Dict    │
│ + get_all_indicators(): Dict                 │
│ + get_cycle(): Cycle                         │
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_indicator_value(code)` — returns `{avg, min, max}` for a specific growth indicator code from the `metrics` JSONB (e.g., `get_indicator_value('body_weight')` → `{avg: 0.8, min: 0.5, max: 1.2}`)
- `get_all_indicators()` — returns the full `metrics` JSONB dict
- `get_cycle()` — returns the parent cycle

**Key change from current:** `parameter_type` + `avg_value` + `min_value` + `max_value` columns → single `metrics` JSONB. One row per stage instead of one row per stage×parameter.

---

## Relationships

```
Pond "1" ◆──── "*" Cycle                      : runs          (Composition)
Cycle "1" ◆──── "*" CycleDailyHealth           : has           (Composition)
Cycle "1" ◆──── "*" CycleStageMetric           : has           (Composition)
```

### Why Composition for all?

| Relationship | Type | Why |
|---|---|---|
| Pond → Cycle | **Composition** ◆ | A cycle belongs to a pond. Delete pond = cycles gone (CASCADE). A cycle is meaningless without its pond. |
| Cycle → CycleDailyHealth | **Composition** ◆ | Daily health records are part of a cycle. Delete cycle = health records gone. They have no meaning outside the cycle. |
| Cycle → CycleStageMetric | **Composition** ◆ | Stage metrics are calculated for a cycle. Delete cycle = metrics gone. No independent existence. |

> All three relationships are Composition because the child classes have **no meaning** outside their parent. This is a clean parent-child ownership chain: Pond → Cycle → (DailyHealth, StageMetrics).

---

## Notes

- `Cycle` — added `created_by`, `updated_at`, `updated_by` (audit trail)
- `CycleStageMetric` — **restructured**: replaced 4 columns (`parameter_type`, `avg_value`, `min_value`, `max_value`) with single `metrics` JSONB. Keys reference `growth_indicators.code`
- `CycleDailyHealth` — unchanged from current
- Stage definitions (names, day ranges) come from `ProfileType.stage_config`, not stored per-cycle

---

*Last updated: April 20, 2026*