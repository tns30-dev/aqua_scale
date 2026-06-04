# Security Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns platform security architecture, cloud/network controls, service-to-service protection, and security evidence.
- Current state: Application-layer authn/authz is implemented and tested. CI security gates exist. Cloud firewall, mesh evidence, DAST, and final security screenshots are pending.
- Current test: Existing auth integration tests, Redis snapshot evidence, CI gates, container scans, and local e2e security paths.
- Next test: Prove GKE/Istio mTLS and AuthorizationPolicy behavior on a live cluster, then run post-deploy DAST against dev/staging.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Authn/Authz workflow | DONE | Identity mints RS256 JWTs and authz snapshots; resource services verify public-key JWTs and fail closed on missing snapshots. | `../../docs/evidence/project-service/2026-06-04-tests-and-cross-service-smoke.txt` | 2026-06-04 |
| Identity authorization snapshot | DONE | Snapshot keys and versioning are implemented in Redis after login; access/role changes invalidate old state. | `../../docs/evidence/identity-access/` | 2026-06-04 |
| Token lifecycle | DONE | Login, refresh rotation, reuse detection, logout, and jti revocation are implemented and tested. MFA remains optional/deferred. | `../../docs/evidence/identity-access/` | 2026-06-04 |
| Three-layer firewall model | IN_PROGRESS | Network and Cloud Armor Terraform scaffolds exist. Live VPC/firewall/LB policy evidence pending. | `../../infra/modules/network/`, `../../infra/modules/security/`, `../main/network_security.md` | 2026-06-05 |
| Service-to-service protection | IN_PROGRESS | K8s service accounts, NetworkPolicy, strict mTLS manifests, and AuthorizationPolicy skeletons exist. Live mesh evidence pending. | `../../k8s/base/service-accounts.yaml`, `../../k8s/base/mesh/`, `../../k8s/base/services/` | 2026-06-05 |
| Security evidence | IN_PROGRESS | CI gates include Gitleaks, Semgrep, Trivy fs/image scans, and CycloneDX SBOM. DAST and cloud security screenshots are pending. | `../../docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Authn/authz cross-service smoke | PASS in evidence. | 2026-06-04 |
| CI security gates | PASS in CI evidence after dependency hardening. | 2026-06-04 |
| Tracker ownership rewrite | PASS; security is Codex-owned. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Authn/authz workflow, Redis snapshot, token lifecycle, WebSocket security, analytics auth port, and audit trail evidence landed through service work. |
| 2026-06-04 | CI security gates found and drove remediation of real Tomcat/Spring Security critical CVEs. |
| 2026-06-05 | Rephrased security tracker under Codex ownership; cloud security proof remains the next major step. |
