# 07 Presentation Assessment - CICD Demo

Rubric: Assessment Rubrics IV.2
Duration: Max 5 minutes
Cloud dependency: High for live deployment proof, Medium after screenshots are captured

## Priority

This is one of the highest-priority recordings while the cloud environment is running.

## What This Video Must Prove

- CI validates the system before deployment.
- CD runs only after CI passes on `main`.
- Load and stress testing are isolated to the `load-test` branch.
- The deployed system can be observed through GKE, Argo CD, Grafana, and GitHub Actions evidence.

## Suggested Demo Flow

1. Show GitHub Actions CI run on `main`, `dev`, or `test`.
2. Show CI stages: unit, integration, SAST, dependency/config scan, SBOM, Trivy/container scan, frontend/backend checks.
3. Show CD run on `main` after CI success.
4. Show Artifact Registry image tags.
5. Show Argo CD application health/sync.
6. Show GKE workloads running updated containers.
7. Switch to the `load-test` branch workflow run.
8. Show the k6 result table with all performance scenarios in one run.
9. Show Grafana dashboard during or immediately after load testing.

## Current Branch Strategy

- `main`, `dev`, `test`: CI.
- `main`: CI plus CD after CI success.
- `load-test`: performance workflow only.
- Manual CI: can run all service builds for a comprehensive screenshot.
- Automatic CI: changed-workload mode to avoid rebuilding unrelated images.

## Speaker Notes Draft

- The pipeline is separated into quality gate, deployment gate, and performance evidence lane.
- CI must pass first. CD is intentionally restricted to `main`.
- Performance testing is expensive and slower, so it runs only from the `load-test` branch.
- The deployment path uses Artifact Registry and Kubernetes/GitOps evidence, while Grafana/Prometheus provide runtime observability.

## Screenshots Or Video Clips Needed

- CI run graph.
- CD run graph.
- Load-test run graph and k6 result table.
- Artifact Registry images.
- Argo CD sync/health.
- GKE workloads.
- Grafana dashboard during load.
- Prometheus query or targets page if useful.

## Open Items

- Capture one final CI screenshot with all major lanes visible.
- Capture one final CD screenshot after CI success.
- Capture one final performance run screenshot from `load-test`.
