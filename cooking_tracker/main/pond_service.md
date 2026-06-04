# Pond Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | Java |
| Framework | Spring Boot |
| Database | Cloud SQL PostgreSQL |
| Cache | Redis/Memorystore for pond summary/status views |
| Public API | REST through API gateway |
| Internal API | gRPC |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Pond CRUD | Pond metadata and status |
| [ ] | Pond photo/reference metadata | Stored object reference |
| [ ] | Cycle CRUD | Growth cycle records |
| [ ] | Current cycle lookup | Active cycle per pond |
| [ ] | Daily health records | Historical health timeline |
| [ ] | Stage metrics | Stage-level performance metrics |
| [ ] | Treatment records if included | Treatment history |
| [ ] | Pond summary views | Dashboard-friendly read models |
| [ ] | Pond comparison | Multi-pond comparison metrics and charts |
| [ ] | Internal pond/cycle lookup | gRPC lookup methods |

## Data Ownership

| Entity/Table | Purpose |
|---|---|
| `ponds` | Pond metadata, status, GPS, photo URL, biomass metadata |
| `cycles` | Pond production/growth cycles |
| `cycle_daily_health` | Day-by-day health status |
| `cycle_stage_metrics` | Stage metrics such as growth, FCR, mortality |
| `pond_treatments` or equivalent | Optional treatment events |

## REST API Checklist

| Status | Endpoint | Purpose |
|---|---|---|
| [ ] | `GET /api/projects/{projectId}/ponds` | List project ponds |
| [ ] | `POST /api/projects/{projectId}/ponds` | Create pond |
| [ ] | `GET /api/ponds/{pondId}` | Pond detail |
| [ ] | `PATCH /api/ponds/{pondId}` | Update pond |
| [ ] | `GET /api/ponds/{pondId}/cycles` | List cycles |
| [ ] | `POST /api/ponds/{pondId}/cycles` | Start cycle |
| [ ] | `GET /api/cycles/{cycleId}` | Cycle detail |
| [ ] | `GET /api/cycles/{cycleId}/health` | Daily health timeline |
| [ ] | `GET /api/cycles/{cycleId}/stage-metrics` | Stage metrics |
| [ ] | `GET /api/projects/{projectId}/pond-comparison/options` | Pond comparison selectable options |
| [ ] | `POST /api/projects/{projectId}/pond-comparison` | Pond comparison result |

## gRPC Contract Checklist

| Status | RPC | Purpose |
|---|---|---|
| [ ] | `GetPond` | Pond lookup |
| [ ] | `GetPondsByProject` | Project pond lookup |
| [ ] | `GetCurrentCycle` | Active cycle lookup |
| [ ] | `ValidatePondInProject` | Membership validation |
| [ ] | `GetPondSummary` | Dashboard summary lookup |

## Cache Checklist

| Status | Cache Entry | Invalidated By |
|---|---|---|
| [ ] | Pond list per project | Pond create/update/delete |
| [ ] | Pond summary/status | Reading/alert/status events |
| [ ] | Current cycle | Cycle start/end/update |
| [ ] | Cycle detail | Cycle update |
| [ ] | Pond comparison option set | Pond/project/profile changes |

## Events

| Status | Event | Purpose |
|---|---|---|
| [ ] | `pond.created` | Dependent service refresh |
| [ ] | `pond.updated` | Cache invalidation |
| [ ] | `cycle.started` | Dashboard and analytics update |
| [ ] | `cycle.completed` | Historical/reporting update |
| [ ] | `audit.event.recorded` | Admin activity audit |

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Create pond under project | Pond stored |
| [ ] | Start cycle | Active cycle visible |
| [ ] | Current cycle lookup by gRPC | Correct cycle returned |
| [ ] | Pond comparison request | Multi-pond response returned |
| [ ] | Read-heavy pond list | Read path works |
| [ ] | Unauthorized pond access | Request denied |
