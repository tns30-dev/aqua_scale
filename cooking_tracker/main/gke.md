# GKE Platform Checklist

## Target

| Item | Selection |
|---|---|
| Main runtime | Google Kubernetes Engine |
| Environment model | Namespaces per environment |
| Deployment format | Kustomize |
| GitOps | Argo CD |
| External edge | GCP External Application Load Balancer |
| Network | Custom VPC with VPC-native GKE |
| Node posture | Private nodes if feasible |
| Internal security | Istio-compatible Google Cloud Service Mesh |
| Image registry | GCP Artifact Registry |

## Cluster Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create GKE cluster | Cluster visible |
| [ ] | Attach cluster to custom VPC | Cluster uses AquaShield VPC |
| [ ] | Configure VPC-native networking | Pod and service secondary ranges |
| [ ] | Configure GKE subnet | Node subnet ready |
| [ ] | Configure pod secondary range | Pod IP range ready |
| [ ] | Configure service secondary range | Service IP range ready |
| [ ] | Enable private nodes if feasible | Nodes have no public IPs |
| [ ] | Configure Cloud NAT if private nodes need egress | Controlled outbound access |
| [ ] | Enable Private Google Access | Private access to Google APIs |
| [ ] | Create namespaces | `aquashield-dev`, `aquashield-staging`, optional `aquashield-prod` |
| [ ] | Configure node pools | Workload-ready nodes |
| [ ] | Configure Workload Identity | Kubernetes-to-GCP IAM binding |
| [ ] | Configure Artifact Registry pull access | Pods can pull images |
| [ ] | Configure Gateway/Ingress controller | External routing ready |
| [ ] | Configure Cloud Armor integration | WAF/rate limit attached |
| [ ] | Configure Service Mesh | Sidecar injection and mTLS ready |
| [ ] | Configure Kubernetes NetworkPolicy support | Pod traffic policies can be enforced |
| [ ] | Install Argo CD | GitOps controller ready |
| [ ] | Configure External Secrets or Kubernetes Secrets | Service credentials available |

## Workload Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create Deployment per service | Service pods running |
| [ ] | Create Service per workload | Stable DNS and routing |
| [ ] | Add readiness/liveness probes | Healthy rollout behavior |
| [ ] | Add resource requests/limits | Scheduling and cost control |
| [ ] | Add HorizontalPodAutoscaler | Autoscaling evidence |
| [ ] | Add PodDisruptionBudget | Availability evidence |
| [ ] | Run containers as non-root | Hardened runtime |
| [ ] | Use read-only root filesystem where possible | Hardened runtime |
| [ ] | Add ConfigMaps and Secrets | Runtime configuration |
| [ ] | Add OpenTelemetry env/config | Tracing and metrics |
| [ ] | Add NetworkPolicy per service group | Pod-to-pod traffic restricted |

## Namespace Layout

| Namespace | Purpose |
|---|---|
| `aquashield-dev` | Development/demo workloads |
| `aquashield-staging` | Pre-demo verification |
| `argocd` | Argo CD controller and UI |
| `istio-system` | Mesh control plane if required |
| `monitoring` | Prometheus/Grafana/observability components if self-managed |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Cluster screenshot | GKE cluster visible |
| [ ] | VPC/subnet screenshot | Cluster network visible |
| [ ] | Pod/service secondary range screenshot | VPC-native evidence |
| [ ] | Private node or NAT screenshot | Controlled node egress evidence |
| [ ] | Namespace screenshot | Namespaces visible |
| [ ] | Pod list | Service pods running |
| [ ] | HPA screenshot | Autoscaling configured |
| [ ] | Mesh mTLS evidence | Service traffic protected |
| [ ] | Rolling update evidence | Service updates without full-system restart |
