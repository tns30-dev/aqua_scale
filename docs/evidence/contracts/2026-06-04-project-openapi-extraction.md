# Project Service OpenAPI Extraction - 2026-06-04

## Scope

Extracted the Project Service public REST parity contract from the current Django monolith and active frontend callers.

## Sources

| Source | Used For |
|---|---|
| `AquaMonitoringv2/backend/module_project/urls.py` | Router-mounted endpoint catalogue |
| `AquaMonitoringv2/backend/module_project/views.py` | Project actions, validation behavior, error shapes |
| `AquaMonitoringv2/backend/module_project/serializers.py` | Project/profile/parameter/growth catalogue response fields |
| `AquaMonitoringv2/backend/module_project/services/energy_dashboard.py` | Energy dashboard response shape |
| `AquaMonitoringv2/frontend/src/services/api.service.ts` | Active frontend call paths and query params |
| `AquaMonitoringv2/frontend/src/types/index.ts` | Project summary, cycle, pond comparison response shapes |
| `AquaMonitoringv2/frontend/src/components/energy/types.ts` | Energy dashboard frontend type contract |

## Output

| Contract | Location |
|---|---|
| Project Service OpenAPI v1 | `shared-api/openapi/project-service.v1.yaml` |

## Validation

| Command | Result |
|---|---|
| `ruby -e 'require "yaml"; YAML.load_file("shared-api/openapi/project-service.v1.yaml")'` | PASS |

## Notes

Some project-mounted routes are legacy/project-gateway routes whose long-term owner may be another service:

| Route Group | Current Mount | Target Ownership Note |
|---|---|---|
| `/projects/{projectId}/charts/` | ProjectViewSet action | Analytics owns chart implementation later, but external path must remain frontend-compatible. |
| `/projects/{projectId}/cycles/` | ProjectViewSet action | Pond owns cycle data later, but current frontend path must remain stable. |
| `/projects/{projectId}/pond-comparison/**` | ProjectViewSet action | Pond owns comparison logic later, but current frontend path must remain stable. |
| `/projects/{projectId}/energy/**` | ProjectViewSet action | Project owns current energy dashboard/settings behavior. |
