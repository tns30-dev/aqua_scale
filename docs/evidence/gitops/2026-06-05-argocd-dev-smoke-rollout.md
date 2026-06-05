# Argo CD Dev Smoke Rollout Evidence - 2026-06-05

## Scope

This evidence records the first live GitOps rollout on the quota-limited GCP free-credit project `aerobic-guide-498413-u6`.

The full `k8s/overlays/dev` workload set was synced first, but it was intentionally not treated as the health gate because the free-trial quota and missing runtime dependencies prevented all nine services from becoming healthy:

- GKE free-credit quota capped the node pool at two `e2-standard-2` nodes.
- Istio sidecars added per-pod CPU/memory requests.
- Java services require runtime dependencies that are not provisioned yet, including PostgreSQL, Redis, Pub/Sub, and JWT secrets.
- Realtime gateway failed on Pub/Sub emulator configuration while full cloud Pub/Sub is still a later data/messaging slice.

To keep the proof honest and cost-safe, the live Argo CD Application now targets `k8s/overlays/dev-smoke`, an analytics-only smoke slice that proves:

- private Artifact Registry image pull,
- Argo CD private GitHub sync,
- GKE workload scheduling,
- Istio sidecar injection,
- strict mTLS policy presence,
- Kubernetes NetworkPolicy presence,
- application health endpoint readiness.

## GitOps Source

```text
Application: aquashield-dev
Namespace: argocd
Source path: k8s/overlays/dev-smoke
Revision: 6ce1f0888a434553a3c660028b462cc6df59290a
```

## Argo CD Status

```text
path=k8s/overlays/dev-smoke
sync=Synced
health=Healthy
phase=Succeeded
message=successfully synced (all tasks run)
revision=6ce1f0888a434553a3c660028b462cc6df59290a
```

## Workload Status

```text
NAME                                 READY   STATUS    RESTARTS   AGE    IP           NODE
analytics-service-585758b788-lt42z   2/2     Running   0          2m7s   10.20.1.16   gke-aquashield-dev-g-aquashield-dev-p-dbc81208-xvnn
```

## Runtime Controls

```text
deployment.apps/analytics-service   1/1 ready, 1 up-to-date, 1 available

horizontalpodautoscaler.autoscaling/analytics-service
TARGETS: cpu 9%/70%, memory 20%/80%
MINPODS: 1
MAXPODS: 1
REPLICAS: 1

poddisruptionbudget.policy/analytics-service
MIN AVAILABLE: 1

networkpolicy.networking.k8s.io/allow-gclb-health-checks
networkpolicy.networking.k8s.io/analytics-service-ingress
networkpolicy.networking.k8s.io/default-deny-ingress

authorizationpolicy.security.istio.io/analytics-service-allow-http
authorizationpolicy.security.istio.io/default-deny

peerauthentication.security.istio.io/default-strict-mtls
MODE: STRICT
```

## Resource-Level Sync

```text
ConfigMap/analytics-service-config sync=Synced
Namespace/aquashield-dev sync=Synced
Secret/analytics-service-secrets sync=Synced
Service/analytics-service sync=Synced
ServiceAccount/analytics-service sync=Synced
Deployment/analytics-service sync=Synced
HorizontalPodAutoscaler/analytics-service sync=Synced
NetworkPolicy/allow-gclb-health-checks sync=Synced
NetworkPolicy/analytics-service-ingress sync=Synced
NetworkPolicy/default-deny-ingress sync=Synced
PodDisruptionBudget/analytics-service sync=Synced
AuthorizationPolicy/analytics-service-allow-http sync=Synced
AuthorizationPolicy/default-deny sync=Synced
PeerAuthentication/default-strict-mtls sync=Synced
```

## Smoke Test

Command path:

```text
kubectl port-forward -n aquashield-dev svc/analytics-service 18090:8090
curl -fsS http://127.0.0.1:18090/healthz
```

Result:

```json
{"status":"UP"}
```

## Notes

- The committed smoke public key is a public verification key only; no private signing key is committed.
- The full `k8s/overlays/dev` overlay remains available for the later full-runtime rollout after managed data/messaging dependencies are provisioned or billing/quota limits are intentionally raised.
- This smoke rollout is the current live demo-safe GitOps proof for the free-credit project.
