# Growth Cycles — ERD Finalization

---

## Section 1: Intelligence — How These 3 Tables Are Used

### Overview

All 3 tables are **actively used** and data is **fetched from the API** (not hardcoded in frontend). They power the **Historical Data Page** in the frontend.

```
API endpoints:
  GET /api/projects/{id}/cycles/    → list cycles for a project
  GET /api/cycles/{id}/details/     → cycle detail with daily health + stage metrics
```

---

### Table 1: `cycles` — ✅ Fully Active

**Business purpose:** Represents a production cycle for a pond (e.g., a shrimp batch from stocking to harvest).

**Backend:**
- Model: `module_project/models.py` (Cycle)
- Views: `CycleViewSet` with list, retrieve, and `details/` action
- Serializers: `CycleSerializer`, `CycleDetailSerializer`

**Frontend:**
- `HistoricalDataPage.tsx` — fetches cycles via `apiService.getProjectCycles()`
- `cycleStore.ts` (Zustand) — stores selected cycle state
- `HealthStatusOverview.tsx` — cycle navigation (prev/next cycle)

**Usage:** User selects a pond → frontend loads all cycles for that pond → user can navigate between cycles. The stage timeline (from `profile_types.stage_config`) is overlaid on the cycle to show which growth stage each day falls in.

---

### Table 2: `cycle_daily_health` — ✅ Fully Active

**Business purpose:** One record per day in a cycle. Shows daily health status as colored circles on a timeline.

**Backend:**
- Model: `CycleDailyHealth` — day_number, date, health_status, alert_count
- Returned as `dailyHealth` array in the cycle details API response

**Frontend:**
- `HealthStatusOverview.tsx` — renders colored circles per day:
  - excellent → green
  - good → light green
  - fair → yellow/orange
  - poor → red
  - future → gray
- Hover tooltip shows day number, date, status, alert count

**Data volume:** ~2,500 records across all cycles. Seeded with random weights: 30% excellent, 50% good, 15% fair, 5% poor.

---

### Table 3: `cycle_stage_metrics` — ✅ Active (but seeding is incomplete)

**Business purpose:** Aggregated growth performance metrics per stage. Shows Key Indicator Cards on the Historical page when user clicks a growth stage.

**Backend:**
- Model: `CycleStageMetric` — stage_name, parameter_type, avg_value, min_value, max_value
- Returned as `stageMetrics` nested object in cycle details API

**Frontend:**
- `HealthStatusOverview.tsx` — Key Indicator Cards (green cards showing current/min/max)
- Which indicators to show is driven by `profile_types.key_parameter_indicators` (but see correction below)
- Labels and units are **hardcoded in frontend** (body_weight → "Mean Body Weight (g)", etc.)

**Issue found:** Seed script imports `CycleStageMetric` and clears it during reset, but **never creates new records**. Data only exists from fixtures. Crab hatchery profile has no stage metrics data at all.

**Data shape:** Each stage × each parameter = 1 row. E.g., 4 stages × 4 parameters = 16 rows per cycle.

---

### Key Finding: Two Different "Indicators" Were Mixed Up

| | `profile_types.key_parameter_indicators` (current) | `cycle_stage_metrics.parameter_type` |
|---|---|---|
| **Intended purpose** | Key sensor parameters on Overview page (pond tooltip: Temperature, pH, Salinity) | Growth performance metrics on Historical page (Key Indicator Cards) |
| **Values** | `["temperature", "ph", "salinity"]` | `["body_weight", "daily_gain", "fcr", "mortality_rate"]` |
| **Data source** | Sensor readings → `parameter_types` table | Growth performance → no reference table exists |
| **Problem** | Seed data mixed both sensor params AND growth params into this column | `parameter_type` is a loose string — no FK, no reference table |

The frontend code in `HealthStatusOverview.tsx` uses `keyIndicators` to loop through `stageMetrics` — but the **actual intent** of `key_parameter_indicators` on `profile_types` is for the Overview page pond tooltip (sensor parameters). The seed data being messy made them overlap.

---

### Summary: Business Features

| Feature | Tables Used | Page |
|---------|------------|------|
| Cycle navigation (prev/next) | `cycles` | Historical |
| Day-by-day health timeline (colored circles) | `cycle_daily_health` | Historical |
| Growth stage timeline overlay | `profile_types.stage_config` (not a cycle table) | Historical |
| Key Indicator Cards (body_weight, fcr, etc.) | `cycle_stage_metrics` | Historical |
| Key Parameters tooltip (temperature, ph, etc.) | `profile_types.key_parameter_indicators` + sensor readings | Overview |

---

## Section 2: Refinement Proposals

### New Reference Table: `growth_indicators`

Similar to `parameter_types` (for sensor parameters), but for **growth performance metrics**.

| Column | Type | Notes |
|--------|------|-------|
| growth_indicator_id | UUID (PK) | |
| name | VARCHAR(100) | Human-readable. e.g., "Mean Body Weight" |
| code | VARCHAR(50) | Unique. e.g., `'body_weight'` |
| unit | VARCHAR(20) | e.g., `'g'`, `'g/day'`, `'%'` |
| data_type | VARCHAR(50) | `'float'` or `'integer'` |

**Seed data:**

| name | code | unit | data_type |
|------|------|------|-----------|
| Mean Body Weight | `body_weight` | g | float |
| Avg Daily Gain | `daily_gain` | g/day | float |
| Feed Conversion Ratio | `fcr` | | float |
| Mortality Rate | `mortality_rate` | % | float |
| Calcium | `calcium` | mg/L | float |
| Survival Proxy | `survival_proxy` | % | float |
| Stress Index | `stress_index` | /100 | float |
| Water Quality Index | `water_quality_index` | /100 | float |
| Disease Risk Index | `disease_risk_index` | /100 | float |
| Length Gained | `length_gained` | cm | float |
| Condition Factor | `condition_factor` | | float |

> This eliminates the hardcoded labels/units in the frontend. The API can return the name and unit from this table.

---

### Updated `profile_types`

| Column | Type | Notes |
|--------|------|-------|
| profile_type_id | UUID (PK) | |
| name | VARCHAR(100) | Unique |
| description | TEXT | |
| stage_config | JSONB | Growth stage definitions (template for cycles) |
| key_parameter_indicators | TEXT[] | Sensor parameters for Overview page. Codes from `parameter_types` |
| key_growth_indicators | TEXT[] | **NEW** — Growth metrics for Historical page. Codes from `growth_indicators` |
| created_at | TIMESTAMP | |
| created_by | UUID (FK → users) | |
| updated_at | TIMESTAMP | |
| updated_by | UUID (FK → users) | |

**Example data — shrimp profile:**

```
key_parameter_indicators:        ["temperature", "ph", "salinity", "ammonia", "nitrite"]
                        → from parameter_types → used on Overview page pond tooltip

key_growth_indicators: ["body_weight", "daily_gain", "fcr", "mortality_rate"]
                        → from growth_indicators → used on Historical page Key Indicator Cards
```

**Example data — crab_hatchery profile:**

```
key_parameter_indicators:        ["temperature", "ph", "ammonia"]
key_growth_indicators: ["calcium", "water_quality_index", "stress_index", "survival_proxy"]
```

**Example data — fish profile:**

```
key_parameter_indicators:        ["dissolved_oxygen", "ammonia", "temperature", "ph", "nitrite", "nitrate"]
key_growth_indicators: ["disease_risk_index", "length_gained", "feed_conversion_ratio", "condition_factor"]
```

> Now it's clear: `key_parameter_indicators` = sensor stuff, `key_growth_indicators` = growth performance stuff.

---

### Updated `cycle_stage_metrics`

Keep as a separate table — but collapse the 4 per-indicator columns into a single JSONB. One row per stage (instead of one row per stage × parameter).

| Column | Type | Notes |
|--------|------|-------|
| metric_id | UUID (PK) | |
| cycle_id | UUID (FK → cycles) | ON DELETE CASCADE |
| stage_name | VARCHAR(100) | Growth stage name (from profile_types.stage_config) |
| metrics | JSONB | All growth indicator values for this stage. Keys = `growth_indicators.code` |
| calculated_at | TIMESTAMP | |

**Constraint:** `UNIQUE(cycle_id, stage_name)` — one row per stage per cycle.

**`metrics` JSONB shape:**

```json
{
  "body_weight": { "avg": 0.8, "min": 0.5, "max": 1.2 },
  "daily_gain": { "avg": 0.03, "min": 0.02, "max": 0.04 },
  "fcr": { "avg": 2.0, "min": 1.8, "max": 2.2 },
  "mortality_rate": { "avg": 1.2, "min": 0.5, "max": 2.0 }
}
```

> Keys reference `growth_indicators.code`. Labels and units come from the `growth_indicators` table — no more frontend hardcoding.

**What changed from current:**

| Before | After |
|--------|-------|
| `growth_indicator_id` (FK) | Removed — indicator code is the JSONB key |
| `avg_value`, `min_value`, `max_value` (3 columns) | Merged into `metrics` JSONB |
| 1 row per stage × parameter (~16 rows/cycle) | 1 row per stage (~4 rows/cycle) |
| `calculated_at` per indicator | `calculated_at` per stage (all indicators in a stage calculated together) |

---

### Updated `cycles`

| Column | Type | Notes |
|--------|------|-------|
| cycle_id | UUID (PK) | |
| pond_id | UUID (FK → ponds) | ON DELETE CASCADE |
| start_date | DATE | |
| end_date | DATE | NULL = ongoing |
| status | VARCHAR(20) | `'ongoing'`, `'completed'`, `'terminated'` |
| created_at | TIMESTAMP | |
| created_by | UUID (FK → users) | NEW |
| updated_at | TIMESTAMP | NEW |
| updated_by | UUID (FK → users) | NEW |

---

### `cycle_daily_health` (unchanged)

| Column | Type | Notes |
|--------|------|-------|
| health_id | UUID (PK) | |
| cycle_id | UUID (FK → cycles) | ON DELETE CASCADE |
| day_number | INTEGER | 1-200, CHECK constraint |
| date | DATE | |
| health_status | VARCHAR(20) | `'excellent'`, `'good'`, `'fair'`, `'poor'`, `'future'` |
| alert_count | INTEGER | Default 0 |
| created_at | TIMESTAMP | |

---

## Relationships

```
growth_indicators (independent reference — like parameter_types but for growth metrics)

profile_types.key_parameter_indicators TEXT[] → references parameter_types.name (sensor params)
profile_types.key_growth_indicators TEXT[] → references growth_indicators.code (growth metrics)

cycles (1) ──→ (N) cycle_daily_health
cycles (1) ──→ (N) cycle_stage_metrics

cycle_stage_metrics.metrics JSONB keys → reference growth_indicators.code

Implicit chain: cycle → pond → project → profile_type → key_growth_indicators
               (determines which growth indicators to display for this cycle)
```

---

## Summary: All Tables for Growth Cycles

| # | Table | Type | Purpose |
|---|-------|------|---------|
| 1 | `growth_indicators` | Reference (NEW) | Valid growth metrics (body_weight, fcr, etc.) with name, code, unit |
| 2 | `cycles` | Entity | Production cycle for a pond |
| 3 | `cycle_daily_health` | Entity | Daily health status per day in a cycle |
| 4 | `cycle_stage_metrics` | Entity | Growth performance metrics per stage (JSONB keys = growth_indicators.code) |

**Also updated:** `profile_types` gets a new `key_growth_indicators` TEXT[] column.

---

## What About `cycle_stages` table?

Satish said to keep `stage_config` on `profile_types` as the template. No separate `cycle_stages` table needed. The stage timeline in the frontend is derived from:

```
profile_types.stage_config + cycles.start_date → calculate which stage each day falls in
```

Growth stages are **never stored per-cycle** — they're always derived from the profile template. This is the current working behavior and Satish confirmed it.

---

*Last updated: April 16, 2026*
