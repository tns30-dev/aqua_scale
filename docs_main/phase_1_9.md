# Phase 1.9 - Codebase

## Deliverable
Codebase.

## Purpose
Describe the repository structure and the implemented codebase at a high level.

## Current Project Context
- The repository is organized as a service-per-root monorepo.
- Backend services include Java microservices for identity, project, pond, sensor, ingestion, notification, realtime gateway, and audit.
- Analytics is implemented separately with TypeScript/Express.
- Frontend is a React/Vite application deployed through Firebase Hosting.
- Infrastructure, Kubernetes manifests, and CI/CD workflows are included in the same repository.

## Evidence To Add
- Repository structure screenshot.
- Service folder screenshot.
- GitHub commits or CI screenshots showing buildable codebase.

## Source References
- Repository root.
- `.github/workflows/`
- `k8s/`
- `infra/`
- `frontend/`

## Draft Status
- [ ] Add repository screenshots.
- [ ] Add explanation of key folders.
