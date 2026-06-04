# Parameter Types & Growth Indicators — Class Diagram

---

## Current State (what exists)

- `ParameterType` — **no Django model**, raw SQL table `parameter_types` only
- `GrowthIndicator` — **does not exist** at all (new table from ERD refinement)

---

## Refined Class Diagram (2 classes)

### 1. ParameterType

```
┌──────────────────────────────────────────────┐
│              ParameterType                   │
├──────────────────────────────────────────────┤
│ - parameter_id: UUID                         │
│ - parameter_code: String                     │
│ - parameter_name: String                     │
│ - description: String                        │
│ - unit: String                               │
│ - data_type: String                          │
├──────────────────────────────────────────────┤
│ + get_display_name(): String                 │
│ + get_unit_label(): String                   │
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_display_name()` — returns `parameter_name` (human-friendly, e.g., "Temperature")
- `get_unit_label()` — returns formatted label (e.g., "Temperature (°C)")

---

### 2. GrowthIndicator

```
┌──────────────────────────────────────────────┐
│            GrowthIndicator                   │
├──────────────────────────────────────────────┤
│ - growth_indicator_id: UUID                  │
│ - code: String                               │
│ - name: String                               │
│ - unit: String                               │
│ - data_type: String                          │
├──────────────────────────────────────────────┤
│ + get_display_name(): String                 │
│ + get_unit_label(): String                   │
└──────────────────────────────────────────────┘
```

**Methods:** Same pattern as ParameterType — display helpers.

---

## Relationships

```
ParameterType "1" ──── "*" ProjectParameterSetting  : referenced by   (Association)
ParameterType "1" ···· "*" SensorReading            : column names     (Dependency)
ParameterType "1" ···· "*" ProfileType              : key_parameter_indicators (Dependency)
GrowthIndicator "1" ·· "*" CycleStageMetric         : metrics JSONB keys (Dependency)
GrowthIndicator "1" ·· "*" ProfileType              : key_growth_indicators (Dependency)
```

### Why these relationship types?

| Relationship | Type | Why |
|---|---|---|
| ParameterType → ProjectParameterSetting | **Association** | Direct FK reference (parameter_id) |
| ParameterType → SensorReading | **Dependency** (dashed) | No FK — sensor_readings has hardcoded column names that match parameter_type codes. Loose coupling. |
| ParameterType → ProfileType | **Dependency** (dashed) | No FK — `key_parameter_indicators` TEXT[] references codes, not UUIDs |
| GrowthIndicator → CycleStageMetric | **Dependency** (dashed) | No FK — `metrics` JSONB keys reference growth indicator codes |
| GrowthIndicator → ProfileType | **Dependency** (dashed) | No FK — `key_growth_indicators` TEXT[] references codes |

> **Note on Dependency:** These are the weakest relationship type — dashed arrows. They mean "this class uses/references that class" but there's no FK enforcement. The codes just need to match by convention.

---

## Notes

- Both are **new Django models** — neither exists in the current codebase
- They are **independent** from each other — no relationship between ParameterType and GrowthIndicator
- Both serve as **reference/lookup tables** — rarely modified, mostly read
- `ParameterType` is for **sensor/water quality** parameters (temperature, ph, salinity)
- `GrowthIndicator` is for **animal performance** metrics (body_weight, fcr, mortality_rate)

---

*Last updated: April 20, 2026*
