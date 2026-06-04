# Authentication And Authorization Checklist

## Target

| Item | Selection |
|---|---|
| Auth authority | Identity and Access Service |
| User/profile source of truth | Cloud SQL PostgreSQL |
| Access token | Short-lived JWT |
| Refresh token | Opaque token with Redis-backed rotation/reuse detection |
| Authorization hot path | Redis/Memorystore authorization snapshot |
| Public API validation | Gateway/service validates JWT locally |
| Internal service protection | Istio mTLS and AuthorizationPolicy |
| Deep fallback | Identity gRPC only when Redis snapshot is missing, stale, or fresh verification is required |

## Login Flow

| Step | Action | Output |
|---|---|---|
| 1 | Frontend calls `POST /api/auth/login` | Login request reaches Identity Service |
| 2 | Identity validates credentials, user status, and MFA if enabled | Authenticated user |
| 3 | Identity loads roles, feature permissions, and project/pond/device ACL from Cloud SQL | Source-of-truth access model |
| 4 | Identity writes Redis authorization snapshot | `authz:snapshot:{userId}:{version}` |
| 5 | Identity writes active authorization version | `authz:version:{userId}` |
| 6 | Identity creates JWT with `sub`, `jti`, role summary, expiry, and authz version/key | Access token |
| 7 | Identity creates refresh token state in Redis | Rotatable refresh token |
| 8 | Frontend stores access token in memory and refresh token through secure cookie if used | Authenticated browser session |

## Normal API Request Flow

| Step | Action | Output |
|---|---|---|
| 1 | Frontend sends JWT to backend API | Authenticated request |
| 2 | Gateway/service validates JWT signature, issuer, audience, expiry, and token type locally | Identity proven without Identity gRPC call |
| 3 | Service loads Redis authorization snapshot using user id and authz version/key | Feature access and ACL available |
| 4 | Service checks required feature/action permission | Feature-level allow/deny |
| 5 | Service checks project/pond/device ACL from snapshot | Resource-level allow/deny |
| 6 | Service executes business action only after authorization passes | Authorized response |
| 7 | Service emits audit event for sensitive actions | Audit trail |

## Authorization Snapshot

| Data | Purpose |
|---|---|
| `userId` | User identity from JWT `sub` |
| `version` | Snapshot version tied to JWT |
| `roleType` | Role/category summary |
| `features` | Module/feature/action access list |
| `projectIds` | Project-level ACL |
| `pondIdsByProject` | Pond-level ACL where required |
| `deviceIdsByProject` | Device-level ACL where required |
| `deniedFeatures` | Explicit denies if deny-overrides are required |
| `issuedAt` and `expiresAt` | Snapshot lifecycle |

## Refresh Flow

| Step | Action | Output |
|---|---|---|
| 1 | Frontend calls `POST /api/auth/refresh` | Refresh request |
| 2 | Identity validates refresh token hash and token family in Redis | Reuse detection |
| 3 | Identity rotates refresh token | Old token invalidated |
| 4 | Identity checks active authz version | Current access state known |
| 5 | Identity issues new JWT | Fresh access token |

## Logout And Revocation Flow

| Step | Action | Output |
|---|---|---|
| 1 | Frontend calls `POST /api/auth/logout` | Logout request |
| 2 | Identity deletes refresh token or token family from Redis | Refresh blocked |
| 3 | Identity stores access-token `jti` revocation until JWT expiry if needed | Current token blocked early |
| 4 | Identity clears auth cookie if cookie refresh is used | Browser session cleared |

## Access Change Flow

| Step | Action | Output |
|---|---|---|
| 1 | Admin changes role, feature access, project access, pond access, or user status | Source-of-truth data updated |
| 2 | Identity increments user authorization version or deletes old snapshot | Old access becomes stale |
| 3 | Identity publishes access-change audit/event | Evidence and downstream awareness |
| 4 | Next request detects stale/missing snapshot | Service denies or triggers controlled rebuild |
| 5 | User refresh/login receives new authz version | Updated access applied |

## WebSocket Auth Flow

| Step | Action | Output |
|---|---|---|
| 1 | Browser calls authenticated `/ws/token` | Short-lived WS token minted |
| 2 | Realtime Gateway checks normal JWT and Redis authorization snapshot | User allowed to open realtime session |
| 3 | Browser opens `/ws` | WebSocket upgrade |
| 4 | Browser sends first-frame `AUTH` with WS token | In-band WS auth |
| 5 | Gateway validates WS token and Redis `jti` one-time use | Replay blocked |
| 6 | Gateway stores subscription metadata in Redis | Authorized realtime routing |

## Implementation Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Implement JWT issuer in Identity Service | Signed short-lived access tokens |
| [ ] | Implement Redis authorization snapshot writer | Feature access and ACL stored after login |
| [ ] | Implement authorization snapshot invalidation | Access changes take effect |
| [ ] | Implement reusable service authorization middleware/helper | Services read snapshot consistently |
| [ ] | Implement feature/action checks | Module permission enforced |
| [ ] | Implement project/pond/device ACL checks | Resource permission enforced |
| [ ] | Implement refresh token rotation | Reuse detection evidence |
| [ ] | Implement token revocation by `jti` | Logout/forced revocation evidence |
| [ ] | Implement login rate limits | Abuse control |
| [ ] | Implement WebSocket token replay protection | Reused WS token rejected |
| [ ] | Add audit events for login/logout/access denied/access changed | Security trail |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Login response | JWT issued |
| [ ] | Redis authz snapshot after login | Feature access and ACL visible with TTL |
| [ ] | Authorized API request | Request succeeds without Identity gRPC hot-path call |
| [ ] | Missing feature permission | Request denied |
| [ ] | Missing project/pond ACL | Request denied |
| [ ] | Role/access change | Old snapshot invalidated |
| [ ] | Refresh token reuse test | Reuse detected and blocked |
| [ ] | Logout revocation test | Token blocked before natural expiry if revocation enabled |
| [ ] | WebSocket replay test | Reused WS token rejected |

## Considerations

| Topic | Guidance |
|---|---|
| Redis role | For authn/authz, Redis is important mainly as the authorization hot-path read model and shared security-state store. |
| Authorization data | Feature access and ACL should be stored in Redis authorization snapshots so normal services do not call Identity gRPC for every request. |
| Authorization code | Redis does not contain executable business logic. Service middleware/shared auth helpers read Redis data and perform the allow/deny decision. |
| Identity ownership | Identity and Access Service owns the source rules, snapshot build, snapshot versioning, and invalidation. |
| JWT size | Keep JWT compact and use it to point to the authorization snapshot version/key. Avoid putting the full feature matrix and ACL into JWT claims. |
| Monolith compatibility | During implementation, read the existing Django `module_user` behavior and preserve the same business authorization semantics in the Redis-backed snapshot model. |
| Fallback | Identity gRPC authorization is fallback/support only: cache miss, stale snapshot, snapshot rebuild, admin/support query, or high-risk action requiring fresh verification. |
| Security | If a protected request needs feature/ACL data and Redis is unavailable, fail closed unless a controlled fresh check through Identity succeeds. |
