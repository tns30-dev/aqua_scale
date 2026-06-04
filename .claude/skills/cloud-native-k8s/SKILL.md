---
name: cloud-native-k8s
description: Use when writing Kubernetes manifests for GKE — Kustomize bases/overlays, Argo CD applications, Deployments/Services/HPA/PDB/probes, NetworkPolicy, Istio mesh policies, GKE Gateway/Ingress routes, Workload Identity, namespaces, secrets. Trigger on "manifest", "Kustomize", "Argo CD app", "deploy to GKE", "HPA", "NetworkPolicy", "gateway route", "probes".
---

# Cloud-native on GKE (specs: `main/gke.md`, `main/cd.md`, `main/api_gateway.md`, `main/network_security.md`, `main/service_discovery.md`)

Cluster/VPC/mesh **provisioning is Codex's scope** (cloud foundation). My scope: everything
that runs *on* it — workload manifests, Kustomize, Argo CD apps, policies per service.

## Layout (decided)

```
deploy/k8s/
  base/<service>/            deployment.yaml service.yaml hpa.yaml pdb.yaml
                             networkpolicy.yaml kustomization.yaml
  overlays/dev/<service>/    kustomization.yaml (image tag, replicas, env, namespace aquashield-dev)
  overlays/staging/<service>/ …
```
Argo CD `Application` per service per env: `<service>-dev` → path
`deploy/k8s/overlays/dev/<service>` → namespace `aquashield-dev`. Dev auto-sync;
staging manual/approved. CI bumps the Kustomize image tag — **nothing deploys via kubectl**.

## Workload checklist (every service Deployment)

- Readiness + liveness probes (`/actuator/health/...` for Java; `/healthz` for TS).
- Resource requests/limits (JVM container-aware; start small — student budget).
- **HPA** (CPU-based to start; ingestion + analytics are the scaling-demo candidates) + **PDB**.
- Security context: `runAsNonRoot`, drop capabilities, `readOnlyRootFilesystem` where possible,
  `seccompProfile: RuntimeDefault`.
- ConfigMap for config; **Secret** (or External Secrets) for credentials; Workload Identity
  SA per service with least-privilege GCP IAM (e.g. ingestion: Pub/Sub subscriber + Bigtable
  writer only).
- OTel env vars; rolling update strategy; labels: `app`, `version`, `part-of: aquashield`.

## NetworkPolicy (default-deny model, per `network_security.md`)

Default deny ingress (+ egress if feasible), then allow only the decided paths: gateway→public
API services · ingestion→sensor (gRPC) · notification→project/pond (gRPC) · realtime→Redis ·
services→Cloud SQL/Pub/Sub · monitoring→metrics. One `networkpolicy.yaml` per service base.

## Mesh policies (with Codex's Istio install)

PeerAuthentication STRICT (namespace-wide, Codex) + per-service `AuthorizationPolicy` from
the decided caller matrix (e.g. Sensor ← API edge + Ingestion only; Identity ← API edge +
selected). Allow health checks + metrics scraping. Evidence: denied unauthorized pod call,
allowed gRPC call, mTLS status.

## Gateway routes (decided, `main/api_gateway.md`)

`/api/auth/**`,`/api/users/**`→identity · `/api/projects/**`→project · `/api/ponds/**`→pond ·
`/api/sensors/**`→sensor · `/api/alerts/**`→notification · `/api/analytics/**`→analytics ·
`/api/audit/**`→audit · `/ws`→realtime-gateway (WSS upgrade). API paths non-cacheable;
CORS allows the Firebase frontend origin; JWT validated at service layer; deep authz in services.

## Local-first rule

Everything must run on Docker Compose (Postgres, Redis, Pub/Sub + Bigtable emulators) and/or
kind/minikube before touching GKE — cloud time costs money; screenshots of GKE come when
stable. Evidence: rollout status, HPA scale event, self-healing pod restart, only-changed-
service rollout. Update `ci_cd_and_testing_tracker.md` / `security_tracker.md` accordingly.
