# User & Access Control — Class Diagram

---

## Current State (what exists)

- `User` model extends `AbstractBaseUser` — email-based auth, `managed=False`
- `Role` model — old composite PK (project_id + user_id), just `'admin'` or `'user'` string
- No `UserRole`, `UserRoleProject`, `ModuleAccess`, `FeatureAccess` models

---

## Refined Class Diagram (6 classes)

### 1. User

```
┌──────────────────────────────────────────┐
│                  User                    │
├──────────────────────────────────────────┤
│ - user_id: UUID                          │
│ - email: String                          │
│ - password_hash: String                  │
│ - name: String                           │
│ - mobile_number: String                  │
│ - created_at: Timestamp                  │
│ - updated_at: Timestamp                  │
├──────────────────────────────────────────┤
│ + get_full_name(): String                │
│ + get_short_name(): String               │
│ + set_password(raw_password: String): void│
│ + check_password(raw_password: String): Boolean│
│ + get_available_roles(): List<UserRole>  │
│ + get_projects_for_role(role_id: UUID): List<Project>│
│ + has_role(role_type: String): Boolean   │
│ + update_profile(name: String, mobile_number: String): void│
└──────────────────────────────────────────┘
```

**Attributes:** Same as ERD `users` table.

**Methods:**
- `get_full_name()` / `get_short_name()` — inherited from Django AbstractBaseUser
- `set_password()` / `check_password()` — Django password hashing
- `get_available_roles()` — **NEW** — returns all roles assigned to this user (for login role selection)
- `get_projects_for_role(role_id)` — **NEW** — returns projects accessible under a specific role
- `has_role(role_type)` — **NEW** — checks if user has a specific role type

---

### 2. Role

```
┌──────────────────────────────────────────┐
│                  Role                    │
├──────────────────────────────────────────┤
│ - role_id: UUID                          │
│ - role_type: String                      │
│ - role_name: String                      │
│ - module_feature_assigned: JSONB         │
│ - created_at: Timestamp                  │
│ - created_by: UUID                       │
│ - updated_at: Timestamp                  │
│ - updated_by: UUID                       │
├──────────────────────────────────────────┤
│ + has_module_access(module_code: String): Boolean│
│ + has_feature_access(feature_code: String): Boolean│
│ + get_modules(): List<String>            │
│ + get_features(): List<String>           │
│ + is_platform_admin(): Boolean           │
└──────────────────────────────────────────┘
```

**Methods:**
- `has_module_access(module_code)` — checks if `"*"` or code is in `module_feature_assigned.modules_access`
- `has_feature_access(feature_code)` — checks if `"*"` or code is in `module_feature_assigned.features_access`
- `get_modules()` / `get_features()` — returns the list from JSONB
- `is_platform_admin()` — shortcut: checks if modules_access contains `"*"`

---

### 3. UserRole

```
┌──────────────────────────────────────────┐
│                UserRole                  │
├──────────────────────────────────────────┤
│ - user_role_id: UUID                     │
│ - user_id: UUID                          │
│ - role_id: UUID                          │
│ - assigned_at: Timestamp                 │
│ - assigned_by: UUID                      │
├──────────────────────────────────────────┤
│ + get_projects(): List<Project>          │
│ + assign_project(project_id: UUID): void │
│ + remove_project(project_id: UUID): void │
└──────────────────────────────────────────┘
```

**Methods:**
- `get_projects()` — returns all projects linked to this user-role via `UserRoleProject`
- `assign_project()` / `remove_project()` — add/remove project access for this role assignment

---

### 4. UserRoleProject

```
┌──────────────────────────────────────────┐
│            UserRoleProject               │
├──────────────────────────────────────────┤
│ - user_role_project_id: UUID             │
│ - user_role_id: UUID                     │
│ - project_id: UUID                       │
├──────────────────────────────────────────┤
│                                          │
└──────────────────────────────────────────┘
```

**Methods:** None — pure junction class. No business logic.

---

### 5. ModuleAccess

```
┌──────────────────────────────────────────┐
│             ModuleAccess                 │
├──────────────────────────────────────────┤
│ - module_access_id: UUID                 │
│ - name: String                           │
│ - code: String                           │
├──────────────────────────────────────────┤
│                                          │
└──────────────────────────────────────────┘
```

**Methods:** None — reference/lookup table only.

---

### 6. FeatureAccess

```
┌──────────────────────────────────────────┐
│            FeatureAccess                 │
├──────────────────────────────────────────┤
│ - feature_access_id: UUID                │
│ - name: String                           │
│ - code: String                           │
├──────────────────────────────────────────┤
│                                          │
└──────────────────────────────────────────┘
```

**Methods:** None — reference/lookup table only.

---

## Relationships

```
User "1" ──────── "*" UserRole          : has          (Association)
Role "1" ──────── "*" UserRole          : assigned to  (Association)
UserRole "1" ◆── "*" UserRoleProject    : has          (Composition)
Project "1" ──── "*" UserRoleProject    : accessed via (Association)
User "1" ──────── "*" Role              : creates      (Association — created_by/updated_by)
```

### Why these relationship types?

| Relationship | Type | Why |
|---|---|---|
| User → UserRole | **Association** | User exists independently. Deleting a user cascades to UserRole, but user is not "made of" roles |
| Role → UserRole | **Association** | Role exists independently as a definition. Many users can share the same role |
| UserRole → UserRoleProject | **Composition** ◆ | UserRoleProject **cannot exist** without its parent UserRole. Delete the role assignment = project access is gone. It's a "part of" the role assignment |
| Project → UserRoleProject | **Association** | Project exists independently. It's just referenced, not owned |
| ModuleAccess, FeatureAccess | **Independent** | No direct relationship to other classes. Referenced only via JSONB codes in `Role.module_feature_assigned` |

---

## Discussion Point

**Should `ModuleAccess` and `FeatureAccess` have a relationship?**

In the ERD, they're independent (no FK). But conceptually, a feature belongs to a module (e.g., "View Overview" belongs to "Monitoring"). We discussed adding `module_access_id` FK to `feature_access` in the ERD — but then decided not to.

For the class diagram, I kept them independent. If we add the FK later, it would be:

```
ModuleAccess "1" ◇── "*" FeatureAccess  : contains   (Aggregation)
```

Aggregation because features can conceptually exist without a specific module grouping — the module is just an organizational container.

---

*Last updated: April 19, 2026*