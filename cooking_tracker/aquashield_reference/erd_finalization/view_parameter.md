# Parameter Types — ERD Finalization

---

## Current State

### parameter_types
| Column | Type | Notes |
|--------|------|-------|
| parameter_id | UUID (PK) | `gen_random_uuid()` |
| name | VARCHAR(100) | Unique. Currently acts as both code AND display name (e.g., `'temperature'`, `'ph'`) |
| unit | VARCHAR(50) | e.g., `'°C'`, `'mg/L'`, `'ppt'` |
| data_type | VARCHAR(50) | `'float'` or `'integer'` |

**Current data (24 parameters):**

| name | unit | data_type |
|------|------|-----------|
| temperature | °C | float |
| salinity | ppt | float |
| ph | | float |
| water_level | cm | float |
| dissolved_oxygen | mg/L | float |
| turbidity | NTU | float |
| nitrate | mg/L | float |
| nitrite | mg/L | float |
| ammonia | mg/L | float |
| ammonium | mg/L | float |
| ph_lab | | float |
| carbonate | mg/L | float |
| bicarbonate | mg/L | float |
| tan | mg/L | float |
| alkalinity | mg/L | float |
| calcium | mg/L | float |
| magnesium | mg/L | float |
| phosphate | mg/L | float |
| total_hardness | mg/L | float |
| hydrogen_sulfide | mg/L | float |
| total_vibrio_count | CFU/mL | float |
| total_bacteria_count | CFU/mL | float |

**Problem:** `name` is a technical code (`"ph"`, `"dissolved_oxygen"`) — not user-friendly for display.

---

## Refined Schema (1 Table)

### parameter_types

| Column | Type | Notes |
|--------|------|-------|
| parameter_id | UUID (PK) | |
| parameter_code | VARCHAR(50) | **NEW** — Unique. Machine identifier. e.g., `'temperature'`, `'ph'`, `'dissolved_oxygen'` |
| parameter_name | VARCHAR(100) | **CHANGED** — Now human-friendly display name. e.g., `'Temperature'`, `'pH Level'`, `'Dissolved Oxygen'` |
| description | TEXT | **NEW** — per use case diagram |
| unit | VARCHAR(50) | e.g., `'°C'`, `'mg/L'`, `'ppt'` |
| data_type | VARCHAR(50) | `'float'` or `'integer'` |

**Example data after migration:**

| parameter_code | parameter_name | description | unit | data_type |
|------|------|-------------|------|-----------|
| `temperature` | Temperature | Water temperature measurement | °C | float |
| `salinity` | Salinity | Salt concentration in water | ppt | float |
| `ph` | pH Level | Acidity/alkalinity of water | | float |
| `water_level` | Water Level | Pond water depth | cm | float |
| `dissolved_oxygen` | Dissolved Oxygen | Oxygen concentration in water | mg/L | float |
| `turbidity` | Turbidity | Water clarity measurement | NTU | float |
| `nitrate` | Nitrate | Nitrate concentration | mg/L | float |
| `nitrite` | Nitrite | Nitrite concentration | mg/L | float |
| `ammonia` | Ammonia | Ammonia concentration | mg/L | float |
| `ammonium` | Ammonium | Ammonium concentration | mg/L | float |
| `ph_lab` | pH (Lab) | Lab-measured pH value | | float |
| `carbonate` | Carbonate | Carbonate concentration | mg/L | float |
| `bicarbonate` | Bicarbonate | Bicarbonate concentration | mg/L | float |
| `tan` | TAN | Total ammonia nitrogen | mg/L | float |
| `alkalinity` | Alkalinity | Water alkalinity | mg/L | float |
| `calcium` | Calcium | Calcium concentration | mg/L | float |
| `magnesium` | Magnesium | Magnesium concentration | mg/L | float |
| `phosphate` | Phosphate | Phosphate concentration | mg/L | float |
| `total_hardness` | Total Hardness | Water hardness | mg/L | float |
| `hydrogen_sulfide` | Hydrogen Sulfide | H₂S concentration | mg/L | float |
| `total_vibrio_count` | Total Vibrio Count | Vibrio bacteria count | CFU/mL | float |
| `total_bacteria_count` | Total Bacteria Count | Total bacterial count | CFU/mL | float |

**What changed:**
- `name` (old) → split into `parameter_code` (machine) + `parameter_name` (human-friendly)
- `description` added — per use case diagram
- `parameter_code` takes over as the unique identifier used in JSONB references, TEXT[] arrays, and code

**Migration:** Current `name` values become `parameter_code`. New `parameter_name` column gets human-readable values.

---

## Use Case Mapping

From the use case diagram (System Administrator → View Parameter Types → Add/Modify Parameter Type):

| Use Case | Table/Column |
|----------|-------------|
| Add/Modify name | `parameter_types.parameter_name` (display name) + `parameter_types.parameter_code` (unique code) |
| Add/Modify description | `parameter_types.description` |
| Add/Modify unit | `parameter_types.unit` |
| Set data type | `parameter_types.data_type` |

---

## Impact on Other Tables

The `code` column replaces where `name` was used as a reference:

| Table/Column | Currently references | Should now reference |
|---|---|---|
| `profile_types.key_parameter_indicators` (TEXT[]) | `parameter_types.parameter_name` | `parameter_types.parameter_code` |
| `sensor_readings` column names | Match `parameter_types.parameter_name` | Match `parameter_types.parameter_code` (already matches — values are the same) |
| `project_parameter_thresholds` | FK to `parameter_types` by ID | No change (FK by UUID) |

> Since current `name` values (`"temperature"`, `"ph"`) become `code` values, all existing references stay valid. No breaking changes.

---

## Relationships

```
parameter_types (referenced by)
  ├── profile_types.key_parameter_indicators TEXT[] → parameter_types.parameter_code
  ├── project_parameter_settings → parameter_types.parameter_id (FK)
  └── sensor_readings column names → match parameter_types.parameter_code
```

---

*Last updated: April 16, 2026*