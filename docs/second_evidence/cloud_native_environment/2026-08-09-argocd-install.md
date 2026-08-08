# Argo CD Install + GitOps Registration (2026-08-09)

Installed Argo CD into the new microservice cluster and registered the platform
as a GitOps Application. Done in **manual-sync mode** to coexist safely with
Codex's hand-managed live environment (no auto-prune/self-heal until the overlay
is confirmed to match live intent).

Cluster: `aquashield-dev-gke` / project `aquashield-ms-dev-20260808`.

## Control plane

```text
kubectl create namespace argocd
kubectl apply -n argocd -f .../argo-cd/v3.4.6/manifests/install.yaml
```

- Version: **v3.4.6** (`quay.io/argoproj/argocd:v3.4.6`). Initially installed
  v2.13.3; upgraded to v3.4.6 because v2.13.3's bundled kustomize (v5.4.x) hits a
  known nil-pointer panic (`kyaml RNode.Content`, SIGSEGV) building the
  `dev-managed-public` overlay's `labels:/pairs:` transformer — v3.4.6's newer
  kustomize builds it cleanly (verified locally with kustomize v5.8.1).
- Pods: 7/7 Running (application-controller, applicationset-controller, dex,
  notifications, redis, repo-server, server).

## Private-repo access (no token in chat)

The repo `tns30-dev/aqua_scale` is private. Registered via a dedicated
**read-only SSH deploy key** rather than an account token:

```text
ssh-keygen -t ed25519 …                  # generated locally
gh repo deploy-key add … --title argocd-dev-readonly   # read_only: true (verified)
kubectl -n argocd create secret generic aquashield-repo \
  --from-literal=url=git@github.com:tns30-dev/aqua_scale.git \
  --from-file=sshPrivateKey=… \
  + label argocd.argoproj.io/secret-type=repository
```

The private key lives only in the in-cluster secret (never committed). The
deploy key is read-only and repo-scoped; revoke any time via
`gh repo deploy-key delete` or GitHub → repo → Settings → Deploy keys.

## Application

`k8s/argocd/aquashield-dev-application.yaml` (committed) is the end-state
(automated prune + self-heal, path `k8s/overlays/dev-managed-public`). During
coexistence a **manual-sync variant** was applied (same source/destination,
`automated` block removed) so Argo reports drift without mutating live state.

```text
kubectl -n argocd get application aquashield-dev
  sync:   OutOfSync
  health: Healthy
  revision: 6fbd5a1c8557…        # repo pulled successfully via the deploy key
  managed resources: 95
```

**OutOfSync is expected and safe:** the live environment was applied by hand
(Codex) and has not yet been adopted by Argo, so every resource differs by at
least Argo's tracking metadata plus the overlay's `edge-slice` label. Health is
`Healthy` (all workloads up 2/2 with Istio sidecars). Manual mode means Argo
will **not** prune or overwrite Codex's live resources.

## GitOps loop is consistent (verified for remote CI/CD)

`deploy-handoff.yml` bumps the image tag in `k8s/overlays/dev/kustomization.yaml`.
Argo watches `k8s/overlays/dev-managed-public`. These are the **same chain**:

```text
dev-managed-public → dev-managed → dev-full → … → dev   (newTag lives here)
```

Confirmed by rendering `dev-managed-public` and seeing the `dev`-pinned tag
(`20260808-1440-6fbd5a1c8557`) — which also matches the live cluster image. So a
CI tag bump propagates up to what Argo watches; the loop closes.

## To activate full auto-sync (one coordinated step)

Once Codex confirms `dev-managed-public` == live intent:

```text
kubectl apply -f k8s/argocd/aquashield-dev-application.yaml   # committed auto-sync variant
```

Then: CI build/scan → GAR push → `dev/kustomization.yaml` tag bump commit →
Argo auto-syncs GKE. Rollback = revert the GitOps commit.

## Verdict

| Check | Result |
|---|---|
| Argo CD control plane (v3.4.6) | Running 7/7 |
| Private repo registered (read-only deploy key) | PASS (repo pulled) |
| Application created, resolves git revision | PASS |
| Health / Sync | Healthy / OutOfSync (manual mode, drift expected) |
| Overlay→CI GitOps chain consistent | Verified |
