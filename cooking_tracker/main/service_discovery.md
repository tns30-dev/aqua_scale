# Service Discovery And Mesh Checklist

## Target

| Item | Selection |
|---|---|
| Baseline service discovery | Kubernetes Service DNS |
| Internal protocol | gRPC over HTTP/2 |
| Mesh | Istio-compatible Google Cloud Service Mesh |
| Service identity | Kubernetes ServiceAccount |
| Internal security | Strict mTLS and AuthorizationPolicy |
| Multi-cloud registry | Service Directory only if needed |

## Naming Checklist

| Status | Service | DNS Name |
|---|---|---|
| [ ] | Identity and Access | `identity-access-service.<namespace>.svc.cluster.local` |
| [ ] | Project Service | `project-service.<namespace>.svc.cluster.local` |
| [ ] | Pond Service | `pond-service.<namespace>.svc.cluster.local` |
| [ ] | Sensor Service | `sensor-service.<namespace>.svc.cluster.local` |
| [ ] | Ingestion Service | `ingestion-service.<namespace>.svc.cluster.local` |
| [ ] | Notification Service | `notification-service.<namespace>.svc.cluster.local` |
| [ ] | Analytics Service | `analytics-service.<namespace>.svc.cluster.local` |
| [ ] | Audit Service | `audit-service.<namespace>.svc.cluster.local` |
| [ ] | Realtime Gateway | `realtime-gateway.<namespace>.svc.cluster.local` |

## Mesh Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Enable sidecar injection for service namespace | Pods receive mesh sidecar |
| [ ] | Create ServiceAccount per service | Workload identity separation |
| [ ] | Enable strict mTLS | PeerAuthentication applied |
| [ ] | Create AuthorizationPolicy per service | Only expected callers allowed |
| [ ] | Permit health checks | Probes continue working |
| [ ] | Permit metrics scraping | Monitoring continues working |
| [ ] | Add gRPC traffic policy | HTTP/2/gRPC visibility |
| [ ] | Add telemetry dashboards | Service dependency evidence |
| [ ] | Add canary policy if needed | Traffic split ready |

## Caller Policy Checklist

| Status | Callee | Allowed Callers |
|---|---|---|
| [ ] | Identity and Access | API edge, selected internal services |
| [ ] | Project Service | API edge, Notification, Analytics |
| [ ] | Pond Service | API edge, Notification, Analytics |
| [ ] | Sensor Service | API edge, Ingestion |
| [ ] | Notification Service | API edge, Ingestion-derived flows |
| [ ] | Analytics Service | API edge |
| [ ] | Audit Service | API edge for queries, all services for audit events |
| [ ] | Realtime Gateway | API edge and selected internal push callers |

## Internal gRPC Endpoint Map

| Callee | Kubernetes DNS Target | Port | RPCs | Consumers |
|---|---|---:|---|---|
| Project Service | `project-service.<namespace>.svc.cluster.local` | `9092` | `GetProject`, `GetProfileType`, `GetParameterSettings`, `GetParameterCatalogue`, `ValidateProjectAccess`, `GetChartConfig` | Pond, Notification, Analytics, selected internal helpers |
| Pond Service | `pond-service.<namespace>.svc.cluster.local` | `9094` | `GetPond`, `GetPondsByProject`, `GetCurrentCycle`, `ValidatePondInProject`, `GetPondSummary` | Analytics, Notification, Realtime, selected internal helpers |
| Ingestion Service | `ingestion-service.<namespace>.svc.cluster.local` | `9095` | `GetReadings` | Analytics now; Pond comparison and Project energy dashboard if assigned later |

## New Analytics gRPC Seams

| Seam | Owner | Consumer | Notes |
|---|---|---|---|
| `ProjectService.GetChartConfig` | Project Service | Analytics Service | Project owns chart metadata tables and resolves visualisation `y_parameters` to parameter codes. |
| `IngestionReadService.GetReadings` | Ingestion Service | Analytics Service | Ingestion owns telemetry read access; callers receive time-range rows ordered by `measured_at ASC` with a bounded limit and `truncated` flag. |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | DNS resolution inside pod | Service name resolves |
| [ ] | Allowed gRPC call | Call succeeds |
| [ ] | Disallowed caller | Call denied by policy |
| [ ] | mTLS status | Mesh reports encrypted service traffic |
| [ ] | Service graph | Calls visible in telemetry |
