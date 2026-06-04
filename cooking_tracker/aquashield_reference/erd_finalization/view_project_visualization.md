# Project Visualisations — ERD Finalization

---

## Current State

### project_visualisations
| Column | Type | Notes |
|--------|------|-------|
| project_visualisation_id | UUID (PK) | `gen_random_uuid()` |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| visualisation_type_id | UUID (FK → visualisation_types) | |
| enabled | BOOLEAN | Default true |
| flag | INTEGER | 0=historical, 1=prediction, 2=both |
| x_parameters | UUID[] | X-axis parameter IDs |
| y_parameters | UUID[] | Y-axis parameter IDs |
| title | VARCHAR(255) | |

**Current data: 16 rows** across 3 projects (Demo Shrimp Farm, Demo Fish Farm, Demo Crab Hatchery). Each project gets assigned a set of visualisation types with project-specific parameter selections.

---

## Refined Schema (1 Table — no changes needed)

### project_visualisations

| Column | Type | Notes |
|--------|------|-------|
| project_visualisation_id | UUID (PK) | |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| visualisation_type_id | UUID (FK → visualisation_types) | |
| enabled | BOOLEAN | Default true |
| flag | INTEGER | 0=historical, 1=prediction, 2=both |
| x_parameters | UUID[] | X-axis parameter IDs (referencing parameter_types) |
| y_parameters | UUID[] | Y-axis parameter IDs (referencing parameter_types) |
| title | VARCHAR(255) | Display title (can override visualisation_type name per project) |

> Table is clean — no columns to add or remove.

---

## Use Case Mapping

From the use case diagram (System Administrator → View Project Visualisation → Add/Modify Project Visualisation):

| Use Case | Table/Column |
|----------|-------------|
| Assign Project | `project_visualisations.project_id` (FK → projects) |
| Assign Visualisation Type | `project_visualisations.visualisation_type_id` (FK → visualisation_types) |
| Set Enable | `project_visualisations.enabled` (BOOLEAN) |
| Set X Parameter | `project_visualisations.x_parameters` (UUID[] referencing parameter_types) |
| Set Y Parameter | `project_visualisations.y_parameters` (UUID[] referencing parameter_types) |

---

## Relationships

```
project_visualisations (N) ←── (1) projects
project_visualisations (N) ←── (1) visualisation_types

project_visualisations.x_parameters UUID[] → references parameter_types.parameter_id
project_visualisations.y_parameters UUID[] → references parameter_types.parameter_id
```

---

*Last updated: April 17, 2026*