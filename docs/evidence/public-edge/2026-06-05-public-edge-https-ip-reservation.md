# Public API HTTPS Edge Static IP Reservation - 2026-06-05

Update: the live DNS, managed certificate, Gateway, backend health, CI/SAST recovery, and public business-flow smoke evidence is now recorded in `2026-06-05-public-edge-live-rollout.md`. This file remains the static-IP reservation evidence for the earlier Terraform slice.

## Scope

The selected public API edge path is HTTPS with a real domain and Google-managed TLS, not temporary HTTP-only exposure.

This slice added:

- Terraform `api-edge` module for the global static API address and optional Google-managed SSL certificate.
- `api-edge-proxy` in-cluster Nginx proxy so the GKE Gateway uses supported `PathPrefix` routes while Nginx owns the legacy path-aware routing exceptions.
- `dev-managed-public` overlay changes for:
  - GKE Gateway named address `aquashield-dev-api-edge`.
  - HTTPS listener with pre-shared certificate name `aquashield-dev-api-edge`.
  - HTTP-to-HTTPS redirect route.
  - `/api` and `/ws` routes to `api-edge-proxy:8080`.
  - `HealthCheckPolicy` against `api-edge-proxy /healthz`.

## Validation

```text
terraform fmt -check -recursive infra
PASS

terraform -chdir=infra/environments/dev validate
PASS

kubectl kustomize k8s/overlays/dev-managed-public
PASS

kubectl apply --dry-run=server -k k8s/overlays/dev-managed-public
PASS
```

Server-side dry run accepted the Gateway API, HealthCheckPolicy, NetworkPolicy, and Istio AuthorizationPolicy resources.

## Terraform Plan And Apply

Terraform inputs:

```text
project_id = aerobic-guide-498413-u6
enable_public_api_edge = true
api_domain = ""
```

Plan:

```text
Plan: 1 to add, 0 to change, 0 to destroy.

module.api_edge[0].google_compute_global_address.api
name: aquashield-dev-api-edge
project: aerobic-guide-498413-u6
```

Apply:

```text
Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

api_edge_address = "8.232.154.25"
api_edge_address_name = "aquashield-dev-api-edge"
api_edge_certificate_domains = []
```

No managed certificate was requested yet because `api_domain` is intentionally empty until a real DNS name is selected.

Post-apply drift check:

```text
terraform -chdir=infra/environments/dev plan -var-file=terraform.tfvars
No changes. Your infrastructure matches the configuration.
```

## Live Deployment Status

The static IP is live. The public Gateway/LB is not applied yet.

Reason:

- Google-managed certificates require a real domain and DNS pointing at the load balancer address.
- The overlay still uses the placeholder hostname `api.aquashield.example.com`.
- Firebase Hosting should use HTTPS API and WSS URLs, so the API certificate must be active before final frontend deploy.

## Next Evidence

1. Choose the real API hostname, for example `api.<domain>`.
2. Create an `A` record for that hostname pointing to `8.232.154.25`.
3. Set `api_domain` in `infra/environments/dev/terraform.tfvars`.
4. Apply Terraform to create the Google-managed SSL certificate.
5. Replace the public overlay hostname with the real API hostname.
6. Apply/sync `k8s/overlays/dev-managed-public` through Argo CD.
7. Smoke `https://<api-domain>/api/...` and `wss://<api-domain>/ws`.
8. Configure Firebase frontend env values and deploy Hosting.
