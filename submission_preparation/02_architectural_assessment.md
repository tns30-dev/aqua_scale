# 02 Architectural Assessment

Rubric: Assessment Rubrics II
Duration: 10 minutes
Cloud dependency: Medium to High

## What This Video Must Prove

- The system was intentionally redesigned from a monolith into domain-based microservices.
- Logical architecture and physical cloud architecture are both clear.
- The architecture supports real-time telemetry, large historical data, dashboards, CI/CD, security, and operational monitoring.
- Security threats were identified and mitigated.

## Required Rubric Points

- Logical architecture
  - Domain-driven service boundaries.
  - Logical architecture overview.
  - Domain Driven Design diagrams.
  - Logical deployment diagram.
- Physical architecture
  - Cloud-native deployment decisions.
  - Technology stack.
  - Physical architecture with infrastructure and networking details.
  - Physical deployment diagram.
- Security assessment
  - Threats and mitigation.
  - Identity, CORS, TLS, secret handling, IAM, service accounts, and network controls.

## Cloud-Native Architecture Points To Mention

- Frontend: Firebase Hosting serving `https://www.aquashield.live`.
- API edge: `https://api.aquashield.live` routed to GKE through Gateway/load balancer.
- Runtime: GKE microservices in `aquashield-dev`.
- Service communication: Kubernetes services plus Istio mesh observability.
- Relational data: Cloud SQL PostgreSQL for transactional domain data.
- Cache: Memorystore Redis for fast runtime support.
- High-volume telemetry: Bigtable and BigQuery for sensor messages and sensor readings.
- IoT bridge: AWS IoT Core -> Lambda bridge -> Pub/Sub -> ingestion service.
- CI/CD: GitHub Actions -> Artifact Registry -> GitOps handoff -> Argo CD.

## Suggested Speaker Notes

- Start by showing why one database and one monolith was not enough for the new requirements.
- Explain the separation of bounded contexts: identity, project, pond, sensor, ingestion, analytics, notification, realtime gateway, and API edge.
- Explain data placement: Cloud SQL for business state, Bigtable for high-write telemetry, BigQuery for analytical queries and evidence at 4M scale.
- Explain the hybrid cloud decision: AWS IoT is used because the app requirement includes AWS IoT device integration, while the main platform runs on GCP.
- Explain security controls at the edge and inside the cluster.

## Evidence To Capture While Cloud Is Running

- GKE cluster, node pool, workloads, services, and gateway/load balancer.
- Cloud DNS and managed certificate for `api.aquashield.live`.
- Firebase custom domain for `www.aquashield.live`.
- Cloud SQL instance and database.
- Memorystore Redis.
- Bigtable table/cluster.
- BigQuery dataset/table with telemetry evidence.
- Pub/Sub topics/subscriptions.
- Artifact Registry repositories and image tags.
- Argo CD application sync/health.
- Grafana dashboard under load.

## Open Items

- Finalize logical architecture diagram.
- Finalize physical deployment diagram.
- Prepare threat and mitigation table.
