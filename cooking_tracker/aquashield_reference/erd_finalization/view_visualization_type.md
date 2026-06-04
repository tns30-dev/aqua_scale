# Visualisation Types — ERD Finalization

---

## Current State

### visualisation_types
| Column | Type | Notes |
|--------|------|-------|
| visualisation_type_id | UUID (PK) | `gen_random_uuid()` |
| name | VARCHAR(255) | e.g., "Multi-Parameter Trends", "Nitrogen Cycle Monitoring" |
| description | TEXT | |
| required_parameters | UUID[] | Array of `parameter_types.parameter_id` needed for this chart |
| chart_type | VARCHAR(50) | `'line'`, `'heatmap'`, `'single-line'`, `'multi-line'`, `'area'` |

**Current data (15 rows, but with duplicates):**

| name | chart_type | # params |
|------|-----------|----------|
| Multi-Parameter Trends | line | 4 |
| Parameter Correlation Heatmap | heatmap | 7 |
| Historical Trends of Key Parameters | line | 3 |
| Temperature Trend Analysis | single-line | 1 |
| Temperature Trend Analysis | single-line | 1 |
| Dissolved Oxygen Monitoring | single-line | 1 |
| Dissolved Oxygen Monitoring | single-line | 1 |
| Water Quality Index | area | 4 |
| Water Quality Index | area | 4 |
| Disease Risk Assessment | multi-line | 3 |
| Disease Risk Assessment | multi-line | 3 |
| Nitrogen Cycle Monitoring | multi-line | 4 |
| Nitrogen Cycle Monitoring | multi-line | 4 |

> **Note:** Several visualisation types are duplicated (same name, description, params, chart_type but different UUIDs). This is likely because they were seeded per-profile (e.g., one for shrimp, one for fish). Seed data cleanup needed.

---

## Refined Schema (1 Table — no changes needed)

### visualisation_types

| Column | Type | Notes |
|--------|------|-------|
| visualisation_type_id | UUID (PK) | |
| name | VARCHAR(255) | e.g., `'Multi-Parameter Trends'` |
| description | TEXT | |
| required_parameters | UUID[] | Array of `parameter_types.parameter_id` this chart needs |
| chart_type | VARCHAR(50) | `'line'`, `'heatmap'`, `'single-line'`, `'multi-line'`, `'area'` |

> Table structure is clean — no columns to add or remove. Duplicate seed data should be cleaned up separately.

---

## Use Case Mapping

From the use case diagram (System Administrator → View Visualisation Types → Add/Modify Visualisation Types):

| Use Case | Table/Column |
|----------|-------------|
| Add/Modify name | `visualisation_types.name` |
| Add/Modify description | `visualisation_types.description` |
| Add/Modify Required Parameters | `visualisation_types.required_parameters` (UUID[] referencing parameter_types) |
| Set Chart Type | `visualisation_types.chart_type` |

---

## Relationships

```
visualisation_types (1) ──→ (N) project_visualisations (assigned to projects)

visualisation_types.required_parameters UUID[] → references parameter_types.parameter_id
```

---

*Last updated: April 17, 2026*