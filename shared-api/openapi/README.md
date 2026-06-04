# OpenAPI Contracts

Public REST contracts live here after they are extracted from the current Django monolith and frontend call sites.

| File | Owner Service | Source |
|---|---|---|
| `project-service.v1.yaml` | Project Service | `module_project`, frontend `api.service.ts`, frontend response types |

These contracts are parity targets. Do not change endpoint paths or response shapes unless the frontend is intentionally changed.
