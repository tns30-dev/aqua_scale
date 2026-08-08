# Cloud-Native Costly Environment Plan

Last updated: 2026-08-09

## Purpose

This file translates the second-round requirement package into the work that
must be done while the paid cloud-native environment is running.

Non-cloud work such as report writing, backlog polishing, diagrams, and slide
cleanup can be done later without keeping GCP resources active. The priority
here is to finish the live runtime, collect proof, and record videos quickly.

## Current Runtime State

| Area | Status | Note |
|---|---|---|
| GCP project | Done | New project is `aquashield-ms-dev-20260808`. Do not use `aquashield-staging`; that belongs to the monolith app. |
| Terraform foundation | Done | GKE, Cloud SQL, Redis, Pub/Sub, Bigtable, BigQuery, Artifact Registry, public Gateway IP, and managed certificate are created. |
| AWS IoT bridge | Done | AWS Lambda, IoT Rule, IoT Thing, and CloudWatch log group are created in AWS account `157466815831`. |
| Microservice workloads | Done | 10 service deployments are running in namespace `aquashield-dev` with 0 restarts. |
| Internal smoke test | Done | Health, admin login, and cross-service JWT checks passed through port-forward. |
| Public DNS/TLS | Blocked | `api.aquashield.live` still points to old IP `8.232.154.25`; it must point to `34.54.25.36`. |
| Istio/service mesh | Done | Istio `1.30.3` minimal profile is installed and app pods run with sidecars. |
| Presentable cloud data | Done | Business data is imported into Cloud SQL. Cloud SQL telemetry tables were cleared. Bigtable and BigQuery hold the 4M telemetry evidence. |
| Cloud-native k6 evidence | Pending | Run only after DNS/TLS, Istio, and presentable data are ready. |

## Immediate Order

1. DNS and TLS

   Update `api.aquashield.live` to the new GKE Gateway IP.

   | DNS record | Required value |
   |---|---|
   | Type | `A` |
   | Host | `api` or `api.aquashield.live`, depending on DNS provider UI |
   | Value | `34.54.25.36` |
   | Old value to remove | `8.232.154.25` |
   | TTL | `300` seconds if allowed |

   Evidence to capture:

   - DNS lookup showing `api.aquashield.live -> 34.54.25.36`.
   - Google-managed certificate status changing to `ACTIVE`.
   - `https://api.aquashield.live/healthz` returning healthy status.

2. Istio/service mesh

   Install Istio or Cloud Service Mesh into the new GKE cluster, then re-enable
   the existing mesh manifests.

   Evidence to capture:

   - Istio control-plane pods running.
   - `security.istio.io` resources available.
   - `aquashield-dev` namespace has injection enabled.
   - Application pods show sidecars, normally `2/2` ready.
   - `PeerAuthentication` and `AuthorizationPolicy` resources applied.
   - Smoke test still passes after mesh injection.

3. Presentable business data and telemetry stores

   Inspect the local PostgreSQL databases and identify the real application
   dataset versus the load-test dataset. Import only real/presentable business
   data into the cloud-managed Cloud SQL service schemas. Do not load the 4M
   telemetry dataset into Cloud SQL; use Bigtable/BigQuery for that evidence.

   Evidence to capture:

   - Source database name and table counts.
   - Target Cloud SQL database/schema counts after import.
   - Cloud SQL `ingestion.sensor_messages`, `ingestion.sensor_readings`, and
     `ingestion.energy_hourly_readings` are empty for the final cloud-native
     evidence.
   - Bigtable `aquashield-dev-telemetry/telemetry_readings` and BigQuery
     `aquashield_dev_analytics.readings` are the managed telemetry targets.
   - BigQuery `aquashield_dev_analytics.readings` has `4,000,000` telemetry
     facts from `2025-12-03 06:00:00` to `2026-08-07 13:45:47`.
   - Deployed `ingestion-service` gRPC reads now return `GetReadings`,
     `GetLatestReadings`, and `GetEnergyHourlyReadings` from Bigtable.
   - App screens showing realistic pond, sensor, feeding, treatment, analytics,
     and real-time data.

4. Live system demo readiness

   Verify the public app path before recording.

   Evidence/demo flow:

   - Login as admin.
   - Show dashboard/overview.
   - Show pond and sensor data.
   - Show feeding and growth.
   - Show treatments.
   - Show real-time or IoT-backed telemetry flow.
   - Show health/log evidence from Kubernetes.

5. CI/CD discussion and setup

   Do this only after DNS, Istio, and data are stable. The requirement expects a
   DevSecOps demo, so the pipeline evidence must show image build/push,
   deployment, tests, and security checks.

6. Cloud-native performance evidence

   Run k6 against the deployed microservice API, not the monolith and not a VM
   app-only setup.

   Evidence to capture:

   - Load test result.
   - Stress test result.
   - Growth/spike-style result.
   - WebSocket/real-time result.
   - Clear pass/fail summary using response-time target around 3 seconds.

7. Artifact and MP4 collection

   After the cloud runtime is stable, collect short evidence files and record
   the required videos:

   | Video | Focus |
   |---|---|
   | Management Assessment | Scope, backlog, sprint/process evidence |
   | Architectural Assessment | Microservice, DDD, deployment, cloud, security |
   | Technical Assessment - Software Design | Use cases, core design, models |
   | Technical Assessment - DevSecOps | CI/CD, tests, security, container evidence, IaC |
   | Value Added Assessment | Real-time processing, analytics, AWS IoT/cloud value |
   | Presentation Assessment App Demo | Working live system, max 5 minutes |
   | Presentation Assessment CICD Demo | Pipeline demo, max 5 minutes |

## Cost-Control Rule

Keep the cloud environment active only while collecting runtime evidence. After
DNS/TLS, Istio, data import, smoke tests, screenshots, k6 output, and videos are
captured, scale down or destroy non-required paid resources.

## Not Prioritized While Cloud Is Running

- Report polishing.
- Slide formatting.
- Management artifact cleanup.
- Use case/class/sequence diagram refinement.
- Architecture diagram polishing.
- Non-runtime documentation cleanup.

These are required for submission, but they can be completed without paying for
running cloud infrastructure.
