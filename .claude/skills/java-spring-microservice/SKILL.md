---
name: java-spring-microservice
description: Use when implementing or scaffolding any AquaShield backend service — Java 21 + Spring Boot (identity-access, project, pond, sensor, ingestion, notification, audit), Java WebFlux (realtime-gateway), or the TypeScript/Express analytics service. Covers project layout, gRPC server/client, Pub/Sub consumers, Redis, Flyway, Testcontainers, Dockerfile, probes. Trigger on "implement <service>", "Spring Boot", "gRPC", "service skeleton", "WebFlux".
---

# AquaShield service implementation (Java/Spring + TS/Express)

Each service has a decided spec in `cooking_tracker/main/<service>.md` — **read it first**
(Target, Responsibilities, Data Ownership, REST/gRPC checklists, Events, Tests). Then run
the `monolith-parity-checker` agent on the matching Django `module_*` for business rules.

## Stack defaults (Java services)

- **Java 21, Spring Boot 3.x, Gradle (Kotlin DSL)** — one Gradle project per service under
  `services/<service-name>/`; share nothing except `libs/proto-contracts/` and (sparingly) a
  small common lib for envelope/auth-snapshot helpers.
- Spring Web (MVC) for REST; **WebFlux only for realtime-gateway**.
- **gRPC**: `grpc-spring-boot-starter` (server) + generated stubs from `libs/proto-contracts/`
  (buf or protobuf-gradle-plugin). Internal calls use K8s DNS names
  (`<service>.<ns>.svc.cluster.local`).
- **Data:** Spring Data JPA + PostgreSQL; **Flyway** migrations in
  `src/main/resources/db/migration` (each service owns its schema — set
  `spring.flyway.schemas` / default schema per service).
- **Redis:** Lettuce via Spring Data Redis. Every key has a TTL. Key patterns from
  `main/redis.md` — never invent new patterns without updating that doc.
- **Pub/Sub:** Spring Cloud GCP Pub/Sub. Consumers idempotent (see `pubsub-eventing` skill).
- **Observability:** Micrometer + OpenTelemetry exporter; structured JSON logs with
  `correlationId`/`traceId`; `/actuator/health/{liveness,readiness}` wired to K8s probes.
- **Config:** all env-driven (`application.yml` + env overrides). No secrets in repo.

## Standard service layout

```
services/<name>/
  build.gradle.kts  settings.gradle.kts  Dockerfile
  src/main/java/com/aquashield/<name>/
    api/        REST controllers + DTOs (request/response records)
    grpc/       gRPC service impls + clients to other services
    domain/     entities + domain logic
    repo/       Spring Data repositories
    service/    application services (business rules — parity with Django here)
    events/     Pub/Sub publishers/consumers + outbox if used
    config/     security, redis, grpc, pubsub config
  src/main/resources/db/migration/  V1__init.sql ...
  src/test/java/...                 unit + Testcontainers integration tests
```

## Auth enforcement (every service, from `main/authn_authz.md`)

1. Validate JWT **locally** (signature, iss, aud, exp, type) — never call Identity per request.
2. Load Redis authz snapshot `authz:snapshot:{userId}:{version}` (version from JWT claim).
3. Check feature/action permission, then project/pond/device ACL from the snapshot.
4. Snapshot missing/stale → **fail closed** or rebuild via Identity gRPC (fallback only).
Implement once as a shared auth filter/helper; reuse across services.

## Testing bar (per service)

- Unit tests for business rules (parity cases from the Django module are the test oracle).
- **Testcontainers**: PostgreSQL + Redis + Pub/Sub emulator integration tests.
- Contract: REST via spring-mockmvc/openapi validation; gRPC via generated stubs;
  event schemas validated against `contracts/events/*.v1.json`.
- Spec's "Test Checklist" table in `main/<service>.md` = the minimum acceptance list.

## Dockerfile pattern

Multi-stage: gradle build → `eclipse-temurin:21-jre` (or distroless-java21), non-root user,
`EXPOSE` REST + gRPC ports, JVM container-aware flags. Image name = spec's image name
(e.g. `identity-access-service`), tagged with Git SHA (see `devsecops-pipeline`).

## Analytics service (TypeScript/Express) deviations

Node 20 + Express + TS under `services/analytics-service/`. **Preserve the existing chart
contract exactly**: `GET /api/projects/{projectId}/charts/` with `pondId,startDate,endDate[,grouping]`
returning the documented response keys (`multiParameterTrends`, `correlationHeatmap`, …) —
see `main/analytics_service.md`. No new public chart endpoints. Reads: Cloud SQL chart
config (or Project gRPC), Bigtable time-series, BigQuery bounded queries
(`maximum_bytes_billed`). Cache metadata only — never raw readings.

## Build order recommendation

`identity-access` → `project` → `sensor` → `pond` → `ingestion` → `notification` →
`realtime-gateway` → `analytics` → `audit`. (Identity unblocks auth for everything;
ingestion needs sensor's `ResolveDevicePort`.) Local dev: Docker Compose with Postgres,
Redis, Pub/Sub emulator, Bigtable emulator.

## After every milestone

Update `cooking_tracker/claude/services_tracker.md` (status, log line, Summary for Codex) —
mandatory per CLAUDE.md. Use `/sync-tracker`.
