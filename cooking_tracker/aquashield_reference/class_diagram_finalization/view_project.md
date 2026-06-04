# Projects, Ponds, Project Parameter Settings — Class Diagram

---

## Current State (what exists)

- `Project` model — has `parameters` and `parameter_priority` (to be removed), `managed=False`
- `Pond` model — no `status`, `created_at`, `updated_at` columns yet
- `ProjectParameterSettings` — **no Django model exists**, only raw SQL table `project_parameter_thresholds`

---

## Refined Class Diagram (3 classes)

### 1. Project

```
┌──────────────────────────────────────────────┐
│                 Project                      │
├──────────────────────────────────────────────┤
│ - project_id: UUID                           │
│ - project_owner_id: UUID                     │
│ - profile_type_id: UUID                      │
│ - name: String                               │
│ - description: String                        │
│ - created_at: Timestamp                      │
│ - created_by: UUID                           │
│ - updated_at: Timestamp                      │
│ - updated_by: UUID                           │
├──────────────────────────────────────────────┤
│ + get_ponds(): List<Pond>                    │
│ + get_active_ponds(): List<Pond>             │
│ + get_parameter_settings(): List<ProjectParameterSetting>│
│ + get_key_parameters(): List<ProjectParameterSetting>│
│ + get_profile_type(): ProfileType            │
│ + get_owner(): User                          │
│ + get_visualisations(): List<ProjectVisualisation>│
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_ponds()` — all ponds in this project
- `get_active_ponds()` — ponds with `status = 'active'` only
- `get_parameter_settings()` — all parameter settings (thresholds) for this project
- `get_key_parameters()` — only settings where `is_key_parameter = true`
- `get_profile_type()` — returns the associated profile type
- `get_owner()` — returns the project owner user
- `get_visualisations()` — returns project visualisation configurations

---

### 2. Pond

```
┌──────────────────────────────────────────────┐
│                   Pond                       │
├──────────────────────────────────────────────┤
│ - pond_id: UUID                              │
│ - project_id: UUID                           │
│ - name: String                               │
│ - description: String                        │
│ - metadata: JSONB                            │
│ - photo_url: String                          │
│ - status: String                             │
│ - created_at: Timestamp                      │
│ - updated_at: Timestamp                      │
├──────────────────────────────────────────────┤
│ + get_active_cycles(): List<Cycle>           │
│ + get_current_cycle(): Cycle                 │
│ + get_latest_reading(): SensorReading        │
│ + get_sensors(): List<ProjectSensor>         │
│ + get_alerts(resolved: Boolean): List<AlertLog>│
│ + is_active(): Boolean                       │
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_active_cycles()` — cycles with `status = 'ongoing'`
- `get_current_cycle()` — the single ongoing cycle (if any)
- `get_latest_reading()` — most recent sensor reading for this pond (used by Overview page tooltip)
- `get_sensors()` — project sensors assigned to this pond
- `get_alerts(resolved)` — alert logs for this pond, optionally filtered by resolved status
- `is_active()` — shortcut: checks if `status == 'active'`

---

### 3. ProjectParameterSetting

```
┌──────────────────────────────────────────────┐
│        ProjectParameterSetting               │
├──────────────────────────────────────────────┤
│ - project_id: UUID                           │
│ - parameter_id: UUID                         │
│ - min_threshold: Double                      │
│ - max_threshold: Double                      │
│ - is_key_parameter: Boolean                  │
├──────────────────────────────────────────────┤
│ + is_within_threshold(value: Double): Boolean│
│ + get_parameter(): ParameterType             │
└──────────────────────────────────────────────┘
```

**Methods:**
- `is_within_threshold(value)` — checks if a reading value is between min and max threshold (used by alert system)
- `get_parameter()` — returns the associated ParameterType

---

## Relationships

```
ProfileType "1" ──────── "*" Project                    : template for    (Association)
User "1" ────────────── "*" Project                     : owns            (Association)
Project "1" ◆────────── "*" Pond                        : contains        (Composition)
Project "1" ◆────────── "*" ProjectParameterSetting     : configures      (Composition)
ParameterType "1" ────── "*" ProjectParameterSetting    : referenced by   (Association)
```

### Why these relationship types?

| Relationship | Type | Why |
|---|---|---|
| ProfileType → Project | **Association** | Profile type is a reference/template. Projects use it but don't own it. |
| User → Project | **Association** | Owner reference. User exists independently. |
| Project → Pond | **Composition** ◆ | Pond **cannot exist** without a project. Delete project = ponds are gone. Pond is physically "part of" a project/farm. |
| Project → ProjectParameterSetting | **Composition** ◆ | Settings are meaningless without their project. Delete project = settings gone. |
| ParameterType → ProjectParameterSetting | **Association** | ParameterType is a reference table. It's just referenced, not owned. |

---

## Notes

- `Project` — removed `parameters` and `parameter_priority` (per Satish)
- `Pond` — added `status`, `created_at`, `updated_at` (from earlier schema refinement)
- `ProjectParameterSetting` — **new Django model needed** (currently only exists as raw SQL table with no model)
- `Project.project_owner_id` — renamed from `owner_user_id`

---

*Last updated: April 20, 2026*