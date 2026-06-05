# GKE Runtime Foundation Apply Evidence - 2026-06-05

## Scope

Applied the dev runtime foundation in GCP project `aerobic-guide-498413-u6`.

Target region/zone:

```text
region: asia-southeast1
zone: asia-southeast1-a
```

## Terraform Apply

Applied saved plan:

```text
/tmp/aquashield-dev-foundation-runtime.tfplan
```

Created resources:

- VPC: `aquashield-dev-vpc`
- GKE subnet: `aquashield-dev-gke-subnet`
- Pod secondary range: `aquashield-dev-pods` (`10.20.0.0/16`)
- Service secondary range: `aquashield-dev-services` (`10.30.0.0/20`)
- Cloud Router: `aquashield-dev-vpc-router`
- Cloud NAT: `aquashield-dev-vpc-nat`
- Firewall: `aquashield-dev-vpc-allow-gclb-health-checks`
- Firewall: `aquashield-dev-vpc-allow-internal`
- GKE cluster: `aquashield-dev-gke`
- GKE node pool: `aquashield-dev-primary`

Cloud Armor scope decision:

```text
DESIGN_ONLY
SECURITY_POLICIES quota: 0
SECURITY_POLICY_RULES quota: 0
SECURITY_POLICY_CEVAL_RULES quota: 0
```

Cloud Armor stays in the architecture/design docs, but runtime evidence is not required for this implementation. The failed security-policy state entry was removed because GCP deleted the rejected policy, and dev Terraform gates the security module with `enable_cloud_armor = false`.

Final Terraform verification:

```text
terraform fmt -check -recursive infra
PASS

terraform -chdir=infra/environments/dev validate
PASS

terraform -chdir=infra/environments/dev plan -var-file=terraform.tfvars -detailed-exitcode
PASS; no changes
```

## Terraform Outputs

```text
cluster_name = "aquashield-dev-gke"
network_name = "aquashield-dev-vpc"
subnet_name = "aquashield-dev-gke-subnet"
github_deployer_service_account = "aquashield-github-deployer@aerobic-guide-498413-u6.iam.gserviceaccount.com"
github_workload_identity_provider = "projects/294489509399/locations/global/workloadIdentityPools/github-actions/providers/github-actions"
```

Artifact Registry repositories remain managed in the same state:

```text
analytics-service
audit-service
identity-access-service
ingestion-service
notification-service
pond-service
project-service
realtime-gateway
sensor-service
```

## GKE Verification

Cluster:

```text
name: aquashield-dev-gke
status: RUNNING
location: asia-southeast1-a
version: 1.35.3-gke.1389002
private nodes: true
network: aquashield-dev-vpc
subnetwork: aquashield-dev-gke-subnet
```

Node pool:

```text
name: aquashield-dev-primary
status: RUNNING
machine type: e2-standard-2
autoscaling: min 1, max 3
```

Kubernetes node:

```text
Ready
internal IP: 10.10.0.3
external IP: <none>
runtime: containerd
```

Core namespaces and system pods are active. System pods in `kube-system`, `gmp-system`, and GKE-managed namespaces reported `Running`.

## Network Verification

VPC:

```text
name: aquashield-dev-vpc
autoCreateSubnetworks: false
routingMode: REGIONAL
```

Subnet:

```text
name: aquashield-dev-gke-subnet
primary CIDR: 10.10.0.0/20
privateIpGoogleAccess: true
pod range: aquashield-dev-pods 10.20.0.0/16
service range: aquashield-dev-services 10.30.0.0/20
```

Cloud NAT:

```text
name: aquashield-dev-vpc-nat
natIpAllocateOption: AUTO_ONLY
sourceSubnetworkIpRangesToNat: LIST_OF_SUBNETWORKS
sourceIpRangesToNat: ALL_IP_RANGES
```

Terraform firewall rules:

```text
aquashield-dev-vpc-allow-gclb-health-checks
source: 130.211.0.0/22, 35.191.0.0/16
allow: tcp:80,tcp:443,tcp:8080

aquashield-dev-vpc-allow-internal
source: 10.10.0.0/20, 10.20.0.0/16, 10.30.0.0/20
allow: icmp, udp, tcp
```

GKE also created its managed cluster firewall rules.

## Rollout Preflight

Gateway API is available:

```text
gateway.networking.k8s.io/v1 GatewayClass, Gateway, HTTPRoute
GKE GatewayClasses accepted
```

Dev overlay server-side dry run is not yet ready:

```text
BLOCKED
Missing Istio CRDs:
- security.istio.io/v1beta1 AuthorizationPolicy
- security.istio.io/v1beta1 PeerAuthentication
```

Next required platform step: install Istio/control-plane CRDs or split mesh resources into a later sync wave before creating the Argo CD application.
