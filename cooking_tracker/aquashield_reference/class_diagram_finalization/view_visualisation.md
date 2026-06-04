# Visualisations — Class Diagram

---

## Current State (what exists)

- `VisualisationType` — **no Django model**, raw SQL table only
- `ProjectVisualisation` — **no Django model**, raw SQL table only

---

## Refined Class Diagram (2 classes)

### 1. VisualisationType

```
┌──────────────────────────────────────────────┐
│           VisualisationType                  │
├──────────────────────────────────────────────┤
│ - visualisation_type_id: UUID                │
│ - name: String                               │
│ - description: String                        │
│ - required_parameters: UUID[]                │
│ - chart_type: String                         │
├──────────────────────────────────────────────┤
│ + get_required_parameters(): List<ParameterType>│
│ + get_chart_type(): String                   │
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_required_parameters()` — queries ParameterType by UUIDs in the `required_parameters` array
- `get_chart_type()` — returns chart type (line, heatmap, single-line, multi-line, area)

---

### 2. ProjectVisualisation

```
┌──────────────────────────────────────────────┐
│          ProjectVisualisation                │
├──────────────────────────────────────────────┤
│ - project_visualisation_id: UUID             │
│ - project_id: UUID                           │
│ - visualisation_type_id: UUID                │
│ - enabled: Boolean                           │
│ - flag: Integer                              │
│ - x_parameters: UUID[]                       │
│ - y_parameters: UUID[]                       │
│ - title: String                              │
├──────────────────────────────────────────────┤
│ + is_enabled(): Boolean                      │
│ + get_x_parameters(): List<ParameterType>    │
│ + get_y_parameters(): List<ParameterType>    │
│ + get_visualisation_type(): VisualisationType│
│ + get_project(): Project                     │
│ + toggle_enabled(): void                     │
└──────────────────────────────────────────────┘
```

**Methods:**
- `is_enabled()` — returns `enabled` flag
- `get_x_parameters()` / `get_y_parameters()` — queries ParameterType by UUIDs in the arrays
- `get_visualisation_type()` — returns the associated chart type definition
- `get_project()` — returns the project this visualisation belongs to
- `toggle_enabled()` — flips the `enabled` boolean

---

## Relationships

```
VisualisationType "1" ──── "*" ProjectVisualisation  : type of      (Association)
Project "1" ◆────────────── "*" ProjectVisualisation  : has          (Composition)
```

### Why these relationship types?

| Relationship | Type | Why |
|---|---|---|
| VisualisationType → ProjectVisualisation | **Association** | Visualisation type is a reference/catalog. It defines what kind of chart it is. Multiple projects can use the same type. Independent existence. |
| Project → ProjectVisualisation | **Composition** ◆ | A project's visualisation config is part of the project. Delete project = visualisation configs gone. No meaning without the project. |

---

## Notes

- Both are **new Django models needed** (currently raw SQL only)
- `VisualisationType.required_parameters` and `ProjectVisualisation.x_parameters` / `y_parameters` are UUID arrays referencing `ParameterType` — no FK enforcement
- `flag` column: 0=historical, 1=prediction, 2=both

---

*Last updated: April 20, 2026*