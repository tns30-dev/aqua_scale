# User & Access Control — ERD Finalization

### 1. users

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (PK) | |
| email | VARCHAR(255) | Unique |
| password_hash | VARCHAR(255) | |
| name | VARCHAR(255) | |
| mobile_number | VARCHAR(20) |  |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP |  |

---

### 2. roles

Defines named roles. Module/feature access is stored as JSONB on this table.

| Column | Type | Notes |
|--------|------|-------|
| role_id | UUID (PK) | |
| role_name | VARCHAR(100) | Unique. e.g., `'Platform Admin'`, `'Farm Manager'`, `'Farmer'`, `'Viewer'` |
| role_type | VARCHAR(50) | Category. e.g., `'platform'`, `'project'`, `'viewer'` |
| module_feature_assigned | JSONB | Modules + features this role can access |
| created_at | TIMESTAMP | |
| created_by | UUID (FK → users) | |
| updated_at | TIMESTAMP | |
| updated_by | UUID (FK → users) | |

**`module_feature_assigned` JSONB shape:**

```json
// platform_admin — full access
{
  "modules_access": ["*"],
  "features_access": ["*"]
}

// farm_manager
{
  "modules_access": ["monitoring", "project_management"],
  "features_access": [
    "view_overview", "view_digital_twin", "view_realtime_forecast",
    "view_historical", "view_pond_comparison",
    "acknowledge_alerts",
    "manage_ponds", "manage_sensors", "manage_thresholds"
  ]
}

// farmer
{
  "modules_access": ["monitoring"],
  "features_access": [
    "view_overview", "view_digital_twin", "view_realtime_forecast",
    "view_historical", "view_pond_comparison",
    "acknowledge_alerts"
  ]
}

// viewer
{
  "modules_access": ["monitoring"],
  "features_access": [
    "view_overview", "view_digital_twin", "view_realtime_forecast",
    "view_historical"
  ]
}
```

---

### 3. module_access (reference table)

Source of truth for what modules exist in the system. The codes here are what `module_feature_assigned` JSONB references.

| Column | Type | Notes |
|--------|------|-------|
| module_access_id | UUID (PK) | |
| name | VARCHAR(100) | Human-readable. e.g., "Monitoring" |
| code | VARCHAR(50) | Unique. e.g., `'monitoring'` |

**Seed data:**

| name | code |
|------|------|
| Monitoring | `monitoring` |
| Project Management | `project_management` |
| Platform Administration | `platform_admin` |

---

### 4. feature_access (reference table)

Source of truth for what features exist in the system. The codes here are what `module_feature_assigned` JSONB references.

| Column | Type | Notes |
|--------|------|-------|
| feature_access_id | UUID (PK) | |
| module_access_id | UUID (FK → module_access) | Which module this feature belongs to |
| name | VARCHAR(100) | Human-readable. e.g., "View Pond Comparison" |
| code | VARCHAR(50) | Unique. e.g., `'view_pond_comparison'` |

**Seed data:**

| module | name | code |
|--------|------|------|
| Monitoring | View Overview | `view_overview` |
| Monitoring | View Digital Twin | `view_digital_twin` |
| Monitoring | View Real-time & Forecast | `view_realtime_forecast` |
| Monitoring | View Historical Data | `view_historical` |
| Monitoring | View Pond Comparison | `view_pond_comparison` |
| Monitoring | Acknowledge Alerts | `acknowledge_alerts` |
| Project Management | Manage Ponds | `manage_ponds` |
| Project Management | Manage Sensors | `manage_sensors` |
| Project Management | Manage Thresholds | `manage_thresholds` |
| Platform Administration | Manage Users | `manage_users` |
| Platform Administration | Manage Projects | `manage_projects` |
| Platform Administration | Manage Roles | `manage_roles` |

> Features belong to a module via FK. This gives a clean hierarchy: Module → Features.

---

### 5. user_roles (junction: user ↔ role)

A user can have **multiple roles**. Each row = "this user has this role".

| Column | Type | Notes |
|--------|------|-------|
| user_role_id | UUID (PK) | |
| user_id | UUID (FK → users) | ON DELETE CASCADE |
| role_id | UUID (FK → roles) | ON DELETE RESTRICT |
| assigned_at | TIMESTAMP | |
| assigned_by | UUID (FK → users) | Who assigned this |

**Constraint:** `UNIQUE(user_id, role_id)` — a user can't have the same role twice.

---

### 6. user_role_projects (junction: user_role ↔ project)

Which projects a user can access **under a specific role**. Proper FK — no JSONB arrays.

| Column | Type | Notes |
|--------|------|-------|
| user_role_project_id | UUID (PK) | |
| user_role_id | UUID (FK → user_roles) | ON DELETE CASCADE |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |

**Constraint:** `UNIQUE(user_role_id, project_id)` — no duplicate project per user-role.

---

## Example Data (Full Walkthrough)

### Scenario: 3 users, 3 projects

**users:**

| user_id | email | name |
|---------|-------|------|
| u1 | tns@aqua.com | TNS |
| u2 | admin@aqua.com | Admin |
| u3 | viewer@aqua.com | Viewer |

**roles:**

| role_id | role_name | role_type | module_feature_assigned |
|---------|-----------|-----------|------------------------|
| r1 | Platform Admin | platform | `{ "modules_access": ["*"], "features_access": ["*"] }` |
| r2 | Farm Manager | project | `{ "modules_access": ["monitoring", "project_management"], "features_access": ["view_overview", "view_digital_twin", ...manage_ponds, ...] }` |
| r3 | Farmer | project | `{ "modules_access": ["monitoring"], "features_access": ["view_overview", "view_digital_twin", ...acknowledge_alerts] }` |
| r4 | Viewer | viewer | `{ "modules_access": ["monitoring"], "features_access": ["view_overview", "view_digital_twin", "view_realtime_forecast", "view_historical"] }` |

**user_roles:**

| user_role_id | user_id | role_id | meaning |
|-------------|---------|---------|---------|
| ur1 | u1 (TNS) | r3 (Farmer) | TNS is a farmer |
| ur2 | u1 (TNS) | r2 (Farm Manager) | TNS is also a farm manager |
| ur3 | u2 (Admin) | r1 (Platform Admin) | Admin has full access |
| ur4 | u3 (Viewer) | r4 (Viewer) | Viewer is read-only |

**user_role_projects:**

| user_role_project_id | user_role_id | project_id | meaning |
|---------------------|-------------|------------|---------|
| urp1 | ur1 (TNS+Farmer) | proj_A | TNS as farmer → Project A |
| urp2 | ur1 (TNS+Farmer) | proj_C | TNS as farmer → Project C |
| urp3 | ur2 (TNS+Manager) | proj_B | TNS as manager → Project B |
| urp4 | ur4 (Viewer+Viewer) | proj_A | Viewer → Project A only |
| *(none)* | ur3 (Admin+Platform Admin) | *(none)* | Platform admin — no rows needed, sees everything |


## Summary: All Tables for User & Access Control

| # | Table | Type | Purpose |
|---|-------|------|---------|
| 1 | `users` | Entity | User profile |
| 2 | `roles` | Entity | Role definitions with role_type and JSONB module/feature access |
| 3 | `module_access` | Reference | Valid modules in the system (source of truth for JSONB codes) |
| 4 | `feature_access` | Reference | Valid features in the system (belongs to a module) |
| 5 | `user_roles` | Junction | User ↔ Role (one user can have many roles) |
| 6 | `user_role_projects` | Junction | User-Role ↔ Project (which projects per role, proper FK) |

---

*Last updated: April 16, 2026*
