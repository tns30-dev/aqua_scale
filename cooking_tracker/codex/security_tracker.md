# Security Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns platform security architecture, cloud/network controls, service-to-service protection, and security evidence.
- Current state: Application-layer authn/authz is implemented and tested. CI security gates exist, all nine deployable service images passed Trivy image scan, and the GKE VPC/firewall/private-node foundation is live. Cloud Armor is blocked by zero project quota, and Istio CRDs/control plane are not installed yet.
- Current test: Existing auth integration tests, Redis snapshot evidence, CI gates, all-service container scans, local e2e security paths, GKE node readiness, and firewall/NAT verification.
- Next test: Install Istio CRDs/control plane, then prove mTLS and AuthorizationPolicy behavior on the live cluster before post-deploy DAST. Cloud Armor needs quota increase before WAF/rate-limit proof.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Authn/Authz workflow | DONE | Identity mints RS256 JWTs and authz snapshots; resource services verify public-key JWTs and fail closed on missing snapshots. | `../../docs/evidence/project-service/2026-06-04-tests-and-cross-service-smoke.txt` | 2026-06-04 |
| Identity authorization snapshot | DONE | Snapshot keys and versioning are implemented in Redis after login; access/role changes invalidate old state. | `../../docs/evidence/identity-access/` | 2026-06-04 |
| Token lifecycle | DONE | Login, refresh rotation, reuse detection, logout, and jti revocation are implemented and tested. MFA remains optional/deferred. | `../../docs/evidence/identity-access/` | 2026-06-04 |
| Three-layer firewall model | IN_PROGRESS | VPC, private-node GKE, NAT, health-check firewall, and internal firewall are live. Cloud Armor WAF/rate-limit policy is blocked by zero quota. | `../../infra/modules/network/`, `../../infra/modules/security/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../main/network_security.md` | 2026-06-05 |
| Service-to-service protection | IN_PROGRESS | K8s service accounts, NetworkPolicy, strict mTLS manifests, and AuthorizationPolicy skeletons exist. Live preflight confirms Istio CRDs are missing. | `../../k8s/base/service-accounts.yaml`, `../../k8s/base/mesh/`, `../../k8s/base/services/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Security evidence | IN_PROGRESS | CI gates include Gitleaks, Semgrep, Trivy fs/image scans, CycloneDX SBOM, all-service deploy-handoff image scans, and GKE/network apply evidence. DAST and mesh proof are pending. | `../../docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Authn/authz cross-service smoke | PASS in evidence. | 2026-06-04 |
| CI security gates | PASS in CI evidence after dependency hardening. | 2026-06-04 |
| Tracker ownership rewrite | PASS; security is Codex-owned. | 2026-06-05 |
| All-service image scan | PASS; deploy-handoff run `26971844902` scanned all nine built images before push. | 2026-06-05 |
| GKE firewall foundation | PASS; VPC, health-check firewall, internal firewall, private nodes, and NAT are live. | 2026-06-05 |
| Cloud Armor quota | BLOCKED; project quota is `SECURITY_POLICIES=0`, `SECURITY_POLICY_RULES=0`, `SECURITY_POLICY_CEVAL_RULES=0`. | 2026-06-05 |
| Istio policy preflight | BLOCKED; live cluster does not yet have Istio `AuthorizationPolicy` or `PeerAuthentication` CRDs. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Authn/authz workflow, Redis snapshot, token lifecycle, WebSocket security, analytics auth port, and audit trail evidence landed through service work. |
| 2026-06-04 | CI security gates found and drove remediation of real Tomcat/Spring Security critical CVEs. |
| 2026-06-05 | Rephrased security tracker under Codex ownership; cloud security proof remains the next major step. |
| 2026-06-05 | All nine deployable images passed Trivy image scan during Artifact Registry backfill; live Cloud Armor/Istio/DAST evidence remains next. |
| 2026-06-05 | Runtime GKE/network foundation went live. Cloud Armor is quota-blocked, and mesh proof is gated by Istio installation. |
