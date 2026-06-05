# Argo CD Dev Full Rollout Evidence

Date: 2026-06-05

## Scope

This evidence records the quota-controlled full dev runtime before the managed
GCP data cutover. The rollout runs all nine implemented AquaShield services on
GKE with Istio sidecars and Argo CD GitOps, using in-cluster temporary
PostgreSQL, Redis, and Pub/Sub emulator dependencies.

The managed target remains Cloud SQL PostgreSQL, Memorystore Redis, real Google
Pub/Sub, Cloud Bigtable, and BigQuery. The in-cluster dependencies are a
repeatable evidence step, not the production architecture.

## GitOps State

```text
Application: aquashield-dev
Source path: k8s/overlays/dev-full
Revision: 9545374571ff969a34c11152850bc1ed56852c3c
Sync: Synced
Health: Healthy
```

Relevant commits:

```text
efb7347 feat(gitops): add full dev runtime overlay
9545374 fix(gitops): extend dev full startup probes
```

## Runtime Pods

```text
analytics-service        2/2 Running
audit-service            2/2 Running
identity-access-service  2/2 Running
ingestion-service        2/2 Running
notification-service     2/2 Running
pond-service             2/2 Running
project-service          2/2 Running
realtime-gateway         2/2 Running
sensor-service           2/2 Running
postgres                 1/1 Running
redis                    1/1 Running
pubsub-emulator          1/1 Running
pubsub-bootstrap         Completed
```

## Dependency Evidence

PostgreSQL schemas created for service ownership:

```text
audit
identity_access
ingestion
notification
pond
project
sensor
```

Redis health:

```text
PONG
```

Pub/Sub bootstrap created the event catalogue topics, subscriptions, and DLQ
inspection subscriptions from the same contract used by local development:

```text
iot.telemetry.received
reading.ingested
alert.created
alert.resolved
audit.event.recorded
project.created
project.updated
device.registered
project.sensor.assigned
project.sensor.updated
```

## Application Health

In-container readiness checks returned `{"status":"UP"}` for:

```text
identity-access-service  /actuator/health/readiness
project-service          /actuator/health/readiness
pond-service             /actuator/health/readiness
sensor-service           /actuator/health/readiness
ingestion-service        /actuator/health/readiness
notification-service     /actuator/health/readiness
realtime-gateway         /actuator/health/readiness
audit-service            /actuator/health/readiness
analytics-service        /healthz
```

## Notes

- Startup probe thresholds were extended for the Java services so cold starts
  fit the single-node free-credit GKE environment.
- The full runtime is intentionally internal-only: no public Gateway/LoadBalancer
  evidence is claimed here.
- An ad-hoc in-mesh curl pod connected to service ClusterIPs but timed out on
  HTTP response bodies. Because pod-local readiness and Argo health passed, that
  is tracked as a mesh/service-to-service diagnostic follow-up, not as completed
  business-flow evidence.
