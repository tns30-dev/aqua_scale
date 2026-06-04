# Profile Types — Class Diagram

---

## Current State (what exists)

- `ProfileType` model — `managed=False`, has `default_parameters` and `parameter_priority` (to be removed)
- No `code` column, no `key_growth_indicators`
- Only method: `__str__()`

---

## Refined Class Diagram (1 class)

### ProfileType

```
┌──────────────────────────────────────────────┐
│               ProfileType                    │
├──────────────────────────────────────────────┤
│ - profile_type_id: UUID                      │
│ - code: String                               │
│ - name: String                               │
│ - description: String                        │
│ - stage_config: JSONB                        │
│ - key_parameter_indicators: String[]         │
│ - key_growth_indicators: String[]            │
│ - created_at: Timestamp                      │
│ - created_by: UUID                           │
│ - updated_at: Timestamp                      │
│ - updated_by: UUID                           │
├──────────────────────────────────────────────┤
│ + get_stages(): List<StageConfig>            │
│ + get_stage_by_day(day_number: int): StageConfig│
│ + get_key_parameters(): List<String>         │
│ + get_key_growth_indicators(): List<String>  │
│ + get_cycle_length(): int                    │
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_stages()` — parses `stage_config` JSONB, returns list of stage objects `{name, startDay, endDay}`
- `get_stage_by_day(day_number)` — given a day number, returns which stage it falls in (used by Historical page to overlay stages on the cycle timeline)
- `get_key_parameters()` — returns the `key_parameter_indicators` array (sensor params for Overview page)
- `get_key_growth_indicators()` — returns the `key_growth_indicators` array (growth metrics for Historical page)
- `get_cycle_length()` — returns the `endDay` of the last stage (total cycle length in days)

---

## Relationships

```
ProfileType "1" ──── "*" Project        : template for  (Association)
User "1" ──────────── "*" ProfileType   : creates       (Association — created_by/updated_by)
```

### Why Association (not Aggregation or Composition)?

| Relationship | Type | Why |
|---|---|---|
| ProfileType → Project | **Association** | ProfileType is a template/reference. Projects reference it but ProfileType doesn't "own" projects. Deleting a profile type shouldn't cascade-delete all its projects — that would be destructive. The FK should be RESTRICT. |
| User → ProfileType | **Association** | Just an audit trail (who created/updated). No ownership. |

---

## Notes

- `default_parameters` and `parameter_priority` are **removed** (per Satish — not used by app)
- `key_indicators` is **split** into `key_parameter_indicators` (sensor params) and `key_growth_indicators` (growth metrics)
- `code` is **added** as unique machine identifier (e.g., `'shrimp'`), `name` becomes display-only (e.g., `'Shrimp Farm'`)
- `stage_config` stays as JSONB — small, bounded template data, always read as a whole

---

*Last updated: April 20, 2026*
