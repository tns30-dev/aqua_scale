# Phase 8 — Compliance as Code + Regulatory Mapping (2026-08-09)

## Infrastructure as Code (rubric d.i)

Tools: **Terraform** (GCP foundation + AWS IoT bridge, `infra/`, GCS remote
state) and **Kustomize** (Kubernetes overlays, `k8s/`).

```text
terraform fmt -check -recursive infra              → PASS (no diffs)
terraform -chdir=infra/environments/dev validate   → Success! The configuration is valid.
kubectl kustomize k8s/overlays/dev                 → renders cleanly
```

The dev overlay renders **82 resources**, showing the platform is fully
declared as code:

| Kind | Count |
|---|---|
| Deployment / Service / ServiceAccount / ConfigMap / HPA / PodDisruptionBudget | 9 each |
| NetworkPolicy (default-deny + per-service) | 12 |
| Istio AuthorizationPolicy | 10 |
| Istio PeerAuthentication (strict mTLS) | 1 |
| Gateway + HTTPRoute | 1 + 2 |
| Namespace / CronJob | 1 / 1 |

Render snapshot kept in session scratchpad (`kustomize-dev-render.yaml`);
the applied state is Terraform evidence in
`docs/second_evidence/cloud_native_environment/2026-08-08-new-project-bootstrap.md`.

## Version-control audit trail (rubric d.ii)

```text
git rev-list --count HEAD → 113 commits on main
Authors: tns30-dev (102), github-actions[bot] (6 GitOps commits), Claude (5)
```

Conventional-commit discipline + machine commits are distinguishable:

```text
a5ba92d chore(gitops): update dev images to f4f6dd8667af [skip ci]   ← CI bot (GitOps handoff)
fa024d3 test(identity): isolate pubsub in non-event integration tests
311bd06 chore(ci): make workflow evidence names presentable
85b6bab fix(edge): allow firebase frontend cors
```

The `chore(gitops)` commits are the audit trail of every image released to the
cluster: who (bot), what (image tags), from which CI run, reversible by revert.

## Regulatory framework mapping (rubric e — GDPR-leaning)

| Control in this platform | Framework hook |
|---|---|
| Short-lived JWTs carrying an authz *version*, not the permission matrix; opaque rotating refresh tokens | GDPR Art. 5(1)(c) data minimisation; Art. 32 security of processing |
| Fail-closed authorization (Redis snapshot miss → deny) | Art. 32 — integrity/confidentiality by default |
| TLS everywhere: HTTPS/WSS at edge, strict mTLS (Istio PeerAuthentication) in-mesh, MQTT/TLS + X.509 at IoT ingress | Art. 32 — encryption in transit |
| No long-lived cloud keys: GitHub OIDC → Workload Identity Federation; least-privilege deployer SA | Art. 32 + Art. 25 privacy by design (minimised credential surface) |
| Secret scanning gate (gitleaks) + no secrets in code/state | Art. 32 — protection against unauthorised disclosure |
| Dedicated audit-service event log (4,988 events locally) | Art. 30 records of processing; SOC 2 CC7-style monitoring |
| Default-deny NetworkPolicy + three-layer firewall model | Art. 25 data protection by design/default |
| DSR readiness: user data confined to `identity_access` schema, service-owned schemas bound contexts | Art. 15–17 access/erasure feasibility |

## Phase verdict

| Check | Result |
|---|---|
| Terraform fmt + validate | PASS |
| Kustomize dev overlay render (82 resources) | PASS |
| Git audit trail extracted (113 commits, bot trail distinct) | PASS |
| Regulatory mapping documented | PASS |
