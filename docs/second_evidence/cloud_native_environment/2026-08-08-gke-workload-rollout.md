# GKE Workload Rollout - 2026-08-08

## Scope

Deploy the second-round AquaShield microservice runtime into the new GCP dev
project, using managed Cloud SQL, Memorystore Redis, Pub/Sub, Bigtable,
BigQuery, Artifact Registry, and the GKE Gateway public API edge.

## Deployment Target

| Item | Value |
|---|---|
| GCP project | `aquashield-ms-dev-20260808` |
| GKE cluster | `aquashield-dev-gke` |
| Zone | `asia-southeast1-a` |
| Namespace | `aquashield-dev` |
| Overlay | `k8s/overlays/performance-managed-public` |
| Image tag | `20260808-1440-6fbd5a1c8557` |
| API edge IP | `34.54.25.36` |

## Images

Built locally from the current working tree for `linux/amd64` and pushed to
Artifact Registry:

| Service | Image tag verified |
|---|---|
| `analytics-service` | `20260808-1440-6fbd5a1c8557` |
| `audit-service` | `20260808-1440-6fbd5a1c8557` |
| `identity-access-service` | `20260808-1440-6fbd5a1c8557` |
| `ingestion-service` | `20260808-1440-6fbd5a1c8557` |
| `notification-service` | `20260808-1440-6fbd5a1c8557` |
| `pond-service` | `20260808-1440-6fbd5a1c8557` |
| `project-service` | `20260808-1440-6fbd5a1c8557` |
| `realtime-gateway` | `20260808-1440-6fbd5a1c8557` |
| `sensor-service` | `20260808-1440-6fbd5a1c8557` |

## Runtime Secrets

Created directly in Kubernetes. Secret values were not written to evidence.

| Secret | Purpose |
|---|---|
| `cloudsql-admin-secret` | Cloud SQL bootstrap job admin password |
| `managed-db-passwords` | Per-service Cloud SQL user passwords |
| `jwt-verifier-public-key` | Public JWT verification key for resource services |
| `identity-access-service-secrets` | Identity JWT signing key and bootstrap admin fields |

Bootstrap admin was created for `admin@aquashield.local`.

## Rollout Result

| Check | Result |
|---|---|
| Server-side dry run | Pass |
| Kubernetes apply | Pass |
| Cloud SQL bootstrap job | `Complete`, `1/1` |
| Service deployments | `10/10` ready |
| Pod restarts | `0` |
| Gateway address | `34.54.25.36` |
| Gateway programmed | `True` |
| HTTP public IP check | `301` redirect to `https://api.aquashield.live:443/healthz` |
| API edge internal health | `{"status":"UP"}` |
| Admin login smoke | `platform_admin`, token and refresh token returned |
| Cross-service JWT smoke | Project Service accepted Identity JWT; `4` profile types returned |

## DNS and TLS Status

`api.aquashield.live` still resolves to the old first-round API edge IP:

| Host | Current DNS A record | Required A record |
|---|---|---|
| `api.aquashield.live` | `8.232.154.25` | `34.54.25.36` |

The Google-managed certificate `aquashield-dev-api-edge` is still
`PROVISIONING` with `FAILED_NOT_VISIBLE` until DNS points to the new IP.

## Mesh Note

This new GKE cluster has Gateway API resources, but it does not currently have
`security.istio.io` CRDs. For this first managed runtime rollout, the
`performance-managed-public` overlay removes Istio `AuthorizationPolicy` and
`PeerAuthentication` resources and keeps Kubernetes `NetworkPolicy` active.

Before final architecture evidence, either install Cloud Service Mesh/Istio in
the new project or explicitly record this rollout as a no-mesh performance
environment.

## Next Step

Update DNS for `api.aquashield.live` to `34.54.25.36`, wait for the managed
certificate to become `ACTIVE`, then run the cloud-native k6 result set.
