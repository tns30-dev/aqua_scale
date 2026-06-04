# Deployment Documentation

## Mermaid Diagram

```mermaid
flowchart TB
  Git[Git Repository] --> Actions[GitHub Actions]
  Actions --> Registry[Artifact Registry]
  Actions --> GitOps[GitOps Manifest Commit]
  GitOps --> Argo[Argo CD]

  Internet[Internet] --> LB[External Load Balancer]
  LB --> Armor[Cloud Armor]

  subgraph VPC[AquaShield Custom VPC]
    VpcFirewall[VPC Firewall Rules]

    subgraph GkeSubnet[GKE Subnet]
      PodRange[Pod Secondary Range]
      ServiceRange[Service Secondary Range]

      subgraph GKE[GKE Cluster]
        subgraph Dev[aquashield-dev Namespace]
          GW[Gateway or Ingress]
          ID[identity-access-service Deployment]
          PRJ[project-service Deployment]
          POND[pond-service Deployment]
          SNS[sensor-service Deployment]
          ING[ingestion-service Deployment]
          NOTI[notification-service Deployment]
          RT[realtime-gateway Deployment]
          ANA[analytics-service Deployment]
          AUD[audit-service Deployment]
        end

        subgraph Mesh[Service Mesh]
          MTLS[Strict mTLS]
          AUTHZ[AuthorizationPolicy]
        end
      end
    end

    subgraph PrivateData[Private Data Tier]
      SQL[(Cloud SQL Private IP)]
      Redis[(Memorystore / Redis)]
    end

    PrivateAccess[Private Google Access / PSC]
  end

  subgraph GoogleApis[Google Managed APIs]
    PubSub[Google Pub/Sub]
    Bigtable[(Bigtable Target)]
    BigQuery[(BigQuery Target)]
    Storage[(Cloud Storage)]
  end

  Registry --> ID
  Registry --> PRJ
  Registry --> POND
  Registry --> SNS
  Registry --> ING
  Registry --> NOTI
  Registry --> RT
  Registry --> ANA
  Registry --> AUD
  Argo --> ID
  Argo --> PRJ
  Argo --> POND
  Argo --> SNS
  Argo --> ING
  Argo --> NOTI
  Argo --> RT
  Argo --> ANA
  Argo --> AUD
  Armor --> VpcFirewall
  VpcFirewall --> GW
  GW --> ID
  GW --> PRJ
  GW --> POND
  GW --> SNS
  GW --> NOTI
  GW --> RT
  GW --> ANA
  GW --> AUD
  ID --> SQL
  PRJ --> SQL
  POND --> SQL
  SNS --> SQL
  NOTI --> SQL
  RT --> Redis
  PRJ --> Redis
  SNS --> Redis
  ING --> PrivateAccess
  ANA --> PrivateAccess
  PrivateAccess --> PubSub
  PrivateAccess --> Bigtable
  PrivateAccess --> BigQuery
  PrivateAccess --> Storage
```

## Presentation Diagram

```mermaid
flowchart TB
  Dev[Developer Push] --> CI[GitHub Actions CI]
  CI --> AR[Artifact Registry]
  CI --> GitOps[GitOps Manifest Update]
  GitOps --> Argo[Argo CD]

  User[Users] --> Firebase[Firebase Hosting<br/>React Frontend]
  Firebase --> Edge[GCP External HTTPS Load Balancer<br/>Cloud Armor + TLS + Gateway/Ingress]

  Pi[Raspberry Pi / Simulated Devices] --> IoT[AWS IoT Core<br/>MQTT + device certificates]
  IoT --> Lambda[AWS Lambda Bridge]
  Lambda --> PubSub[Google Pub/Sub<br/>event bus + DLQ]

  subgraph GCP[GCP Project]
    subgraph VPC[AquaShield Custom VPC]
      subgraph GKE[GKE Cluster]
        Services[Microservices in GKE<br/>- Identity and Access<br/>- Project, Pond, Sensor<br/>- Ingestion, Notification<br/>- Realtime Gateway<br/>- Analytics, Audit]
        Mesh[Istio Service Mesh<br/>mTLS + AuthorizationPolicy]
      end

      Redis[(Memorystore Redis<br/>- authz snapshot<br/>- cache/rate limit<br/>- WS fanout)]
      SQL[(Cloud SQL PostgreSQL<br/>primary + read replica)]
    end

    Bigtable[(Cloud Bigtable<br/>telemetry time-series)]
    BigQuery[(BigQuery<br/>analytics warehouse)]
    Storage[(Cloud Storage<br/>reports/artifacts)]
  end

  Argo --> Services
  AR --> Services
  Edge --> Services
  Services <--> Mesh
  Services --> Redis
  Services --> SQL
  PubSub --> Services
  Services --> Bigtable
  Services --> BigQuery
  Services --> Storage
```

## Presentation Diagram Notes

| Area | What To Say |
|---|---|
| Frontend | Firebase Hosting serves the React SPA. API and WebSocket traffic goes to the GCP edge endpoint. |
| GCP edge | External HTTPS Load Balancer, Cloud Armor, managed TLS, and GKE Gateway/Ingress protect and route backend traffic. |
| Services | The diagram groups microservices for readability. Detailed service-level deployment remains in the implementation diagram above. |
| Redis | Memorystore supports authorization snapshots, cache/rate limits, and WebSocket cross-pod fanout. |
| Data tier | Cloud SQL stores transactional data; Bigtable stores telemetry time-series; BigQuery supports historical analytics. |
| IoT ingress | Devices publish to AWS IoT Core. Lambda bridges normalized events into Google Pub/Sub. |
| GitOps | CI builds and pushes images to Artifact Registry, updates GitOps manifests, and Argo CD reconciles GKE. |

## Manifest Checklist

| Status | Manifest | Purpose |
|---|---|---|
| [ ] | Namespace | Environment boundary |
| [ ] | VPC/subnet | Network boundary for private workloads |
| [ ] | ServiceAccount per service | Workload identity |
| [ ] | Deployment per service | Workload rollout |
| [ ] | Service per service | Stable DNS |
| [ ] | ConfigMap per service | Runtime config |
| [ ] | Secret/ExternalSecret per service | Sensitive config |
| [ ] | HPA per service | Autoscaling |
| [ ] | PDB per service | Availability during disruption |
| [ ] | Gateway/Ingress | External routing |
| [ ] | NetworkPolicy | Pod traffic control |
| [ ] | AuthorizationPolicy | Mesh access control |
| [ ] | PeerAuthentication | Strict mTLS |
| [ ] | Argo CD Application | GitOps deployment |

## Deployment Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Build service image | Image in Artifact Registry |
| [ ] | Update Kustomize image tag | GitOps commit |
| [ ] | Argo CD sync | Deployment applied |
| [ ] | Rolling update | Only changed service pods restart |
| [ ] | Verify private data access | Services reach data tier privately |
| [ ] | Verify blocked direct access | Public cannot access pods/databases directly |
| [ ] | Run smoke test | Health/API check passes |
| [ ] | Capture rollout evidence | Screenshot/logs |
