# Sensor Types — ERD Finalization

---

## Current State

### sensor_types
| Column | Type | Notes |
|--------|------|-------|
| sensor_type_id | UUID (PK) | `gen_random_uuid()` |
| name | VARCHAR(255) | |
| model_number | VARCHAR(255) | |
| parameter_ids | UUID[] | Array of parameter_type IDs this sensor measures |
| manufacturer | VARCHAR(255) | |
| description | TEXT | |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |

---

## Refined Schema (1 Table — no changes needed)

### sensor_types

| Column | Type | Notes |
|--------|------|-------|
| sensor_type_id | UUID (PK) | |
| name | VARCHAR(255) | e.g., `'Multi-Parameter Water Quality Sensor'` |
| description | TEXT | |
| model_number | VARCHAR(255) | e.g., `'WQS-3000'` |
| manufacturer | VARCHAR(255) | e.g., `'AquaTech Instruments'` |
| parameter_ids | UUID[] | Array of `parameter_types.parameter_id` this sensor can measure |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |

> Table is clean — no columns to add or remove.

---

## Use Case Mapping

> **⚠️ Use case diagram mismatch:** The labels in the diagram are swapped — "View Sensor Types" (top) shows use cases that actually belong to `project_sensors`, and "View Project Sensors" (bottom) shows use cases that actually belong to `sensor_types`. The mapping below is based on **what fits this table**. Use case diagram to be refined later.

The correct use cases for `sensor_types` are from the **bottom** section of the diagram (labelled "View Project Sensors"):

| Use Case | Table/Column |
|----------|-------------|
| Add/Modify name | `sensor_types.name` |
| Add/Modify description | `sensor_types.description` |
| Add/Modify model no | `sensor_types.model_number` |
| Add/Modify manufacturer | `sensor_types.manufacturer` |
| Set parameters | `sensor_types.parameter_ids` (UUID[] referencing parameter_types) |
| Set activate | `sensor_types.is_active` |

---

## Relationships

```
sensor_types (1) ──→ (N) project_sensors (a project sensor has one sensor type)

sensor_types.parameter_ids UUID[] → references parameter_types.parameter_id
```

---

## Note: `sensors` table (legacy) — TO BE DROPPED

The old `sensors` table is redundant with `project_sensors`. Same columns minus `project_id` and audit trail. `project_sensors` is the replacement.

---

*Last updated: April 17, 2026*
