# Second-Round Evidence

This folder stores second-round evidence for the updated microservice submission.
It is separate from `docs/evidence/`, which remains the first-submission and
early cloud-foundation history.

| Area | Folder | Purpose |
|---|---|---|
| Performance | `performance/` | Local and cloud-native k6 performance evidence |
| Cloud-native environment | `cloud_native_environment/` | GKE, Terraform, GitOps, public edge, and managed data reactivation evidence |

## Evidence Rules

- Use k6 for HTTP, endpoint herd, growth, and WebSocket performance evidence.
- Use the Pub/Sub backlog helper for ingestion drain evidence.
- Treat Docker Compose results as local rehearsal evidence.
- Treat Kubernetes Job or GitHub Actions results against deployed microservices as cloud-native evidence.
- Do not use VM-based or monolith-only results as final microservice evidence.
