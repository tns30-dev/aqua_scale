# User & Access Control — ERD Finalization

---

## Current State

### users
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (PK) | `gen_random_uuid()` |
| email | VARCHAR(255) | Unique |
| password_hash | VARCHAR(255) | |
| name | VARCHAR(255) | |
| created_at | TIMESTAMP | |

### roles (old — to be replaced)
| Column | Type | Notes |
|--------|------|-------|
| project_id | UUID (PK, FK → projects) | Composite PK |
| user_id | UUID (PK, FK → users) | Composite PK |
| role | VARCHAR | `'admin'` or `'user'` |

---

## Refined Schema (6 Tables)

### 1. users

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (PK) | |
| email | VARCHAR(255) | Unique |
| password_hash | VARCHAR(255) | |
| name | VARCHAR(255) | |
| mobile_number | VARCHAR(20) | NEW — per Satish |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | NEW |

> No role or project info here. Handled by `user_roles` + `user_role_projects`.

---

### 2. role_types

Defines named roles. Module/feature access is stored as JSONB on this table.

| Column | Type | Notes |
|--------|------|-------|
| role_type_id | UUID (PK) | |
| role_name | VARCHAR(100) | Unique. e.g., `'platform_admin'`, `'farm_manager'`, `'farmer'`, `'viewer'` |
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
| role_type_id | UUID (FK → role_types) | ON DELETE RESTRICT |
| assigned_at | TIMESTAMP | |
| assigned_by | UUID (FK → users) | Who assigned this |

**Constraint:** `UNIQUE(user_id, role_type_id)` — a user can't have the same role twice.

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

**role_types:**

| role_type_id | role_name | module_feature_assigned |
|-------------|-----------|------------------------|
| rt1 | platform_admin | `{ "modules_access": ["*"], "features_access": ["*"] }` |
| rt2 | farm_manager | `{ "modules_access": ["monitoring", "project_management"], "features_access": ["view_overview", "view_digital_twin", ...manage_ponds, ...] }` |
| rt3 | farmer | `{ "modules_access": ["monitoring"], "features_access": ["view_overview", "view_digital_twin", ...acknowledge_alerts] }` |
| rt4 | viewer | `{ "modules_access": ["monitoring"], "features_access": ["view_overview", "view_digital_twin", "view_realtime_forecast", "view_historical"] }` |

**user_roles:**

| user_role_id | user_id | role_type_id | meaning |
|-------------|---------|-------------|---------|
| ur1 | u1 (TNS) | rt3 (farmer) | TNS is a farmer |
| ur2 | u1 (TNS) | rt2 (farm_manager) | TNS is also a farm manager |
| ur3 | u2 (Admin) | rt1 (platform_admin) | Admin has full access |
| ur4 | u3 (Viewer) | rt4 (viewer) | Viewer is read-only |

**user_role_projects:**

| user_role_project_id | user_role_id | project_id | meaning |
|---------------------|-------------|------------|---------|
| urp1 | ur1 (TNS+farmer) | proj_A | TNS as farmer → Project A |
| urp2 | ur1 (TNS+farmer) | proj_C | TNS as farmer → Project C |
| urp3 | ur2 (TNS+manager) | proj_B | TNS as manager → Project B |
| urp4 | ur4 (Viewer+viewer) | proj_A | Viewer → Project A only |
| *(none)* | ur3 (Admin+platform_admin) | *(none)* | Platform admin — no rows needed, sees everything |

---

## Login Flow (Satish's Requirement)

### What this means at login:

**TNS logs in:**
```
1. Enters tns@aqua.com → blur
2. Backend finds 2 user_roles: farmer, farm_manager
3. Shows: "Login as Farmer" | "Login as Farm Manager"

4a. Picks "Farmer" →
    Backend queries user_role_projects for ur1 → [proj_A, proj_C]
    role_types.module_feature_assigned → modules + features for farmer
    JWT: { role: farmer, projects: [A, C], modules: [monitoring], features: [view_overview, ...] }
    → Sees Project A and Project C in the panel

4b. Picks "Farm Manager" →
    Backend queries user_role_projects for ur2 → [proj_B]
    role_types.module_feature_assigned → modules + features for farm_manager
    JWT: { role: farm_manager, projects: [B], modules: [monitoring, project_management], features: [view_overview, ..., manage_ponds, ...] }
    → Sees only Project B, with management features enabled
```

**Admin logs in:**
```
1. Enters admin@aqua.com → blur
2. Backend finds 1 user_role: platform_admin
3. Shows: "Login as Platform Admin" (or auto-selects if only one role)
4. No user_role_projects rows → platform admin sees ALL projects
   JWT: { role: platform_admin, projects: [ALL], modules: ["*"], features: ["*"] }
```

**Viewer logs in:**
```
1. Enters viewer@aqua.com → blur
2. Backend finds 1 user_role: viewer
3. Auto-selects viewer (only one role)
4. user_role_projects → [proj_A]
   JWT: { role: viewer, projects: [A], modules: [monitoring], features: [view_overview, view_digital_twin, view_realtime_forecast, view_historical] }
   → Read-only, only Project A
```

---

## Relationships

```
users (1) ──→ (N) user_roles (N) ←── (1) role_types
                      │
                      └──→ (N) user_role_projects (N) ←── (1) projects

module_access (1) ──→ (N) feature_access

role_types.module_feature_assigned JSONB references codes from module_access and feature_access
```

---

## Use Case Mapping

From the use case diagram (System Administrator → View Users → Add/Modify Users):

| Use Case | Table(s) |
|----------|----------|
| Add/Modify name | `users.name` |
| Add/Modify email | `users.email` |
| Set password | `users.password_hash` |
| Assign Role | Insert into `user_roles` (user_id + role_type_id) |
| Assign Multiple Project | Insert into `user_role_projects` (user_role_id + project_id) per project |

> "Assign Role" and "Assign Multiple Project" are a **two-step admin action**: first pick the role, then pick which projects for that role.

From the use case diagram (System Administrator → View Role Type → Add/Modify Role Type):

| Use Case | Table(s) |
|----------|----------|
| Add/Modify name | `role_types.role_name` |
| Assign module access | Update `role_types.module_feature_assigned.modules_access` |
| Assign feature access | Update `role_types.module_feature_assigned.features_access` |

---

## Check Logic

```python
# Backend: On email blur — return available roles
def get_available_roles(email):
    user = Users.objects.get(email=email)
    user_roles = UserRole.objects.filter(user=user).select_related('role_type')
    return [
        {"role_id": ur.role_type_id, "role_name": ur.role_type.role_name}
        for ur in user_roles
    ]

# Backend: On login — validate password + selected role
def login(email, password, selected_role_id):
    user = authenticate(email, password)
    user_role = UserRole.objects.get(user=user, role_type_id=selected_role_id)
    role = user_role.role_type

    # Get projects for this user+role
    project_ids = list(
        UserRoleProject.objects.filter(user_role=user_role)
        .values_list('project_id', flat=True)
    )

    # Get modules and features from JSONB
    modules = role.module_feature_assigned["modules_access"]
    features = role.module_feature_assigned["features_access"]

    return generate_jwt(
        user=user,
        active_role=role.role_name,
        active_user_role_id=user_role.user_role_id,
        project_ids=project_ids,
        modules_access=modules,
        features_access=features,
    )

# Frontend: Dynamic UI rendering
if "monitoring" in token.modules_access:
    show_monitoring_sidebar()

if "view_pond_comparison" in token.features_access:
    show_pond_comparison_page()

# Wildcard check for platform admin
if "*" in token.modules_access:
    show_everything()
```

---

## Summary: All Tables for User & Access Control

| # | Table | Type | Purpose |
|---|-------|------|---------|
| 1 | `users` | Entity | User profile |
| 2 | `role_types` | Entity | Role definitions with JSONB module/feature access |
| 3 | `module_access` | Reference | Valid modules in the system (source of truth for JSONB codes) |
| 4 | `feature_access` | Reference | Valid features in the system (belongs to a module) |
| 5 | `user_roles` | Junction | User ↔ Role (one user can have many roles) |
| 6 | `user_role_projects` | Junction | User-Role ↔ Project (which projects per role, proper FK) |

---

## Open Question for Satish

- The email blur step exposes which roles a user has **before** they enter a password. Is this a security concern? Alternative: show role selection **after** password validation.

---

*Last updated: April 16, 2026*