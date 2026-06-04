# Redis/Memorystore Checklist

## Target

| Item | Selection |
|---|---|
| Managed service | Google Cloud Memorystore for Redis |
| Local development | Redis container through Docker Compose |
| Main purpose | Distributed session/security state, cache, rate limits, realtime fanout |
| Source-of-truth role | None |
| Access pattern | Private VPC-only access from GKE workloads |
| Security boundary | No public Redis endpoint |

## Ownership

| Use Case | Owner | Data Type |
|---|---|---|
| Session metadata | Identity and Access Service | Short-lived security state |
| Refresh token rotation/revocation | Identity and Access Service | Security state |
| Authorization snapshot | Identity and Access Service | Hot-path feature access and ACL read model |
| MFA/OTP pending login token | Identity and Access Service | Temporary one-time state |
| API abuse/rate-limit counters | API Gateway and Identity Service | Counter |
| Project/profile catalogue cache | Project Service | Read-through cache |
| Parameter/settings cache | Project Service | Read-through cache |
| Device-to-project/pond mapping cache | Sensor Service | Read-through cache |
| Alert threshold lookup cache | Notification Service | Read-through cache |
| WebSocket token replay protection | Realtime Gateway | One-time token state |
| WebSocket subscription registry | Realtime Gateway | Short-lived routing metadata |
| WebSocket cross-pod fanout | Realtime Gateway | Pub/Sub or Stream message |
| Analytics chart config cache | Analytics Service | Short-lived metadata read-through cache |

## Key Design Checklist

| Status | Key Area | Example Pattern |
|---|---|---|
| [ ] | Session metadata | `auth:session:{sessionId}` |
| [ ] | Refresh token | `auth:refresh:{tokenHash}` |
| [ ] | Refresh token family | `auth:refresh-family:{familyId}` |
| [ ] | Access token revocation | `auth:revoked:{jti}` |
| [ ] | Token fingerprint | `auth:fingerprint:{accessTokenHash}` |
| [ ] | MFA pending token | `auth:mfa:{mfaTokenHash}` |
| [ ] | Authorization snapshot | `authz:snapshot:{userId}:{version}` |
| [ ] | User active authz version | `authz:version:{userId}` |
| [ ] | Login rate limit | `ratelimit:login:{ipOrUser}` |
| [ ] | API route rate limit | `ratelimit:api:{route}:{principal}` |
| [ ] | Project profile cache | `project:profile:{projectId}` |
| [ ] | Parameter catalogue cache | `project:parameters:{projectId}` |
| [ ] | Device mapping cache | `sensor:device-map:{deviceId}` |
| [ ] | Threshold cache | `notification:threshold:{projectId}:{pondId}` |
| [ ] | Analytics chart config cache | `analytics:chart-config:{projectId}` |
| [ ] | WebSocket JWT replay | `ws:jti:{jti}` |
| [ ] | WebSocket subscription | `ws:sub:{userId}:{connectionId}` |
| [ ] | WebSocket fanout channel | `ws:fanout:{projectId}:{pondId}` |

## Auth And Session Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Store refresh tokens as hashes only | Raw refresh token not persisted |
| [ ] | Add refresh token family tracking | Token reuse can be detected |
| [ ] | Rotate refresh token on refresh | Old refresh token invalidated |
| [ ] | Store revoked access-token `jti` until expiry | Logout/revocation check works |
| [ ] | Store feature access matrix in authorization snapshot | Services can check module/feature/action access without Identity gRPC hot-path calls |
| [ ] | Store project/pond/device ACL in authorization snapshot | Services can enforce resource scope locally from Redis data |
| [ ] | Add authorization snapshot versioning | Role/access changes invalidate stale snapshots |
| [ ] | Include authorization version/key in JWT | Services can load the correct Redis snapshot |
| [ ] | Store MFA pending login token with short TTL | TOTP step has temporary state |
| [ ] | Add login abuse counters | Brute force attempts rate-limited |
| [ ] | Add safe fallback behavior | Security checks fail closed when Redis is unavailable |

## Authorization Snapshot Shape

| Field | Purpose |
|---|---|
| `userId` | Authenticated user id from JWT `sub` |
| `version` | Authorization snapshot version included in JWT or resolved by user id |
| `roleType` | User role/category summary |
| `features` | Module/feature/action permissions such as `project.read`, `pond.update`, `sensor.map`, `analytics.view` |
| `projectIds` | Projects this user can access |
| `pondIdsByProject` | Pond-level ACL when project access alone is too broad |
| `deviceIdsByProject` | Device-level ACL when required |
| `deniedFeatures` | Explicit denies if the permission model requires deny-overrides |
| `issuedAt` | Snapshot creation time |
| `expiresAt` | Snapshot TTL boundary |

## Authorization Snapshot Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Build snapshot from Cloud SQL on login | Redis key created for authenticated user |
| [ ] | Store module/feature/action permission list | Feature access available to services |
| [ ] | Store project/pond/device ACL | Resource-level checks available to services |
| [ ] | Store active authz version per user | Services can detect stale JWT/snapshot |
| [ ] | Invalidate snapshot on role update | Removed feature access takes effect |
| [ ] | Invalidate snapshot on project/pond access update | Removed resource access takes effect |
| [ ] | Invalidate snapshot on user disable/logout-all | Disabled user blocked |
| [ ] | Add cache-miss recovery path | Identity can rebuild snapshot when required |
| [ ] | Add unit tests for allow/deny matrix | Feature and ACL checks are deterministic |

## Cache Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Define cache TTL per use case | No unbounded cache lifetime |
| [ ] | Use read-through cache for catalogue/config reads | Cloud SQL read load reduced |
| [ ] | Invalidate project/profile cache on update | Updated settings visible |
| [ ] | Invalidate parameter cache on update | Chart/device logic reads current settings |
| [ ] | Invalidate device mapping cache on reassignment | Telemetry mapped to correct project/pond |
| [ ] | Invalidate threshold cache on alert rule update | Alert decisions use current threshold |
| [ ] | Keep analytics chart config cache metadata-only with short TTL | Historical chart config reads avoid repeated Project gRPC calls without caching raw readings |
| [ ] | Add cache hit/miss metrics | Cache behavior visible in evidence |

## WebSocket Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Store WebSocket JWT `jti` as one-time key | Replay protection |
| [ ] | Store active subscription metadata with TTL | Realtime routing metadata |
| [ ] | Refresh subscription TTL on heartbeat | Stale connections expire |
| [ ] | Use Redis Pub/Sub or Streams for cross-pod fanout | Event reaches correct gateway pod |
| [ ] | Keep local in-memory connection registry per pod | Only socket objects stay in memory |
| [ ] | Remove subscription keys on disconnect | Clean routing state |
| [ ] | Add fanout metrics | Published, delivered, dropped message counts |

## Deployment Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create Memorystore Redis instance in private network | Managed Redis ready |
| [ ] | Restrict access to GKE private subnet | No public access |
| [ ] | Store Redis connection details in Kubernetes Secret | No hardcoded endpoint |
| [ ] | Configure service-specific Redis key prefixes | Key ownership clear |
| [ ] | Configure connection pooling | Safe pod-to-Redis usage |
| [ ] | Add readiness behavior for Redis-dependent paths | Clear failure behavior |
| [ ] | Add Redis dashboards/alerts | Memory, ops, latency, evictions visible |
| [ ] | Prepare Docker Compose Redis for local development | Local workflow works without cloud |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Memorystore instance screenshot | Redis instance exists |
| [ ] | Private connectivity proof | GKE pod can connect, public cannot |
| [ ] | Login/session key demo | Auth state stored with TTL |
| [ ] | Refresh rotation demo | Old token rejected after rotation |
| [ ] | Authorization snapshot demo | Feature access and ACL snapshot visible with TTL |
| [ ] | Authorization invalidation demo | Removed access denied after snapshot version update |
| [ ] | Rate-limit demo | Excess login/API requests blocked |
| [ ] | WebSocket replay demo | Reused `jti` rejected |
| [ ] | Multi-pod fanout demo | Connected client receives event from another pod |
| [ ] | Cache hit/miss metrics | Metrics visible in dashboard/logs |

## Considerations

| Area | Guidance |
|---|---|
| Source of truth | Redis must not become the source of truth for users, roles, permissions, projects, ponds, devices, readings, or alerts. |
| User profile | Store user profile in Cloud SQL. Redis may cache a small profile/session snapshot only with TTL and invalidation. |
| Authorization | Redis authorization snapshots are the normal hot-path read model for feature access and ACL checks. Identity and Access Service remains the owner and Cloud SQL remains the source of truth. |
| Authorization logic | Redis stores authorization data, not business code. Service middleware/shared auth logic reads the snapshot and makes the allow/deny decision. |
| Token safety | Store token hashes or identifiers, not raw long-lived secrets. |
| TTL | Every session, token, cache, rate-limit, and subscription key must have a TTL. |
| Failure mode | Security-critical Redis failures should fail closed or rebuild the snapshot through Identity before allowing the action. Non-critical read caches may bypass Redis and read from source storage. |
| WebSocket fanout | Keep socket objects local to each pod; use Redis only for routing metadata and cross-pod messages. |
| Analytics cache | Analytics may cache chart configuration metadata as `analytics:chart-config:{projectId}` with short TTL. Raw telemetry/readings must never be cached in Redis; they are read through the Ingestion gRPC boundary. |
| Cost | Use managed Memorystore for final evidence if feasible; use local Redis for development and repeatable demos. |
