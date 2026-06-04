# Analytics Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | TypeScript |
| Runtime | Node.js |
| Framework | Express |
| Chart metadata/config store | Cloud SQL PostgreSQL |
| Operational time-series source | Cloud Bigtable |
| Historical analytics warehouse | BigQuery |
| Cache | Redis/Memorystore for chart metadata and carefully scoped short-lived chart packages |
| Public API | REST through API gateway |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Preserve current historical chart contract | Frontend-compatible chart package |
| [ ] | Read chart metadata/config | Enabled chart definitions and parameter settings |
| [ ] | Build chart-ready historical data | Time-series, correlation, and computed chart payloads |
| [ ] | Support configured chart package keys | Return only supported/enabled chart outputs |
| [ ] | BigQuery query controls | Bounded query cost |
| [ ] | Safe metadata caching | Redis cache for chart definitions/config only |
| [ ] | Optional short-lived chart package caching | Strict cache key and TTL |

## Existing Contract To Preserve

The first implementation should preserve the active frontend/Django chart contract.

| Item | Contract |
|---|---|
| Primary endpoint | `GET /api/projects/{projectId}/charts/` |
| Required query params | `pondId`, `startDate`, `endDate` |
| Optional query params | `grouping` |
| Main frontend caller | `apiService.getHistoricalCharts(pondId, projectId, startDate, endDate, grouping)` |
| Main frontend consumer | Historical Trends and Analysis view |

Supported response keys:

| Key | Meaning |
|---|---|
| `multiParameterTrends` | Multi-parameter time-series chart |
| `correlationHeatmap` | Parameter correlation matrix |
| `historicalTrends` | Historical trends of configured key parameters |
| `nitrogenCycle` | Nitrogen-related chart if configured |
| `temperatureTrend` | Temperature single-line chart if configured |
| `dissolvedOxygen` | Dissolved oxygen single-line chart if configured |
| `diseaseRisk` | Disease risk chart if configured |
| `waterQualityIndex` | WQI chart if configured |

Do not introduce separate public endpoints for WQI, disease risk, nitrogen cycle, or individual chart types unless the frontend is intentionally changed later.

## REST API Checklist

| Status | Endpoint | Purpose |
|---|---|---|
| [ ] | `GET /api/projects/{projectId}/charts/` | Main historical chart package |
| [ ] | `GET /api/projects/{projectId}/chart-config/` | Optional chart metadata/config endpoint |

## Explicit Non-Ownership

| API/Feature | Owning Service |
|---|---|
| Pond comparison | Pond Service |
| Energy dashboard | Project Service |
| Pond/cycle health timeline | Pond Service |
| Project/profile/threshold configuration | Project Service |

## Chart Metadata / Config Checklist

| Status | Data | Store |
|---|---|---|
| [ ] | `visualisation_types` | Cloud SQL |
| [ ] | `project_visualisations` | Cloud SQL |
| [ ] | `chart_parameters` | Cloud SQL |
| [ ] | `chart_parameter_profiles` | Cloud SQL |
| [ ] | `profile_chart_links` | Cloud SQL |
| [ ] | `profile_overrides` | Cloud SQL |
| [ ] | `chart_visualizations` | Cloud SQL materialized/precomputed read model if used |

## BigQuery Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create bounded demo dataset | Cost-safe analytics |
| [ ] | Create partitioned readings table | Date-bounded query path |
| [ ] | Create clustered columns | Project/pond/device/parameter filters |
| [ ] | Create hourly summary table/view | Chart-friendly data |
| [ ] | Create daily summary table/view | Historical dashboard data |
| [ ] | Set `maximum_bytes_billed` | Query cost cap |
| [ ] | Avoid unbounded dashboard queries | Date/project/pond filters required |

## Bigtable Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Read operational time-series by pond/time range | Chart data source |
| [ ] | Keep query patterns aligned to row-key design | Efficient range reads |
| [ ] | Apply project/pond/date filters on every request | Bounded query scope |
| [ ] | Return chart-ready grouped values | Frontend-ready payload |
| [ ] | Avoid relational joins in Bigtable | Metadata comes from Cloud SQL |

## Cache Checklist

| Status | Cache Entry | TTL/Invalidation |
|---|---|---|
| [ ] | Chart type catalogue | TTL plus invalidation on chart config change |
| [ ] | Project chart configuration | TTL plus invalidation on project visualisation update |
| [ ] | Chart parameter labels/colors/order | TTL plus invalidation on chart parameter update |
| [ ] | Profile chart links | TTL plus invalidation on profile chart update |
| [ ] | Project chart overrides | TTL plus invalidation on override update |
| [ ] | Optional chart package | Very short TTL; key must include projectId, pondId, startDate, endDate, grouping, parameters, and config version |

Do not cache:

| Data | Rule |
|---|---|
| Raw sensor readings | Do not cache in Redis |
| Business records | Do not treat Redis as source of truth |
| User/project authorization | Do not cache as Analytics-owned data |
| Unbounded historical chart results | Do not cache without strict query key and TTL |

## Event Position

No Analytics Service event consumers are required for the current implementation.

Future event-driven aggregation can be added later if heavy chart precomputation is implemented.

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Historical chart package request | Frontend-compatible response returned |
| [ ] | Query cost cap exceeded | Request fails safely |
| [ ] | Metadata cache hit | Repeated chart metadata lookup uses Redis |
| [ ] | Raw reading cache check | Raw readings are not stored in Redis |
| [ ] | Unauthorized project | Request denied |

## Considerations

| Topic | Guidance |
|---|---|
| Scope | Keep this service focused on the historical chart package and chart-ready analytics payloads. |
| Existing behavior | Follow the active Django/frontend contract before designing new API shapes. |
| Framework | Use Express because the target service is TypeScript/Node.js and Express is the selected implementation style. |
| Ownership boundary | Do not move Pond comparison, Energy dashboard, cycle health, project/profile settings, alerts, or digital twin realtime APIs into this service. |
| Chart config ownership | Prefer Project Service ownership for project/profile/chart configuration; Analytics can call Project Service over gRPC to retrieve enabled chart config. |
| Analytics-owned data | Analytics may own materialized/precomputed chart read models only if they are generated outputs, not source-of-truth project configuration. |
| Bigtable usage | Use Bigtable for operational time-series chart reads by pond/time range. |
| BigQuery usage | Use BigQuery for long-range historical analytics, reports, summaries, management dashboards, and future ML feature generation. Do not force BigQuery into every chart request. |
| Current implementation | The first chart endpoint can work mainly from Project Service chart config plus Bigtable time-series reads. |
| Cost control | BigQuery queries must be bounded by project, pond, date range, and selected parameters; use query limits and avoid unbounded scans. |
| Cache safety | Cache chart metadata/config carefully; do not cache raw sensor readings or mutable business records in Redis. |
| Event usage | Do not add event consumers for current scope. Add event-driven aggregation only if chart precomputation becomes a real implementation requirement. |
| API expansion | Add new chart-specific endpoints only if the frontend contract is intentionally changed. |
