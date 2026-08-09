# Screenshot And Video Capture Checklist

Purpose: capture all cloud-dependent evidence before shutting down or scaling down the paid cloud environment.

## Priority Answer

Yes, Rubric IV.1 and IV.2 are the right first priority because they require the live system:

- IV.1 App Demo needs the public frontend, public API, GKE workloads, database connections, and presentable data.
- IV.2 CICD Demo benefits from live GitHub Actions, Artifact Registry, Argo CD, GKE, and Grafana evidence.

However, while the cloud is still running, also capture architecture and value-added cloud screenshots. Those screenshots can be reused later in Rubric II, Rubric III DevSecOps, and Rubric V without keeping the cluster online.

## Must Capture While Cloud Is Running

| No. | Evidence | Why it matters | Used in | How to capture |
| --- | --- | --- | --- | --- |
| 1 | Firebase Hosting custom domain `www.aquashield.live` | Proves deployed frontend | IV.1, II | Open Firebase Console -> project `aquashield-ms-dev-20260808` -> Hosting -> Domains. Capture the custom domain, status, and HTTPS state. |
| 2 | Domain DNS record for `api.aquashield.live` | DNS cutover evidence | II, IV.1 | Open the external DNS provider for `aquashield.live` rather than GCP Cloud DNS. Existing evidence points to Namecheap. Capture the `A` record for host `api` pointing to `34.54.25.36`; also capture `www` CNAME if it is visible. |
| 3 | Managed certificate or load balancer HTTPS status | TLS evidence | II, IV.1 | Open Google Cloud Console -> Kubernetes Engine -> Gateway/Ingress, or Network Services -> Load balancing. Capture frontend IP, certificate status, and HTTPS listener. |
| 4 | GKE cluster nodes | Cloud runtime evidence | II, IV.2 | Open Kubernetes Engine -> Clusters -> `aquashield` dev cluster -> Nodes. Capture node pool status, machine type, and running state. |
| 5 | GKE workloads/pods | Microservice deployment evidence | II, IV.2 | Open Kubernetes Engine -> Workloads -> namespace `aquashield-dev`. Capture all service workloads as healthy/running. |
| 6 | GKE services/gateway/load balancer | Networking and routing evidence | II, IV.1 | Open Kubernetes Engine -> Services & Ingress or Gateway. Capture API edge service, gateway, external IP, and routing resources. |
| 7 | Argo CD application health/sync | GitOps deployment evidence | III DevSecOps, IV.2 | Port-forward with `kubectl -n argocd port-forward svc/argocd-server 8080:80`, then open `http://localhost:8080`. Capture application `aquashield-dev`, target repo/path, sync status, health status, and resource tree. Avoid `https://localhost:8080` for screenshots because the internal Argo CD certificate is self-signed and Safari will show a privacy warning. |
| 8 | Artifact Registry repositories and tags | Container image storage evidence | III DevSecOps, IV.2 | Open Artifact Registry -> repositories. Capture microservice image repositories, recent tags, and push timestamps. |
| 9 | Cloud SQL instance/database | Transactional data storage evidence | II, IV.1 | Open Cloud SQL -> PostgreSQL instance -> Databases/Overview. Capture instance health, region, private/public connectivity, and database list. |
| 10 | Memorystore Redis | Cache/runtime dependency evidence | II | Open Memorystore -> Redis instances. Capture instance name, region, tier, status, and private IP. |
| 11 | Bigtable table/cluster | High-volume telemetry storage evidence | II, V | Open Bigtable -> Instances -> telemetry instance -> Tables/Monitoring. Capture table names and cluster health. |
| 12 | BigQuery dataset/tables and 4M count query | Analytical telemetry evidence | II, V, III DevSecOps | Open BigQuery SQL workspace. Run a `COUNT(*)` query for sensor readings/messages and capture the query plus result showing 4M evidence. |
| 13 | Pub/Sub topics/subscriptions | Event-driven ingestion evidence | II, V | Open Pub/Sub -> Topics and Subscriptions. Capture telemetry topic, ingestion subscription, and message/backlog metrics if visible. |
| 14 | VPC network | Cloud networking evidence | II | Open VPC network -> VPC networks. Capture the project VPC, subnet region, and IP ranges used by GKE/private services. |
| 15 | Firewall rules | Network security evidence | II | Open VPC network -> Firewall. Filter by the AquaShield/GKE network and capture relevant allow/deny rules. |
| 16 | IAM/service accounts or Workload Identity binding | Least-privilege/cloud identity evidence | II, III DevSecOps | Open IAM & Admin -> Service Accounts/IAM. Capture service accounts for GitHub deployer, GKE workloads, and their limited roles. |
| 17 | Grafana dashboard during load test | Runtime observability under load | IV.2, III DevSecOps | Start or open Grafana, run the `load-test` workflow or k6 locally/cloud, and capture service latency/RPS panels while traffic is active. |
| 18 | Prometheus query page | Metrics collection evidence | IV.2, III DevSecOps | Run `kubectl -n monitoring port-forward svc/prometheus 9090:9090`, then open `http://127.0.0.1:9090`. Prefer Graph with query `sum(up{namespace="aquashield-dev", app!="pond-daily-health"})` for a clean service-scraping screenshot. The Targets page may show failed completed CronJob pods, which is noisy for presentation evidence. |
| 19 | GitHub Actions CI run graph | CI evidence | III DevSecOps, IV.2 | Open GitHub -> Actions -> `ci.yml` latest successful run. Capture graph with unit, integration, SAST, Trivy, SBOM, and evidence jobs visible. |
| 20 | GitHub Actions CD run graph | CD evidence | III DevSecOps, IV.2 | Open GitHub -> Actions -> `AquaShield CD Evidence - Artifact Registry, Argo CD and DAST`. For the final screenshot, use a manual run with `services=all` so the graph shows image build/scan/push, GitOps update, Argo CD sync/health verification, DAST, and summary. Avoid no-change automatic runs because backend handoff jobs may be skipped. |
| 21 | GitHub Actions load-test run and k6 table | Load/stress evidence | III DevSecOps, IV.2 | Open GitHub -> Actions -> performance workflow on `load-test`. Capture the job summary table with all k6 scenarios and pass/fail columns. |
| 22 | OWASP ZAP DAST result artifact | DAST evidence | III DevSecOps | Open the DAST workflow/job artifact or summary. Capture ZAP summary counts and note high-risk findings are zero. |
| 23 | Trivy result artifact | Image security evidence | III DevSecOps | Open CI artifacts or job summary for Trivy. Capture image scan result and any fixed/rescan evidence. |
| 24 | Container logs from GKE | Runtime/container evidence | III DevSecOps | Open Kubernetes Engine -> Workloads -> select a service -> Logs, or Logs Explorer filtered by namespace `aquashield-dev`. Capture recent clean service logs. |
| 25 | AWS IoT Thing/rule/Lambda bridge | Real IoT integration evidence | V, II | Open AWS Console -> IoT Core -> Things/Message routing rules, then Lambda. Capture simulator thing, IoT rule, and Lambda bridge configuration. |
| 26 | AWS CloudWatch Lambda/IoT logs | IoT processing evidence | V | Open AWS CloudWatch -> Log groups for the Lambda bridge. Capture successful telemetry processing logs with timestamps. |
| 27 | Live alert generated by simulator | End-to-end value evidence | IV.1, V | Run or trigger simulator, then capture AquaShield UI alert/log entry showing the new sensor breach alert created from live telemetry. |

## App Demo Screenshots Or Clips

- Browser at `https://www.aquashield.live`.
- Successful login.
- Overview/dashboard with data.
- Pond comparison with readings.
- Treatments page with loaded analysis.
- Feeding and growth page.
- Alerts/notification triggered by simulator, if stable.

## CICD Demo Screenshots Or Clips

- CI on `main`, `dev`, or `test`.
- CD on `main` after CI success.
- Performance workflow on `load-test`.
- k6 summary table.
- Artifact Registry image tags.
- Argo CD application sync/health.
- GKE workloads after deployment.
- Grafana dashboard during load testing.

## Can Be Finished After Cloud Shutdown

| Evidence | Reason |
| --- | --- |
| Logical architecture diagram | Can be generated from design notes and repo |
| Physical architecture diagram | Can use captured screenshots and Terraform |
| Use case diagram | Does not need live cloud |
| Class and sequence diagrams | Does not need live cloud |
| Data schema diagrams | Can use DB schemas and docs |
| Management backlog and sprint notes | Does not need live cloud |
| Effort tracking and risk table | Does not need live cloud |
| Git history/audit trail screenshots | GitHub remains available |
| Code structure screenshots | Repo remains available |
| Speaker notes and final scripts | Does not need live cloud |

## Recommended Capture Order

1. Record App Demo while frontend, API, GKE, Cloud SQL, Redis, Bigtable/BigQuery, and simulator path are stable.
2. Record CICD Demo using the latest CI, CD, and `load-test` workflow evidence.
3. Capture cloud architecture screenshots: GKE, Gateway/load balancer, external DNS/TLS, VPC/firewall, Cloud SQL, Redis, Pub/Sub, Bigtable, BigQuery, Artifact Registry.
4. Capture observability screenshots: Grafana during load, Prometheus query/targets, GKE logs.
5. Capture IoT/value-added screenshots: AWS IoT, Lambda bridge, CloudWatch logs, generated alert.
6. After these are safe, scale down or shut down costly resources and continue report/video scripting offline.
