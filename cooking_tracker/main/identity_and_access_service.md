# Identity And Access Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | Java |
| Framework | Spring Boot, Spring Security |
| Database | Cloud SQL PostgreSQL |
| Public API | REST through API gateway |
| Internal API | gRPC |
| Token model | JWT access token, refresh token, Redis-backed authorization snapshot |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Login | Authenticated token response |
| [ ] | Logout | Token/session invalidation |
| [ ] | Refresh token | New access token |
| [ ] | User profile | Profile read/update |
| [ ] | User management | Admin CRUD |
| [ ] | Role type management | Module/feature permission model |
| [ ] | Project access management | User-project assignment |
| [ ] | Authorization snapshot build | Redis-backed feature access and ACL snapshot |
| [ ] | Authorization snapshot invalidation | Updated access reflected across services |
| [ ] | Internal access support | gRPC fallback/support response when required |
| [ ] | Security audit events | Audit events published |

## Data Ownership

| Entity/Table | Purpose |
|---|---|
| `users` | User identity and profile |
| `role_types` | Role names and module/feature assignments |
| `feature_permissions` or equivalent | Module/feature/action permission source |
| `user_project_access` or equivalent | User-to-project access |
| `user_pond_access` or derived equivalent | User-to-pond access if required by UI/API |
| `refresh_tokens` or equivalent | Refresh token state if stored |
| `authorization_snapshot` Redis entries | Hot-path authorization read model |
| `token_revocations` Redis entries | Short-lived revocation state |

## REST API Checklist

| Status | Endpoint | Purpose |
|---|---|---|
| [ ] | `POST /api/auth/login` | Login |
| [ ] | `POST /api/auth/refresh` | Refresh access token |
| [ ] | `POST /api/auth/logout` | Logout |
| [ ] | `GET /api/auth/me` | Current user profile |
| [ ] | `PATCH /api/auth/me` | Update user profile |
| [ ] | `GET /api/users` | Admin list users |
| [ ] | `POST /api/users` | Admin create user |
| [ ] | `PATCH /api/users/{userId}` | Admin update user |
| [ ] | `GET /api/roles` | List role types |
| [ ] | `POST /api/roles` | Create role type |

## gRPC Contract Checklist

| Status | RPC | Purpose |
|---|---|---|
| [ ] | `ValidateToken` | Validate token for internal callers if needed |
| [ ] | `GetAuthorizationSnapshot` | Rebuild or return the Redis authorization snapshot when required |
| [ ] | `GetUserAccess` | Return projects and permissions for admin/support use cases |
| [ ] | `AuthorizeAction` | Fallback explicit authorization check only when Redis snapshot is missing, stale, or high-risk action requires fresh verification |
| [ ] | `GetProjectUsers` | Return users assigned to a project |

## Integration Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Publish `audit.event.recorded` for login success/failure | Audit trail |
| [ ] | Build Redis authorization snapshot after login | Feature access and ACL available for services |
| [ ] | Publish access-change event | Downstream snapshot invalidation |
| [ ] | Invalidate Redis authorization snapshot on role/project access change | Stale access removed |
| [ ] | Store token revocation in Redis | Fast logout/revocation checks |
| [ ] | Add OpenTelemetry tracing | Auth request traces |
| [ ] | Add rate-limit counters at edge/cache | Login abuse control |

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Login success | Token returned |
| [ ] | Login failure | Safe error response |
| [ ] | Expired token | Request rejected |
| [ ] | Unauthorized role | Action denied |
| [ ] | Redis authorization snapshot | Feature access and ACL available after login |
| [ ] | Snapshot invalidation | Removed access denied without waiting for JWT expiry |
| [ ] | Internal gRPC fallback authorization | Correct allow/deny result when fallback is required |
| [ ] | User update | Audit event emitted |

## Considerations

| Topic | Guidance |
|---|---|
| Source of truth | Cloud SQL remains the source of truth for users, roles, feature permissions, and project/pond/device access. |
| Hot-path authorization | Redis/Memorystore stores the hot-path authorization snapshot for feature access and access control lists. Normal backend requests should use this snapshot instead of calling Identity and Access Service for every authorization decision. |
| Snapshot owner | Identity and Access Service owns building, refreshing, and invalidating the Redis authorization snapshot. Other services consume the snapshot but do not own it. |
| JWT relationship | JWT should carry `sub`, role/type summary, `jti`, expiry, and an authorization snapshot version or key. Do not put the full feature matrix and ACL into the JWT. |
| Service behavior | Services validate JWT locally, load the matching Redis authorization snapshot, and apply their own resource/action authorization checks from that snapshot. |
| gRPC role | Identity gRPC authorization is not the normal hot path. Use it for snapshot rebuild, cache miss recovery, stale version handling, admin/support queries, or high-risk actions that require fresh verification. |
| Existing monolith logic | During implementation, read the current Django `module_user` authorization behavior and preserve the business rules in the new Redis-backed snapshot model. |
| Invalidation | Role, permission, project access, pond access, and user status changes must invalidate or version-bump the Redis snapshot. |
| Failure mode | If a protected route requires ACL data and the Redis snapshot is missing or stale, fail closed or rebuild through Identity before allowing the action. |
