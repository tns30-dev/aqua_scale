# Logical Architecture Documentation

## Mermaid Diagram

```mermaid
flowchart LR
  User[Web User] --> Edge[API Gateway Edge]
  Edge --> Identity[Identity and Access Service]
  Edge --> Project[Project Service]
  Edge --> Pond[Pond Service]
  Edge --> Sensor[Sensor Service]
  Edge --> Analytics[Analytics Service]
  Edge --> AuditQuery[Audit Query API]
  User --> Realtime[Realtime Gateway]

  Device[Edge Device or Simulator] --> IoT[AWS IoT Core]
  IoT --> Bridge[AWS Lambda Bridge]
  Bridge --> PubSub[Google Pub/Sub]

  PubSub --> Ingestion[Ingestion Service]
  Ingestion --> Sensor
  Ingestion --> Notification[Notification Service]
  Ingestion --> Realtime
  Ingestion --> Analytics
  Notification --> Project
  Notification --> Pond
  Notification --> Realtime

  Identity --> SQL[(Cloud SQL)]
  Project --> SQL
  Pond --> SQL
  Sensor --> SQL
  Notification --> SQL
  AuditQuery --> SQL
  Audit[Audit Service] --> SQL

  Ingestion --> Bigtable[(Cloud Bigtable Target)]
  Analytics --> BigQuery[(BigQuery Target)]
  Realtime --> Redis[(Redis or Memorystore)]
  Project --> Redis
  Sensor --> Redis
  Notification --> Redis
  PubSub --> Audit
```

## Documentation Checklist

| Status | Item | Output |
|---|---|---|
| [ ] | List every logical service | Service catalogue |
| [ ] | Define service responsibility | Responsibility matrix |
| [ ] | Define synchronous calls | gRPC communication map |
| [ ] | Define event consumers | Pub/Sub consumer map |
| [ ] | Define owned data stores | Data ownership map |
| [ ] | Define public entry points | REST/WebSocket entry map |
| [ ] | Define future placeholders | ML/LLM add-on boxes |

## Service Catalogue

| Service | Runtime | Main Responsibility |
|---|---|---|
| Identity and Access | Java | Users, roles, tokens, access checks |
| Project | Java | Projects, profiles, parameters, thresholds |
| Pond | Java | Ponds, cycles, health, stage metrics |
| Sensor | Java | Device, sensor, port, pond mappings |
| Ingestion | Java | Telemetry validation, persistence, events |
| Notification | Java | Alert lifecycle and notification events |
| Realtime Gateway | Java WebFlux | WebSocket sessions and fanout |
| Analytics | TypeScript | Charts, comparisons, summaries |
| Audit | Java | Append-only audit records |
| ML | Python future | Future model serving |
| LLM | Python future | Future LLM/RAG add-on |

