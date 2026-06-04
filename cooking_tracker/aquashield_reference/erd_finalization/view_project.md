# Projects — ERD Finalization

---

## Current State

### projects
| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID (PK) | `gen_random_uuid()` |
| project_owner_id | UUID (FK → users) | Project owner |
| profile_type_id | UUID (FK → profile_types) | Which profile template |
| name | VARCHAR(255) | |
| description | TEXT | |
| parameters | JSONB | ⚠️ Always NULL — never used |
| parameter_priority | JSONB | ⚠️ Always NULL — never used |
| created_at | TIMESTAMP | |

### project_parameter_thresholds (to be renamed)
| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID (PK, FK → projects) | Composite PK |
| parameter_id | UUID (PK, FK → parameter_types) | Composite PK |
| min_threshold | DOUBLE PRECISION | |
| max_threshold | DOUBLE PRECISION | |

---

## Refined Schema (2 Tables)

### projects

| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID (PK) | |
| project_owner_id | UUID (FK → users) | Project owner |
| profile_type_id | UUID (FK → profile_types) | 1:1 — one profile type per project |
| name | VARCHAR(255) | |
| description | TEXT | |
| created_at | TIMESTAMP | |
| created_by | UUID (FK → users) | NEW |
| updated_at | TIMESTAMP | NEW |
| updated_by | UUID (FK → users) | NEW |

**Removed:** `parameters`, `parameter_priority` — per Satish. Always NULL, never used by app.

**Added:** audit columns.

---

### project_parameter_settings (renamed from `project_parameter_thresholds`)

Per-project parameter configuration. Each row = one parameter configured for this project with its threshold range and key parameter flag.

| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID (PK, FK → projects) | Composite PK. ON DELETE CASCADE |
| parameter_id | UUID (PK, FK → parameter_types) | Composite PK. ON DELETE RESTRICT |
| min_threshold | DOUBLE PRECISION | Minimum safe value |
| max_threshold | DOUBLE PRECISION | Maximum safe value |
| is_key_parameter | BOOLEAN | **NEW** — per Satish. Whether this parameter is a key/priority parameter for this project. Default false |

**What changed:**
- Table renamed: `project_parameter_thresholds` → `project_parameter_settings`
- Added `is_key_parameter` (BOOLEAN) — flags which parameters are key for this project

**Example data (Demo Shrimp Farm):**

| project_id | parameter (name) | min_threshold | max_threshold | is_key_parameter |
|------------|-----------------|---------------|---------------|------------------|
| Demo Shrimp Farm | temperature | 26 | 32 | true |
| Demo Shrimp Farm | salinity | 12 | 28 | true |
| Demo Shrimp Farm | ph | 7 | 8.5 | true |
| Demo Shrimp Farm | ammonia | 0 | 0.5 | true |
| Demo Shrimp Farm | nitrite | 0 | 0.2 | true |
| Demo Shrimp Farm | dissolved_oxygen | 5 | 10 | false |
| Demo Shrimp Farm | turbidity | 0 | 50 | false |
| Demo Shrimp Farm | nitrate | 0 | 40 | false |

---

## Use Case Mapping

From the use case diagram (System Administrator → View Projects → Add/Modify Projects):

| Use Case | Table/Column |
|----------|-------------|
| Assign/Modify Profile Type | `projects.profile_type_id` (FK → profile_types) |
| Assign/Modify Owner | `projects.project_owner_id` (FK → users) |
| Add/Modify name | `projects.name` |
| Add/Modify description | `projects.description` |
| Add/Modify parameter setting | → `project_parameter_settings` (sub-use cases below) |

From the use case diagram (Add/Modify parameter setting):

| Use Case | Table/Column |
|----------|-------------|
| Add Parameter | Insert row into `project_parameter_settings` (project_id + parameter_id) |
| Add min threshold | `project_parameter_settings.min_threshold` |
| Add max threshold | `project_parameter_settings.max_threshold` |
| Set key parameter | `project_parameter_settings.is_key_parameter` |

---

## Relationships

```
projects (N) ←── (1) profile_types
projects (N) ←── (1) users (owner)

projects (1) ──→ (N) project_parameter_settings (N) ←── (1) parameter_types
projects (1) ──→ (N) ponds
projects (1) ──→ (N) user_role_projects (from user access control)
```

---

## Discussion Point for Satish

### Overlap: `project_parameter_settings.is_key_parameter` vs `profile_types.key_parameter_indicators`

Both define "key parameters" but at different levels:

| | `profile_types.key_parameter_indicators` | `project_parameter_settings.is_key_parameter` |
|---|---|---|
| **Level** | Profile type (template) | Project (instance) |
| **Scope** | All projects of this profile type share the same key params | Each project can have different key params |
| **Example** | All shrimp profiles default to: temperature, ph, salinity | Demo Shrimp Farm might add ammonia as key |

**Possible interpretations:**
1. `profile_types.key_parameter_indicators` = **defaults** when creating a project. `project_parameter_settings.is_key_parameter` = **project-level override** (can differ per project).
2. They serve different purposes and both are needed.
3. One is redundant — only need project-level.

> To be discussed with Satish tomorrow.

---

*Last updated: April 16, 2026*