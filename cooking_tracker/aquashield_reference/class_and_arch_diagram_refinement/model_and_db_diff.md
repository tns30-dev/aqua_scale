# Django Model vs Database Diff

> After running `refine.sql` (April 23, 2026), the database matches the ERD.
> But many Django models are outdated and don't match the DB.

---

## Models That Need Updating

### 1. User (module_user/models.py)

| DB Column | In Django Model? | Action |
|---|---|---|
| `user_id` | Yes | — |
| `email` | Yes | — |
| `password_hash` | Yes | — |
| `name` | Yes | — |
| `mobile_number` | **No** | Add CharField |
| `created_at` | Yes | — |
| `updated_at` | **No** | Add DateTimeField |

### 2. Role (module_user/models.py) — FULL RESTRUCTURE

**Current model:** Old composite PK (project_id + user_id + role string)
**DB now:** New `roles` table with role_id PK, role_type, role_name, module_feature_assigned JSONB

| DB Column | In Django Model? | Action |
|---|---|---|
| `role_id` | **No** | Replace entire model |
| `role_type` | **No** | Add CharField (UNIQUE) |
| `role_name` | **No** | Add CharField |
| `module_feature_assigned` | **No** | Add JSONField |
| `created_at` | **No** | Add DateTimeField |
| `created_by` | **No** | Add UUIDField |
| `updated_at` | **No** | Add DateTimeField |
| `updated_by` | **No** | Add UUIDField |

**Old columns to remove:** `project` (FK), `user` (FK), `role` (CharField)

### 3. UserRole — NEW MODEL NEEDED (module_user/models.py)

| DB Column | Action |
|---|---|
| `user_role_id` | UUID PK |
| `user_id` | FK → User |
| `role_id` | FK → Role |
| `assigned_at` | DateTimeField |
| `assigned_by` | UUIDField |

### 4. UserRoleProject — NEW MODEL NEEDED (module_user/models.py)

| DB Column | Action |
|---|---|
| `user_role_project_id` | UUID PK |
| `user_role_id` | FK → UserRole |
| `project_id` | FK → Project |

### 5. ModuleAccess — NEW MODEL NEEDED

| DB Column | Action |
|---|---|
| `module_access_id` | UUID PK |
| `name` | CharField |
| `code` | CharField (UNIQUE) |

### 6. FeatureAccess — NEW MODEL NEEDED

| DB Column | Action |
|---|---|
| `feature_access_id` | UUID PK |
| `name` | CharField |
| `code` | CharField (UNIQUE) |

### 7. ProfileType (module_project/models.py)

| DB Column | In Django Model? | Action |
|---|---|---|
| `profile_type_id` | Yes | — |
| `name` | Yes | — |
| `description` | Yes | — |
| `default_parameters` | Yes | Keep (consultant: may re-add) |
| `parameter_priority` | Yes | Keep (consultant: may re-add) |
| `stage_config` | Yes | — |
| `key_parameter_indicators` | **Wrong name** | Rename from `key_indicators`, update `db_column` |
| `code` | **No** | Add CharField (UNIQUE) |
| `key_growth_indicators` | **No** | Add ArrayField |
| `created_at` | **No** | Add DateTimeField |
| `created_by` | **No** | Add UUIDField |
| `updated_at` | **No** | Add DateTimeField |
| `updated_by` | **No** | Add UUIDField |

### 8. Project (module_project/models.py)

| DB Column | In Django Model? | Action |
|---|---|---|
| `project_id` | Yes | — |
| `project_owner_id` | **Wrong db_column** | Change `db_column='owner_user_id'` → `db_column='project_owner_id'` |
| `profile_type_id` | Yes | — |
| `name` | Yes | — |
| `description` | Yes | — |
| `parameters` | Yes | Keep (consultant: may re-add) |
| `parameter_priority` | Yes | Keep (consultant: may re-add) |
| `created_at` | Yes | — |
| `created_by` | **No** | Add UUIDField |
| `updated_at` | **No** | Add DateTimeField |
| `updated_by` | **No** | Add UUIDField |

### 9. Pond (module_project/models.py)

| DB Column | In Django Model? | Action |
|---|---|---|
| `pond_id` | Yes | — |
| `project_id` | Yes | — |
| `name` | Yes | — |
| `description` | Yes | — |
| `metadata` | Yes | — |
| `photo_url` | Yes (via metadata) | — |
| `status` | **No** | Add CharField (default 'active') |
| `created_at` | **No** | Add DateTimeField |
| `updated_at` | **No** | Add DateTimeField |

### 10. ParameterType (module_sensor/models.py)

| DB Column | In Django Model? | Action |
|---|---|---|
| `parameter_id` | Yes | — |
| `parameter_name` | **Wrong name** | `db_column='name'` → needs `db_column='parameter_name'` |
| `unit` | Yes | — |
| `data_type` | Yes | — |
| `parameter_code` | **No** | Add CharField (UNIQUE) |
| `description` | **No** | Add TextField |

### 11. GrowthIndicator — NEW MODEL NEEDED

| DB Column | Action |
|---|---|
| `growth_indicator_id` | UUID PK |
| `code` | CharField (UNIQUE) |
| `name` | CharField |
| `unit` | CharField |
| `data_type` | CharField |

### 12. Cycle (module_project/models.py)

| DB Column | In Django Model? | Action |
|---|---|---|
| `cycle_id` | Yes | — |
| `pond_id` | Yes | — |
| `start_date` | Yes | — |
| `end_date` | Yes | — |
| `status` | Yes | — |
| `created_at` | Yes | — |
| `created_by` | **No** | Add UUIDField |
| `updated_at` | **No** | Add DateTimeField |
| `updated_by` | **No** | Add UUIDField |

### 13. CycleStageMetric (module_project/models.py) — RESTRUCTURED

**Current model:** Has `parameter_type`, `avg_value`, `min_value`, `max_value`
**DB now:** Those columns dropped, replaced by `metrics` JSONB

| DB Column | In Django Model? | Action |
|---|---|---|
| `metric_id` | Yes | — |
| `cycle_id` | Yes | — |
| `stage_name` | Yes | — |
| `metrics` | **No** | Add JSONField |
| `calculated_at` | Yes | — |
| `parameter_type` | **Dropped from DB** | Remove from model |
| `avg_value` | **Dropped from DB** | Remove from model |
| `min_value` | **Dropped from DB** | Remove from model |
| `max_value` | **Dropped from DB** | Remove from model |

### 14. AlertLog (module_notification/models.py)

| DB Column | In Django Model? | Action |
|---|---|---|
| `log_id` | Yes | — |
| `pond_id` | Yes | — |
| `project_id` | Yes | — |
| `timestamp` | Yes | — |
| `log_type` | Yes | — |
| `message` | Yes | — |
| `severity` | Yes | — |
| `acknowledged` | Yes | — |
| `acknowledged_by` | Yes | — |
| `acknowledged_at` | Yes | — |
| `resolved` | Yes | — |
| `parameter` | Yes | — |
| `reading_timestamp` | Yes | — |
| `resolved_by` | **No** | Add UUIDField (FK → User) |
| `resolved_at` | **No** | Add DateTimeField |

---

## Models Already Correct (Satish Updated)

| Model | File | Status |
|---|---|---|
| IoTDevice | module_sensor/models.py | ✅ Matches DB |
| ProjectSensor | module_sensor/models.py | ✅ Matches DB |
| SensorMessage | module_sensor/models.py | ✅ Matches DB |
| SensorReading | module_sensor/models.py | ✅ Matches DB |
| SensorType | module_sensor/models.py | ✅ Matches DB |
| ProjectParameterSetting | module_sensor/models.py | ✅ Matches DB |

---

## Models With No Changes Needed

| Model | File | Status |
|---|---|---|
| CycleDailyHealth | module_project/models.py | ✅ No change |
| VisualisationType | N/A (no Django model) | ✅ No change |
| ProjectVisualisation | N/A (no Django model) | ✅ No change |

---

## Summary

| Action | Count | Models |
|---|---|---|
| **Full restructure** | 1 | Role |
| **New model needed** | 5 | UserRole, UserRoleProject, ModuleAccess, FeatureAccess, GrowthIndicator |
| **Add missing fields** | 7 | User, ProfileType, Project, Pond, Cycle, CycleStageMetric, AlertLog |
| **Rename/fix columns** | 2 | ParameterType (name→parameter_name), Project (owner_user_id→project_owner_id) |
| **Already correct** | 6 | IoTDevice, ProjectSensor, SensorMessage, SensorReading, SensorType, ProjectParameterSetting |
| **No change needed** | 3 | CycleDailyHealth, VisualisationType, ProjectVisualisation |

**Total: 14 models need updating, 6 already correct, 3 no change needed = 23 tables covered**

---

*Last updated: April 23, 2026*
