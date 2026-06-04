---
name: microservices-decomposition
description: Use when reasoning about AquaShield service boundaries, contracts, and monolith parity — which service owns what data/API/event, how a Django module's behavior maps to its new service, cross-service call vs event decisions, and boundary disputes. Trigger on "which service owns", "boundary", "contract between", "parity with the monolith", "where does X belong".
---

# Service boundaries & monolith parity (decomposition is DECIDED — don't redesign it)

The bounded contexts, ownership, APIs, gRPC contracts, and events are **already decided**
in `cooking_tracker/main/` (one spec per service) by the user + Codex. This skill is for
*applying* those boundaries correctly and extracting parity from the monolith.

## Ownership quick map (full detail in `main/<service>.md`)

| Service | Owns (data) | Notable boundary rules |
|---|---|---|
| identity-access | users, role_types, feature perms, user_project_access, refresh/revocation state | Owns authz snapshot build/invalidation; others only consume it |
| project | projects, profile_types, parameter_types, project_parameter_settings, energy settings, chart config ownership | **Energy dashboard is Project's**, not Analytics |
| pond | ponds, cycles, daily health, stage metrics, treatments | **Pond comparison is Pond's**, not Analytics |
| sensor | sensor_types, iot_devices, project_sensors, device validation metadata | `ResolveDevicePort` is Ingestion's critical dependency |
| ingestion | sensor_messages (Bigtable), readings, quarantine | Validates HMAC, idempotency by `deviceId+seqNo` |
| notification | alerts, alert_log, notification requests/delivery | Threshold evaluation lives here (cached from Project) |
| realtime-gateway | (stateless; Redis routing state only) | No durable state; consumes events, pushes WSS |
| analytics | chart read models/aggregates only | **Preserve `GET /api/projects/{id}/charts/` contract**; config from Project |
| audit | append-only audit records | Consumes `audit.event.recorded` from everyone |

## Cross-service interaction rules

- Need an answer now → **gRPC** (decided contracts per spec: `ResolveDevicePort`,
  `GetParameterSettings`, `GetCurrentCycle`, `ValidateToken`, …).
- Something happened → **event** (decided topics; see `pubsub-eventing`).
- Never read another service's tables. Never cache another service's authz data.
- Hot-path authorization comes from the **Redis snapshot**, not Identity gRPC.

## Monolith parity workflow (per service, before coding)

1. Spawn the **`monolith-parity-checker`** agent on the matching module:
   `module_user→identity` · `module_project→project` · `module_pond→pond` ·
   `module_sensor→sensor` · `module_data_ingestion`+`mqtt`→ingestion ·
   `module_notification`→notification · Channels consumers→realtime-gateway ·
   `module_chart`→analytics.
2. Extract: API shapes the frontend actually calls, validation rules, threshold/dedup
   logic, RBAC semantics, edge cases (e.g. alert auto-resolve, seq dedup, timestamp skew).
3. Those rules become unit-test cases in the new service — the Django code is the oracle.
4. Where new architecture intentionally diverges (cookies→bearer+snapshot, Channels→WSS
   gateway), note the divergence in the service spec / ADR so assessors see it's deliberate.

## If a boundary question isn't answered by the specs

Don't improvise silently: check `background_context/archi_scale.md`, then raise it with
the user/Codex (`/handoff-codex`) — boundary changes are architecture-time decisions.
