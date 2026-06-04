# WebSocket Realtime Gateway Checklist

## Target

| Item | Selection |
|---|---|
| Runtime | Java Spring WebFlux |
| Deployment | GKE service behind GCP External Application Load Balancer |
| Public URL | `wss://api.aquashield.example.com/ws` |
| Internal route path | `/ws` |
| Transport | WSS only for browser clients |
| Auth model | Short-lived WebSocket token plus first-frame `AUTH` |
| Fanout state | Redis/Memorystore |
| Event source | Google Pub/Sub-derived domain events |
| Durable alert state | Notification Service and Cloud SQL |

## Connection Flow

| Step | Action |
|---|---|
| 1 | Browser calls authenticated REST endpoint to mint a short-lived WebSocket token |
| 2 | Browser opens `wss://api.aquashield.example.com/ws` through the HTTPS load balancer |
| 3 | Client sends first-frame `AUTH` with WebSocket token |
| 4 | Gateway validates token purpose, audience, expiry, `jti`, and origin |
| 5 | Gateway resolves allowed project/pond subscriptions |
| 6 | Gateway stores subscription metadata in Redis/Memorystore with TTL |
| 7 | Gateway receives realtime events and pushes only to authorized connected users |

## Implementation Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create Java WebFlux service skeleton | Realtime Gateway service |
| [ ] | Add `/ws/token` REST endpoint | Short-lived WS token minting |
| [ ] | Add `/ws` WebSocket handler | WSS upgrade endpoint behind TLS load balancer |
| [ ] | Reject plaintext WebSocket from public clients | No public `ws://` usage |
| [ ] | Enforce first-frame `AUTH` | Unauthenticated sessions closed |
| [ ] | Enforce auth timeout | Idle unauthenticated clients closed |
| [ ] | Enforce bounded frame sizes | Large frames rejected |
| [ ] | Enforce origin allow-list | CSWH protection |
| [ ] | Add Redis `jti` replay protection | Token replay blocked |
| [ ] | Add Redis subscription registry | User/project/pond mappings with TTL |
| [ ] | Consume `reading.ingested` events | Realtime reading updates |
| [ ] | Consume `alert.created` and `alert.resolved` events | Realtime alert updates |
| [ ] | Add Redis pub/sub or Streams fanout | Cross-pod fanout |
| [ ] | Add local session registry per pod | Local connected sessions only |
| [ ] | Add heartbeat/ping handling | Stale sessions removed |
| [ ] | Add Kubernetes probes | Readiness/liveness |
| [ ] | Add metrics | Connections, messages, failures |

## Event Types

| Event | Source | Target Client Channel |
|---|---|---|
| `reading.ingested` | Ingestion Service | Project/pond dashboard |
| `alert.created` | Notification Service | Project/pond alert panel |
| `alert.resolved` | Notification Service | Project/pond alert panel |
| `device.offline` | Sensor/Monitoring flow | Project/device status |
| `project.settings.updated` | Project Service | Dashboard refresh |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Token mint request | Short-lived token returned |
| [ ] | Authenticated WSS connection | `wss://api.aquashield.example.com/ws` session accepted |
| [ ] | Missing/invalid auth frame | Session closed |
| [ ] | Redis subscription entry | TTL metadata visible |
| [ ] | Multi-pod fanout demo | Correct pod pushes to client |
| [ ] | Realtime alert demo | Alert appears without page refresh |
| [ ] | Metrics screenshot | Connection/message metrics visible |

## Considerations

| Topic | Guidance |
|---|---|
| Public transport | Browser clients must use `wss://`, not `ws://`. |
| Route naming | `/ws` is only the route path. It does not mean plaintext WebSocket is allowed. |
| TLS termination | TLS terminates at the GCP HTTPS load balancer/Gateway. The public browser-visible endpoint remains WSS. |
| Local development | Plain `ws://localhost` can be used only for local development if TLS is not configured. Do not use plaintext WebSocket in cloud/demo deployment. |
| Frontend config | Frontend environment config should point to `wss://api.aquashield.example.com/ws` or the selected deployed API domain. |
