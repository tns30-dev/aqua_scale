# Cloud-Native Cleanup Notes

Date: 2026-08-08

## Goal

Prepare the repository documentation for second-round cloud-native performance
evidence by removing stale first-round performance-tool language and creating a
clean second-round evidence area.

## Actions Taken

| Step | Status | Notes |
|---|---|---|
| Confirmed active architecture docs | Done | `cooking_tracker/main/` remains the source of truth for logical, physical, deployment, CI/CD, GKE, Terraform, gateway, and event architecture. |
| Confirmed Terraform structure | Done | `infra/` already contains reusable modules for network, GKE, Artifact Registry, managed data, security, public API edge, and AWS IoT bridge. |
| Removed stale performance-tool wording | Done | Active docs now use k6 and cloud-native execution language. |
| Created second-round evidence folder | Done | Added `docs/second_evidence/` with performance and cloud-native environment sections. |
| Preserved first-submission evidence | Done | Existing `docs/evidence/` files remain as historical foundation evidence; stale performance-tool wording was normalized where it could confuse the second-round direction. |
| Created isolated microservice GCP project | Done | New project: `aquashield-ms-dev-20260808`; `aquashield-staging` remains reserved for the monolith. |
| Created new Terraform state bucket | Done | New bucket: `aquashield-aquashield-ms-dev-20260808-tfstate`. |
| Reconfigured local Terraform target | Done | Dev backend and ignored local tfvars now point at the new project/state bucket. |
| Added managed-public performance overlay | Done | `k8s/overlays/performance-managed-public` renders and raises auth login throttling for k6. |
| Verified AWS CLI profile | Done | `aws sts get-caller-identity --profile aquashield` returned account `157466815831`. |
| Enabled AWS IoT bridge in local Terraform target | Done | `enable_aws_iot_bridge=true`, `aws_profile=aquashield`, region `ap-southeast-1`, account `157466815831`. |
| Generated new-project Terraform plan | Done | `210 to add, 0 to change, 0 to destroy`; saved at `/private/tmp/aquashield-ms-dev-20260808-with-aws-iot.tfplan` before apply. |
| Applied new-project Terraform plan | Done | GCP runtime resources were created first; AWS bridge permissions were fixed and completed in later retries. |
| Synced managed runtime private IPs | Done | `k8s/overlays/dev-managed/managed-runtime-config.yaml` now uses Cloud SQL `10.199.0.3` and Redis `10.199.73.251:6379`. |
| Prepared AWS IAM policy evidence | Done | Added `docs/second_evidence/cloud_native_environment/aws_iot_bridge_terraform_policy.json` for the missing Terraform AWS permissions. |
| Verified GKE access | Done | Fetched credentials for `aquashield-dev-gke`; `kubectl get nodes -o wide` shows one ready private node at `10.10.0.3`. |
| Tried AWS policy self-attach | Blocked | `aws iam put-user-policy` failed with `AccessDenied`; current IAM user lacks `iam:PutUserPolicy`, so an AWS root/admin identity must attach the policy. |
| Retried AWS bridge apply after policy creation | Blocked | Fresh plan showed only `11 to add`, but apply still failed with `AccessDenied` for CloudWatch Logs, IAM role, and IoT creation actions. Policy is likely created but not attached to `aquashield`, or blocked by an AWS boundary/SCP. |
| Retried AWS bridge apply after policy attachment | Blocked | AWS now allows some creation and created the IoT certificate, but Terraform lacks read-back permissions: `logs:DescribeLogGroups`, `iam:ListAttachedRolePolicies`, `iam:ListInstanceProfilesForRole`, `iot:DescribeThing`, and `iot:ListTagsForResource`. |
| Consolidated AWS policy file | Done | Kept one policy file only: `docs/second_evidence/cloud_native_environment/aws_iot_bridge_terraform_policy.json`; removed the compact and supplemental policy files. |
| Retried after policy consolidation | Blocked | Terraform can refresh more AWS bridge state, but `iot:DescribeThing` and `iot:ListTagsForResource` are still denied. The attached AWS policy must be updated to the current single JSON file. |
| Cleared Terraform taints | Done | Untainted the AWS CloudWatch log group and IAM role to avoid unnecessary replacement after the failed read-back apply. |
| Applied final AWS IoT bridge plan | Done | Applied `/private/tmp/aquashield-ms-dev-20260808-aws-iot-final-no-destroy.tfplan`; result was `6 added, 0 changed, 0 destroyed`. |
| Verified AWS IoT bridge | Done | Lambda `aquashield-dev-iot-bridge` is `Active`; IoT Thing `aq-dev-simulator-01`, IoT Rule `aquashield_dev_iot_bridge`, and CloudWatch log group are present. |
| Verified repo checks | Done | Terraform fmt/validate, performance-managed-public kustomize render, AWS policy JSON parse, and `git diff --check` passed. |
| Repointed deployment config | Done | `deploy-handoff.yml`, `k8s/overlays/dev`, and `k8s/overlays/dev-full` now target `aquashield-ms-dev-20260808` Artifact Registry images. |
| Built and pushed service images | Done | Nine `linux/amd64` service images were pushed with tag `20260808-1440-6fbd5a1c8557`. |
| Created runtime Kubernetes secrets | Done | Created Cloud SQL, per-service DB, JWT verifier, and Identity signing/bootstrap secrets directly in `aquashield-dev`; secret values were not committed. |
| Deployed GKE workloads | Done | `k8s/overlays/performance-managed-public` applied successfully; Cloud SQL bootstrap job completed; all 10 deployments are ready with 0 restarts. |
| Verified API smoke | Done | API edge health passed; admin login returned a `platform_admin` token; Project Service accepted the Identity JWT and returned 4 profile types. |
| Installed Istio mesh | Done | Istio `1.30.3` minimal profile installed; all 10 application pods run with sidecars; strict mTLS/default-deny policies restored. |
| Corrected telemetry store ownership | Done | Cleared Cloud SQL `ingestion.sensor_messages`, `ingestion.sensor_readings`, and `ingestion.energy_hourly_readings` to 0 rows; 4M telemetry evidence is assigned to Bigtable/BigQuery instead. |
| Guarded Cloud SQL import script | Done | `scripts/import-cloud-presentation-data.sh` now skips Cloud SQL telemetry import by default; the compatibility override is explicit and should not be used for final cloud-native evidence. |
| Loaded telemetry into managed stores | Done | Bigtable loader wrote `4,000,000` readings and `15,994,302` row mutations; BigQuery `aquashield_dev_analytics.readings` has `4,000,000` facts from `2025-12-03 06:00:00` to `2026-08-07 13:45:47`. |
| Verified app telemetry read path | Done | Deployed `ingestion-service` reads from Bigtable for `GetReadings`, `GetLatestReadings`, and `GetEnergyHourlyReadings`; latest-row read was fixed with a one-version Bigtable cell filter. |
| Applied Bigtable GC policy | Done | Terraform now keeps only `max_version = 1` for `raw`, `parsed`, and `meta`; full post-apply Terraform plan returned `No changes`. |
| Checked DNS/TLS | Pending | Gateway is programmed on `34.54.25.36`, but `api.aquashield.live` still resolves to old IP `8.232.154.25`; managed certificate is `PROVISIONING/FAILED_NOT_VISIBLE`. |

## Active Direction

- Local performance evidence is complete.
- Cloud-native performance evidence is next.
- Final performance runs should use k6 from a Kubernetes Job or GitHub Actions
  against the deployed microservice gateway.
- VM-based and monolith-only runs are not final evidence for this microservice submission.

## Next Cleanup/Prep Step

Before running cloud-native performance tests, finish:

| Check | Command or source |
|---|---|
| Public gateway DNS/TLS | Point `api.aquashield.live` to `34.54.25.36`, then wait for `aquashield-dev-api-edge` certificate to become `ACTIVE` |
| Presentable data import | Done: business data in Cloud SQL; 4M telemetry evidence in Bigtable/BigQuery, not Cloud SQL |
| External smoke | `https://api.aquashield.live/healthz`, admin login, cross-service JWT, and WebSocket token path |
| Performance workflow readiness | `.github/workflows/perf.yml`; `loadtests/k6/kubernetes-job.yaml` |
