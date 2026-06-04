# Profile Types — ERD Finalization

---

## Current State

### profile_types
| Column | Type | Notes |
|--------|------|-------|
| profile_type_id | UUID (PK) | `gen_random_uuid()` |
| name | VARCHAR(100) | `'shrimp'`, `'fish'`, `'crab_hatchery'`, `'treatment'` |
| description | TEXT | |
| default_parameters | JSONB | ⚠️ Not used by app — frontend hardcodes |
| parameter_priority | JSONB | ⚠️ Not used by app — frontend hardcodes |
| stage_config | JSONB | ✅ Used — Historical page stage timeline |
| key_parameter_indicators | TEXT[] | ⚠️ Seed data mixed sensor params AND growth params — needs separation |

---

## Refined Schema (1 Table)

### profile_types

| Column | Type | Notes |
|--------|------|-------|
| profile_type_id | UUID (PK) | |
| code | VARCHAR(50) | **NEW** — Unique. Machine identifier. e.g., `'shrimp'`, `'fish'`, `'crab_hatchery'`, `'treatment'` |
| name | VARCHAR(100) | Human-friendly display name. e.g., `'Shrimp Farm'`, `'Fish Farm'` |
| description | TEXT | |
| stage_config | JSONB | Growth stage definitions (template for cycles) |
| key_parameter_indicators | TEXT[] | Key **sensor** parameters for Overview page. Codes from `parameter_types` |
| key_growth_indicators | TEXT[] | **NEW** — Key **growth** metrics for Historical page. Codes from `growth_indicators` |
| created_at | TIMESTAMP | NEW |
| created_by | UUID (FK → users) | NEW |
| updated_at | TIMESTAMP | NEW |
| updated_by | UUID (FK → users) | NEW |

**Removed:** `default_parameters`, `parameter_priority` — per Satish. Not used by app.

**Added:** `key_growth_indicators`, audit columns.

**The two indicator columns explained:**

| Column | Source table | Used on | Example (shrimp) |
|--------|------------|---------|-------------------|
| `key_parameter_indicators` | `parameter_types` | Overview page — pond tooltip "Key Parameters" | `["temperature", "ph", "salinity", "ammonia", "nitrite"]` |
| `key_growth_indicators` | `growth_indicators` | Historical page — Key Indicator Cards per stage | `["body_weight", "daily_gain", "fcr", "mortality_rate"]` |

**Example per profile:**

```
shrimp:
  key_parameter_indicators:        ["temperature", "ph", "salinity", "ammonia", "nitrite"]
  key_growth_indicators: ["body_weight", "daily_gain", "fcr", "mortality_rate"]

crab_hatchery:
  key_parameter_indicators:        ["temperature", "ph", "ammonia"]
  key_growth_indicators: ["calcium", "water_quality_index", "stress_index", "survival_proxy"]

fish:
  key_parameter_indicators:        ["dissolved_oxygen", "ammonia", "temperature", "ph", "nitrite", "nitrate"]
  key_growth_indicators: ["disease_risk_index", "length_gained", "feed_conversion_ratio", "condition_factor"]

treatment:
  key_parameter_indicators:        ["ammonia", "nitrite", "total_bacteria_count"]
  key_growth_indicators: []  (no growth cycles for treatment facilities)
```

**`stage_config` JSONB shape (unchanged):**

```json
// shrimp profile
[
  { "name": "Post-Larvae Stocking", "startDay": 1, "endDay": 10 },
  { "name": "Early Growth Monitoring", "startDay": 11, "endDay": 40 },
  { "name": "Sub-Adult Development", "startDay": 41, "endDay": 70 },
  { "name": "Harvest Ready", "startDay": 71, "endDay": 90 }
]
```

---

## Use Case Mapping

From the use case diagram (System Administrator → View Profile Type → Add/Modify Profile Type):

| Use Case | Table/Column |
|----------|-------------|
| Add/Modify name | `profile_types.name` |
| Add/Modify description | `profile_types.description` |
| Add/Modify stage config | `profile_types.stage_config` (JSONB) |
| Add/Modify key indicators | `profile_types.key_parameter_indicators` (TEXT[] — sensor params) |
| Add/Modify key indicators | `profile_types.key_growth_indicators` (TEXT[] — growth metrics) |

> Note: The use case diagram shows "Add/Modify key indicators" as one action. In practice this is two fields — admin picks sensor parameters and growth metrics separately.

---

## Relationships

```
profile_types (1) ──→ (N) projects (a project has one profile type)

profile_types.key_parameter_indicators TEXT[] → references parameter_types.name (sensor params)
profile_types.key_growth_indicators TEXT[] → references growth_indicators.code (growth metrics)
```

---

## Discussion Points

### Should `stage_config` be a separate table instead of JSONB?

**Keep as JSONB (recommended):** `stage_config` is a template — it defines the *default* stage structure for a profile type. It's read-only config, not transactional data. JSONB is fine here because:
- Small, bounded data (typically 3-5 stages per profile)
- Rarely changes
- Always read as a whole (never queried by individual stage)

### Should `key_parameter_indicators` / `key_growth_indicators` be junction tables?

**Keep as TEXT[] (recommended):** Small config lists (3-6 items each). The admin UI can validate codes against `parameter_types` and `growth_indicators` at the application level. Junction tables add complexity for no real gain here.

---

*Last updated: April 16, 2026*
