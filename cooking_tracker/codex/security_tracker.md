# Security Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns platform security architecture, cloud/network controls, service-to-service protection, and security evidence.
- Current state: Application-layer authn/authz is implemented and tested. CI security gates exist, all nine deployable service images passed Trivy image scan, the GKE VPC/firewall/private-node foundation is live, Istio strict mTLS plus AuthorizationPolicy are proven on the managed nine-service dev runtime, Workload Identity-backed Pub/Sub access is proven by the business smoke, and the live AWS IoT/Lambda bridge is proven with certificate-authenticated MQTT plus GCP WIF. Cloud Armor remains an architecture/design control without runtime evidence in this implementation.
- Current test: Existing auth integration tests, Redis snapshot evidence, CI gates, all-service container scans, local e2e security paths, GKE node readiness, firewall/NAT verification, Istio mTLS policy presence, Argo CD managed-runtime evidence, live Workload Identity-backed GCP API access, managed business smoke, AWS bridge live IAM/WIF proof, and public edge dry-run validation.
- Next test: Run public-edge DAST once an approved HTTP endpoint or HTTPS endpoint exists.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Authn/Authz workflow | DONE | Identity mints RS256 JWTs and authz snapshots; resource services verify public-key JWTs and fail closed on missing snapshots. | `../../docs/evidence/project-service/2026-06-04-tests-and-cross-service-smoke.txt` | 2026-06-04 |
| Identity authorization snapshot | DONE | Snapshot keys and versioning are implemented in Redis after login; access/role changes invalidate old state. | `../../docs/evidence/identity-access/` | 2026-06-04 |
| Token lifecycle | DONE | Login, refresh rotation, reuse detection, logout, and jti revocation are implemented and tested. MFA remains optional/deferred. | `../../docs/evidence/identity-access/` | 2026-06-04 |
| Three-layer firewall model | IN_PROGRESS | VPC, private-node GKE, NAT, health-check firewall, and internal firewall are live. Cloud Armor WAF/rate-limit policy remains design-only for this implementation. | `../../infra/modules/network/`, `../../infra/modules/security/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../main/network_security.md` | 2026-06-05 |
| Service-to-service protection | DONE | K8s service accounts, NetworkPolicy default-deny, Istio sidecar injection, strict mTLS, and AuthorizationPolicy are live on the managed nine-service dev runtime; the managed business smoke exercised authenticated cross-service flows. | `../../k8s/base/service-accounts.yaml`, `../../k8s/base/mesh/`, `../../k8s/base/services/`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/gitops/2026-06-05-managed-business-flow-smoke.md` | 2026-06-05 |
| Security evidence | IN_PROGRESS | CI gates include Gitleaks, Semgrep, Trivy fs/image scans, CycloneDX SBOM, all-service deploy-handoff image scans, GKE/network apply evidence, managed mesh evidence, live Workload Identity-backed GCP API access, managed business-smoke auth/audit evidence, AWS bridge live IAM/WIF evidence, and public edge dry-run evidence. DAST is pending. | `../../docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../../docs/evidence/gitops/2026-06-05-managed-business-flow-smoke.md`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md`, `../../docs/evidence/aws-iot-bridge/2026-06-05-code-readiness.md`, `../../docs/evidence/aws-iot-bridge/2026-06-05-live-deploy-and-smoke.md`, `../../docs/evidence/public-edge/2026-06-05-public-edge-firebase-readiness.md` | 2026-06-05 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Authn/authz cross-service smoke | PASS in evidence. | 2026-06-04 |
| CI security gates | PASS in CI evidence after dependency hardening. | 2026-06-04 |
| Tracker ownership rewrite | PASS; security is Codex-owned. | 2026-06-05 |
| All-service image scan | PASS; deploy-handoff run `26971844902` scanned all nine built images before push. | 2026-06-05 |
| GKE firewall foundation | PASS; VPC, health-check firewall, internal firewall, private nodes, and NAT are live. | 2026-06-05 |
| Cloud Armor runtime evidence | NOT_REQUIRED; retained in architecture docs, but not implemented/evidenced in this scope. | 2026-06-05 |
| Istio install | PASS; Istio `1.30.1` CRDs/control plane are live. | 2026-06-05 |
| Strict mTLS proof | PASS; `PeerAuthentication/default-strict-mtls` is live in `STRICT` mode for the full dev namespace. | 2026-06-05 |
| AuthorizationPolicy proof | PASS; `AuthorizationPolicy/default-deny` and per-service allow policies are live and Argo-synced. | 2026-06-05 |
| NetworkPolicy proof | PASS; default-deny ingress, app-internal allow, GCLB allow, and per-service policies are live and Argo-synced. | 2026-06-05 |
| Workload Identity proof | PASS; `dev-managed` service accounts are annotated for per-service Google service accounts and the managed rollout used ADC/Workload Identity for real Pub/Sub and managed GCP APIs without JSON keys. | 2026-06-05 |
| Managed auth/audit smoke | PASS; business smoke minted a JWT, refreshed project grants, used the authz snapshot across services, and observed audit security rows. | 2026-06-05 |
| AWS bridge IAM design | PASS; Terraform created IoT publish-only device policy, Lambda log-only execution role, GCP WIF restricted to the Lambda assumed-role prefix, and Pub/Sub publisher-only IAM. Live x.509 MQTT and CloudWatch proof exists. | 2026-06-05 |
| Public edge exposure control | BLOCKED; HTTP-only public API exposure was not applied without explicit temporary-risk approval. HTTPS requires domain/TLS input. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Authn/authz workflow, Redis snapshot, token lifecycle, WebSocket security, analytics auth port, and audit trail evidence landed through service work. |
| 2026-06-04 | CI security gates found and drove remediation of real Tomcat/Spring Security critical CVEs. |
| 2026-06-05 | Rephrased security tracker under Codex ownership; cloud security proof remains the next major step. |
| 2026-06-05 | All nine deployable images passed Trivy image scan during Artifact Registry backfill; live Istio/DAST evidence remains next. |
| 2026-06-05 | Runtime GKE/network foundation went live. Cloud Armor remains design-only for this implementation. At this point mesh proof was still gated by Istio installation. |
| 2026-06-05 | Installed Istio and proved service identity controls on the live analytics smoke slice: sidecar injection, strict mTLS, default-deny AuthorizationPolicy, and NetworkPolicy. |
| 2026-06-05 | Promoted mesh/security evidence to the full nine-service `dev-full` runtime and added Workload Identity manifest proof for the managed GCP cutover overlay. |
| 2026-06-05 | Promoted managed security evidence to live `dev-managed`: all nine services are healthy with Workload Identity annotations and managed Cloud SQL/Memorystore/Pub/Sub runtime dependencies. |
| 2026-06-05 | Managed business smoke passed, proving Workload Identity Pub/Sub access plus JWT/authz/audit paths on the live managed runtime. |
| 2026-06-05 | Added AWS IoT/Lambda bridge IAM/WIF scaffold with publisher-only GCP access and no Google service account key. |
| 2026-06-05 | Applied AWS IoT/Lambda IAM/WIF resources and proved certificate-authenticated MQTT delivery without Google service account keys. |
| 2026-06-05 | Added public Gateway dry-run evidence but did not apply HTTP-only public exposure without explicit approval. |
