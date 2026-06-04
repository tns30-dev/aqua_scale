# Project Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | Java |
| Framework | Spring Boot |
| Database | Cloud SQL PostgreSQL |
| Cache | Redis/Memorystore for catalogue and settings cache |
| Public API | REST through API gateway |
| Internal API | gRPC |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Project CRUD | Project records |
| [ ] | Profile type CRUD | Shrimp, fish, crab hatchery, treatment profiles |
| [ ] | Parameter type catalogue | Water quality parameter catalogue |
| [ ] | Project parameter settings | Min/max thresholds and key parameter indicator |
| [ ] | Growth stage configuration | Stage definitions for cycle/historical views |
| [ ] | Key indicator configuration | Profile/project dashboard indicators |
| [ ] | Energy dashboard settings and API | Project energy usage summaries |
| [ ] | Visualisation configuration ownership check | Project chart enablement if assigned here |
| [ ] | Internal lookup for thresholds/settings | gRPC lookup methods |
| [ ] | Settings cache invalidation | Redis entries refreshed |

## Data Ownership

| Entity/Table | Purpose |
|---|---|
| `projects` | Farm/project metadata and owner |
| `profile_types` | Profile templates and stage/key indicator config |
| `parameter_types` | Parameter names, codes, units, data types |
| `project_parameter_settings` | Per-project threshold and key parameter settings |
| `project_energy_settings` or equivalent | Project energy dashboard configuration |
| `project_visualisations` | Optional project chart configuration |
| `visualisation_types` | Optional chart type catalogue |

## REST API Checklist

| Status | Endpoint | Purpose |
|---|---|---|
| [ ] | `GET /api/projects` | List accessible projects |
| [ ] | `POST /api/projects` | Create project |
| [ ] | `GET /api/projects/{projectId}` | Project detail |
| [ ] | `PATCH /api/projects/{projectId}` | Update project |
| [ ] | `GET /api/profile-types` | List profile types |
| [ ] | `GET /api/parameters` | Parameter catalogue |
| [ ] | `GET /api/projects/{projectId}/parameter-settings` | Project thresholds/settings |
| [ ] | `PUT /api/projects/{projectId}/parameter-settings` | Replace/update settings |
| [ ] | `GET /api/projects/{projectId}/energy` | Energy dashboard |
| [ ] | `PUT /api/projects/{projectId}/energy-settings` | Energy dashboard settings |

## gRPC Contract Checklist

| Status | RPC | Purpose |
|---|---|---|
| [ ] | `GetProject` | Project lookup by ID |
| [ ] | `GetProfileType` | Profile type lookup |
| [ ] | `GetParameterSettings` | Threshold/key parameter lookup |
| [ ] | `GetParameterCatalogue` | Parameter metadata lookup |
| [ ] | `ValidateProjectAccess` | Project existence/access helper if needed |

## Cache Checklist

| Status | Cache Entry | Invalidated By |
|---|---|---|
| [ ] | Profile type catalogue | Profile type create/update |
| [ ] | Parameter catalogue | Parameter create/update |
| [ ] | Project parameter settings | Settings update |
| [ ] | Growth stage config | Profile/project config update |
| [ ] | Key indicators | Profile/project config update |
| [ ] | Energy dashboard settings | Energy settings update |

## Events

| Status | Event | Purpose |
|---|---|---|
| [ ] | `project.created` | Notify dependent services |
| [ ] | `project.updated` | Cache invalidation and audit |
| [ ] | `project.settings.updated` | Threshold/settings cache invalidation |
| [ ] | `audit.event.recorded` | Admin activity audit |

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Create project | Project stored |
| [ ] | Update parameter settings | Settings saved and cache invalidated |
| [ ] | gRPC threshold lookup | Correct thresholds returned |
| [ ] | Energy dashboard request | Project energy summary returned |
| [ ] | Read replica query | Catalogue/read-only endpoint uses read path where configured |
| [ ] | Unauthorized project access | Request denied |
