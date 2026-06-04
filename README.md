# AquaShield — Cloud-Native Microservices Platform

Re-architecture of the AquaShield aquaculture monitoring monolith into domain-driven
microservices: **GCP-primary (GKE)** with an **AWS IoT** ingress boundary, event-driven
core on Pub/Sub, GitOps delivery (Kustomize + Argo CD), and DevSecOps throughout.

## Services (one per root folder)

| Folder | Stack | Purpose |
|---|---|---|
| `identity-access-service/` | Java 21 · Spring Boot | auth, users, roles, Redis authz snapshot |
| `project-service/` | Java 21 · Spring Boot | projects, profiles, parameters, energy settings |
| `pond-service/` | Java 21 · Spring Boot | ponds, cycles, health, pond comparison |
| `sensor-service/` | Java 21 · Spring Boot | sensor types, IoT devices, port mapping |
| `ingestion-service/` | Java 21 · Spring Boot | Pub/Sub consumer, validation, telemetry store |
| `notification-service/` | Java 21 · Spring Boot | thresholds, alerts, notifications |
| `realtime-gateway/` | Java 21 · Spring WebFlux | WSS realtime fanout (Redis-backed) |
| `analytics-service/` | TypeScript · Express | historical chart API (Bigtable/BigQuery) |
| `audit-service/` | Java 21 · Spring Boot | append-only audit trail |
| `ml-service/` · `llm-service/` | Python · FastAPI | future add-on placeholders |

## Shared & platform folders

| Folder | Purpose |
|---|---|
| `common/` | shared Java utilities (event envelope, auth-snapshot helpers) |
| `shared-api/` | gRPC contracts (`proto/`) + versioned event schemas (`events/*.v1.json`) |
| `k8s/` | Kustomize `base/` + `overlays/{dev,staging}` — synced by Argo CD |
| `infra/` | Terraform (GCS remote state) — GCP + AWS IoT modules |
| `jmeter/` | load/stress test plans (`performance-test` branch only) |
| `.github/workflows/` | path-aware CI, security gates, GitOps handoff |
| `scripts/` · `local/` | local dev tooling (compose init, Pub/Sub bootstrap) |
| `docs/evidence/` | assessment evidence (reports, screenshots, scan results) |
| `cooking_tracker/` | planning & tracking workspace |

Root `pom.xml` = Maven multi-module parent for the Java services; modules are enabled as
each service is implemented.

## Quickstart — run the WHOLE platform locally (start here)

Prereqs: Docker Desktop (give it ~6 GB), Node 20+. (JDK 21 + Maven only needed for
development — the platform itself builds inside Docker.)

```bash
./scripts/up.sh                   # builds + starts ALL 9 services + infra + gateway
./scripts/seed-demo.sh            # demo project, ponds, device, 72h telemetry, 1 alert
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173** — login `admin@aquashield.local` / `AdminBoot123!`.
You'll see every container in Docker Desktop (`aq-identity`, `aq-pond`, `aq-gateway`, …).

```bash
./scripts/down.sh                 # stop everything        (-v wipes the database too)
./scripts/up.sh --no-build        # restart with existing images
```

How it fits together locally:

```
browser :5173 → Vite proxy → nginx gateway :8080 (path-aware routing) → 9 service containers
                                                  ↕ postgres / redis / pub-sub emulator
```

Full runbook + route table: [`docs/LOCAL_E2E.md`](docs/LOCAL_E2E.md).

### Infra-only mode (for running tests / a single service from the IDE)

```bash
docker compose up -d              # JUST postgres + redis + emulators (no services)
./scripts/pubsub-bootstrap.sh     # topics/subscriptions/DLQs
```

| Component | Local | Cloud target |
|---|---|---|
| PostgreSQL 16 (schema-per-service) | `localhost:5433` | Cloud SQL + read replica |
| Redis 7 | `localhost:6380` | Memorystore |
| Pub/Sub emulator | `localhost:8085` | Google Pub/Sub |
| Bigtable emulator | `localhost:8086` | Cloud Bigtable |
| API gateway (app profile) | `localhost:8080` | External HTTPS LB + GKE Gateway |

## Delivery

Path-aware CI (GitHub Actions, OIDC/WIF → GCP) → Artifact Registry → Kustomize tag bump →
Argo CD sync to GKE (`aquashield-dev` auto / staging approved). Security gates: SAST, SCA,
secret scan, SBOM, container scan; post-deploy smoke + OWASP ZAP; JMeter on
`performance-test` branch.
