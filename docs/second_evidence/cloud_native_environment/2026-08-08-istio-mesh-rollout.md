# Istio Mesh Rollout - 2026-08-08

## Scope

Install Istio into the new GKE microservice project and restore AquaShield mesh
security resources for second-round architecture and DevSecOps evidence.

## Target

| Item | Value |
|---|---|
| GCP project | `aquashield-ms-dev-20260808` |
| Cluster | `aquashield-dev-gke` |
| Zone | `asia-southeast1-a` |
| Namespace | `aquashield-dev` |
| Istio version | `1.30.3` |
| Istio profile | `minimal` |
| Public API IP | `34.54.25.36` |

## Install Summary

Istio was installed with `istioctl` using the minimal profile so the cluster has
sidecar mesh, mTLS, policy enforcement, and Istio CNI without adding a separate
Istio ingress gateway. The public entry point remains the existing GKE Gateway.

| Check | Result |
|---|---|
| `istioctl x precheck` | Pass, no issues found |
| Istio core | Installed |
| Istio CNI | Installed |
| `istiod` | Running |
| `security.istio.io` CRDs | Available |

## Overlay Change

`k8s/overlays/performance-managed-public/kustomization.yaml` was restored to
include the Istio resources inherited from `dev-full`.

The temporary no-mesh patch is no longer active in the performance overlay.

| Mesh resource | Result |
|---|---|
| Namespace injection label | `istio-injection=enabled` |
| Default mTLS | `PeerAuthentication/default-strict-mtls`, `STRICT` |
| API edge ingress exception | `PeerAuthentication/api-edge-proxy-permissive-ingress`, `PERMISSIVE` |
| Default deny policy | `AuthorizationPolicy/default-deny` |
| Service allow policies | Applied for API edge, identity, project, pond, sensor, ingestion, notification, realtime, analytics, and audit |

## Rollout Result

All AquaShield deployments were restarted after enabling injection so new pods
received sidecars.

| Check | Result |
|---|---|
| Application deployments | `10/10` rolled out |
| Application pods | `10/10` running with `2/2` ready containers |
| Pod restarts | `0` |
| Istio proxy sync | All 10 application proxies connected to `istiod` |
| Gateway | Programmed on `34.54.25.36` |

Observed pod state after rollout:

| Workload | Ready |
|---|---|
| `analytics-service` | `2/2` |
| `api-edge-proxy` | `2/2` |
| `audit-service` | `2/2` |
| `identity-access-service` | `2/2` |
| `ingestion-service` | `2/2` |
| `notification-service` | `2/2` |
| `pond-service` | `2/2` |
| `project-service` | `2/2` |
| `realtime-gateway` | `2/2` |
| `sensor-service` | `2/2` |

## Smoke Result

Temporary port-forward through `api-edge-proxy` returned healthy status after
mesh injection:

```text
HTTP/1.1 200 OK
{"status":"UP"}
```

The public HTTP Gateway still redirects correctly:

```text
301 https://api.aquashield.live:443/healthz
```

## DNS/TLS Blocker

DNS is still outside this GCP project and currently points to the old
first-round IP.

| Host | Current A record | Required A record |
|---|---|---|
| `api.aquashield.live` | `8.232.154.25` | `34.54.25.36` |

The Google-managed SSL certificate remains pending until the DNS record changes:

| Certificate | Status | Domain status |
|---|---|---|
| `aquashield-dev-api-edge` | `PROVISIONING` | `FAILED_NOT_VISIBLE` |

## Next Step

Update DNS for `api.aquashield.live` to `34.54.25.36`. After it propagates,
check that `aquashield-dev-api-edge` becomes `ACTIVE` and verify
`https://api.aquashield.live/healthz`.
