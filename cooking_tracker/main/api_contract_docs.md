# API Contract Documentation

## Target

| Item | Selection |
|---|---|
| Public API style | REST/JSON |
| Contract format | OpenAPI |
| Gateway path | `/api/**` |
| Auth | Bearer JWT unless explicitly public |
| Error format | Consistent problem/error response |

## Contract Checklist

| Status | Item | Output |
|---|---|---|
| [ ] | OpenAPI file per public service | Versioned API spec |
| [ ] | Shared error response model | Consistent error contract |
| [ ] | Auth/security schemes | JWT bearer scheme |
| [ ] | Request validation schema | Body/query/path parameter schemas |
| [ ] | Response schemas | DTO definitions |
| [ ] | Pagination/filtering standard | Common list pattern |
| [ ] | API versioning convention | `/api/v1` or header policy |
| [ ] | Contract tests | API compatibility checks |
| [ ] | API docs export | Report-ready API contract |

## OpenAPI File Catalogue

| Status | Service | OpenAPI File | Source |
|---|---|---|---|
| [ ] | Project Service | `shared-api/openapi/project-service.v1.yaml` | Django `module_project` and active frontend call sites |

## API Ownership Map

| API Group | Owner Service |
|---|---|
| `/api/auth/**` | Identity and Access Service |
| `/api/users/**` | Identity and Access Service |
| `/api/roles/**` | Identity and Access Service |
| `/api/projects/**` | Project Service |
| `/api/profile-types/**` | Project Service |
| `/api/parameters/**` | Project Service |
| `/api/ponds/**` | Pond Service |
| `/api/cycles/**` | Pond Service |
| `/api/sensor-types/**` | Sensor Service |
| `/api/iot-devices/**` | Sensor Service |
| `/api/project-sensors/**` | Sensor Service |
| `/api/alerts/**` | Notification Service |
| `/api/notifications/**` | Notification Service |
| `/api/analytics/**` | Analytics Service |
| `/api/audit/**` | Audit Service |

## Endpoint Template

| Field | Required |
|---|---|
| Endpoint path | Yes |
| HTTP method | Yes |
| Owner service | Yes |
| Auth requirement | Yes |
| Request path parameters | If applicable |
| Query parameters | If applicable |
| Request body schema | If applicable |
| Success response schema | Yes |
| Error response schema | Yes |
| Audit event | If user/admin action |
| Rate-limit rule | If sensitive/high traffic |

## Error Model

| Field | Meaning |
|---|---|
| `code` | Stable machine-readable error code |
| `message` | Safe user-facing message |
| `correlationId` | Trace/debug correlation |
| `details` | Optional validation details |
| `timestamp` | Error timestamp |

## Considerations

| Topic | Guidance |
|---|---|
| Existing business logic | Before implementing or changing any API contract, the implementation agent must read the current monolith repo and preserve the same business behavior unless a deliberate change is documented. |
| API extraction | Treat the monolith APIs and frontend call sites as the source for required request/response behavior. |
| Contract changes | Do not invent new endpoint shapes when an existing frontend/monolith contract already works. |
| Ownership changes | If an API moves to a new microservice, keep the external behavior stable and only change the internal owner. |
| Validation rules | Copy existing validation, permission checks, filters, and error cases from the monolith before improving them. |
| Frontend compatibility | Existing frontend pages should continue working against the new contract unless the page is intentionally refactored. |
