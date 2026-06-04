# AquaShield Architecture Scale Refinement

Last updated: 2026-06-03

This is the pre-main refinement of `cooking_tracker/background_context/archi_scale.md`.

Scope of this file:

- Only architecture-scale refinement.
- Only the intermediate position before final diagrams and final report text.
- Capture preferences and decisions clearly enough that the next step can produce the workflow checklist, logical architecture, deployment architecture, event-driven architecture, DDD diagram, polyglot persistence diagram, and service/API/event documentation.

## Refinement Direction

The previous background context was acceptable as a first consolidation, but this refinement changes the architecture posture in several important ways:

- Java-first for core business services.
- Avoid Django/Python for core services.
- Keep Python only where it is a strong fit: AI, ML, agentic workflows, model serving, MLOps experiments, and possibly data science scripts.
- Use TypeScript/Node.js where the service is analytics/chart/UI-contract heavy.
- Use gRPC for internal service-to-service communication.
- Use REST/HTTPS for external browser-facing APIs.
- Use Google Cloud as the main platform for Kubernetes, Pub/Sub, Cloud SQL, BigQuery, Cloud Logging, and most deployment evidence.
- Use selected AWS services where they are genuinely stronger for the use case, especially managed IoT/MQTT.
- Keep AWS API Gateway WebSocket only as a future alternative because the selected realtime path is GKE Realtime Gateway.
- Use polyglot persistence intentionally, not as decoration.

## Verified Cloud-Service Assumptions

These assumptions were checked against primary provider documentation during this refinement:

- AWS API Gateway supports managed WebSocket APIs. Official docs describe WebSocket APIs as bidirectional APIs with routes integrated with backend HTTP endpoints, Lambda functions, or AWS services: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html
- AWS IoT Core supports MQTT and MQTT over WSS for device communication: https://docs.aws.amazon.com/iot/latest/developerguide/mqtt.html
- AWS IoT Rules can route MQTT messages to downstream actions including HTTP endpoints, Lambda, DynamoDB, Kinesis, S3, Timestream, and others: https://docs.aws.amazon.com/iot/latest/developerguide/iot-rule-actions.html
- Google Pub/Sub is suitable as the GCP event bus and supports push subscriptions to Cloud Run, App Engine, GKE, and custom environments: https://cloud.google.com/pubsub
- Google Cloud Run supports WebSockets, but WebSocket streams remain subject to request timeout and multi-instance synchronization constraints: https://docs.cloud.google.com/run/docs/triggering/websockets
- Google Cloud external Application Load Balancers support the WebSocket protocol when HTTP or HTTPS is used to the backend: https://docs.cloud.google.com/load-balancing/docs/https
- Google Cloud Bigtable is suitable for high-throughput, low-latency time-series/IoT-style workloads and has official time-series schema guidance: https://docs.cloud.google.com/bigtable/docs/overview and https://docs.cloud.google.com/bigtable/docs/schema-design-time-series
- Google Service Directory supports service discovery across Google Cloud, multi-cloud, and on-prem environments: https://docs.cloud.google.com/service-directory/docs/overview
- Google Cloud Service Mesh supports traffic management, service discovery, observability, and security for gRPC and Kubernetes/service workloads: https://cloud.google.com/products/service-mesh

## Key Architectural Position

AquaShield should not be presented as "Django rewritten into microservices" only. The stronger story is:

> An inherited Django monolith is stabilized, studied, and then re-architected into a Java-first, gRPC-based, cloud-native aquaculture operations platform, using GCP for Kubernetes and eventing, AWS for managed IoT/WebSocket edge capabilities where appropriate, and Python only for AI/ML-specific workloads.

This gives a stronger personal capability narrative:

- You can inherit and stabilize unfamiliar Python/Django code.
- You can identify domain boundaries.
- You can redesign into technologies you are stronger in.
- You can use cloud-managed services instead of simply self-hosting everything.
- You can defend language, protocol, data-store, and cloud-provider choices.

## Language And Runtime Policy

### Java-First Rule

Core domain services should be Java.

Preferred stack:

- Java 21
- Spring Boot
- Spring Security
- Spring Data/JPA where relational data is used
- gRPC Java with Protocol Buffers for internal contracts
- REST controllers only where a service must expose browser/BFF-facing APIs
- OpenTelemetry Java agent or SDK
- JUnit/Testcontainers

Why Java:

- Strong fit for long-lived backend services.
- Mature ecosystem for enterprise security, gRPC, observability, validation, and testing.
- Stronger personal fit than Django/Python.
- Easy to defend in a software engineering capstone.

### TypeScript/Node.js Rule

Use TypeScript/Node.js where the service is heavily shaped by frontend contracts, chart data, JSON aggregation, and existing TypeScript logic.

Preferred stack:

- TypeScript
- NestJS or Express/Fastify
- Zod or class-validator for schema validation
- gRPC client/server support where internal calls are needed
- Jest/Vitest
- OpenTelemetry Node

Best fit:

- Analytics and Chart Service
- BFF-style aggregation if needed
- WebSocket bridge functions if AWS Lambda is used with TypeScript

### C#/.NET Rule

C#/.NET is acceptable, but not the default for this project unless there is a clear reason. Adding Java, Node.js, Python, and C# all at once may look unfocused.

Possible use:

- A single optional service if there is a good showcase reason.
- Otherwise keep .NET as a future alternative, not part of the first implementation slice.

### Python Rule

Do not use Python/Django for new core services.

Python is allowed for:

- FastAPI AI service
- ML model serving
- Agentic AI workflows
- MLOps experiment/training scripts
- Data science notebooks or batch training jobs
- Evaluation scripts for LLM quality/security

## Internal Communication

### Preferred Internal Protocol: gRPC

Use gRPC for service-to-service communication.

Why:

- Strong contracts through `.proto` files.
- Works across Java, TypeScript, Python, and .NET.
- Good performance over HTTP/2.
- Natural fit for internal synchronous calls.
- Easy to show in software design diagrams.

Use gRPC for:

- Identity/access checks from internal services when token claims are insufficient.
- Project/Profile lookup.
- Pond/Cycle lookup.
- Sensor registry lookup.
- Alert service calls where immediate validation is required.
- AI service calls from orchestration components, if implemented.

Do not use gRPC for:

- Browser frontend calls.
- Public API consumed directly by React.
- High-volume async telemetry streams where Pub/Sub/events are better.

### External API Style

Use REST/JSON for browser-facing APIs.

Rationale:

- React consumes REST more easily.
- API Gateway/OpenAPI tooling is more straightforward.
- It aligns with current AquaShield frontend patterns.

External clients should not call every microservice directly. Use an API Gateway and optionally a BFF/API composition layer.

## API Gateway Decision

Decision status: accepted.

### Selected Main API Gateway: GCP Edge Gateway Layer

Because the main workload runs on GKE, the REST API edge should stay mostly in GCP.

Selected GCP edge shape:

- Global External Application Load Balancer
- GKE Gateway API or GKE Ingress
- Cloud Armor WAF/rate limiting
- Managed TLS certificate
- Routing to API/BFF services inside GKE

Important naming clarification:

- In this architecture, "API Gateway" means the GCP edge gateway layer for GKE workloads.
- The selected implementation is External Application Load Balancer + GKE Gateway/Ingress + Cloud Armor.
- We are not selecting the standalone Google Cloud API Gateway product as the primary REST gateway for GKE services.

Possible additions:

- Google API Gateway for specific REST APIs if the implementation is Cloud Run/serverless oriented.
- Apigee is powerful but likely too heavy/costly for this academic project unless only discussed as enterprise future work.

Position:

- For the capstone, "API Gateway" will be represented by GCP External Application Load Balancer + GKE Gateway/Ingress + Cloud Armor + API/BFF routing.
- This is more natural for GKE than forcing AWS API Gateway in front of GCP workloads.
- This gives a defensible cloud-native gateway story without adding an unnecessary gateway product in front of Kubernetes.

## CDN Decision

Decision status: accepted as a target architecture component.

### Selected CDN Position

Add a CDN layer for frontend/static delivery.

Recommended first implementation:

- Google Cloud CDN attached to the GCP External Application Load Balancer.
- Cloud Storage backend bucket or frontend hosting backend for React build assets.
- Cache static assets such as JS bundles, CSS, images, icons, documentation exports, and public media.

Cloudflare position:

- Cloudflare is a valid Phase 4 / hyper-scale CDN option.
- Use Cloudflare in the diagram as an optional global CDN/WAF provider if we want to mirror the scalability reference.
- Do not make Cloudflare mandatory for the first implementation because GCP Cloud CDN fits the selected GCP Load Balancer/GKE edge more naturally.

Recommended wording for diagrams:

```text
Users
  -> Global CDN (GCP Cloud CDN; Cloudflare optional)
  -> GCP External Application Load Balancer + Cloud Armor
  -> GKE Gateway/Ingress
  -> API/BFF + Services
```

What CDN should cache:

- React static assets.
- public images/icons.
- generated report files if safe and public/signed.
- documentation/demo assets.

What CDN should not cache:

- authenticated REST API responses unless explicitly designed.
- WebSocket messages.
- JWT/session responses.
- user-specific pond/project data.
- realtime alert payloads.

Why useful:

- Reduces frontend load time for users far from the GCP region.
- Reduces origin traffic to GKE or frontend hosting.
- Absorbs traffic spikes for static assets.
- Supports a Phase 4 scalability story without adding complexity to core services.
- Keeps dynamic APIs protected by Cloud Armor and routed through GKE Gateway.

Implementation guardrails:

- Use immutable hashed asset filenames from the frontend build.
- Set long cache TTLs for hashed assets.
- Set no-store/private headers for authenticated API responses.
- Keep `/api/**` and `/ws` non-cacheable.
- If Cloudflare is used later, avoid overlapping/conflicting WAF/rate-limit rules with Cloud Armor unless clearly documented.

### AWS API Gateway Use

Use AWS API Gateway specifically for WebSocket if we choose the managed WebSocket route.

Do not force AWS API Gateway as the main REST API gateway unless the service is deployed in AWS.

## WebSocket / Realtime Decision

### Preference

Prefer a self-managed Realtime Gateway running on GKE, protected by managed GCP edge infrastructure.

### Option A: AWS API Gateway WebSocket (Future Alternative)

Use AWS API Gateway WebSocket as the managed realtime edge.

Suggested shape:

1. Browser connects to AWS API Gateway WebSocket.
2. `$connect` route validates auth through Lambda or an authorizer pattern.
3. Connection IDs and project/pond subscriptions are stored in DynamoDB.
4. GCP-side Realtime Bridge consumes Pub/Sub events such as `reading.ingested` and `alert.created`.
5. Realtime Bridge calls AWS API Gateway Management API to push messages to subscribed connection IDs.
6. `$disconnect` route removes connection records.

Pros:

- Strong managed WebSocket story.
- Clear multi-cloud architecture evidence.
- Offloads connection management from GKE.
- AWS has first-class WebSocket API Gateway docs and operational model.

Cons:

- Cross-cloud auth and networking complexity.
- Need connection registry in DynamoDB.
- Need secure bridge from GCP Pub/Sub events to AWS push calls.
- More difficult to implement under time pressure.

Use this if:

- We want a visible multi-cloud component.
- We can implement a small working bridge.
- We can produce clear diagrams and demo evidence.

Decision:

- Do not select this for the first AquaShield implementation.
- Keep it as an enterprise/future alternative only.
- Continue using AWS for IoT/MQTT, not for WebSocket in the first slice.

### Option B: GCP Load Balancer + Realtime Gateway On GKE (Selected)

Use a Java Spring WebFlux Realtime Gateway running on GKE, fronted by Google Cloud External Application Load Balancer.

Pros:

- Simpler because main workloads and Pub/Sub are in GCP.
- Google Load Balancer supports WebSockets.
- Easier to implement and debug.
- Reuses an implementation pattern already proven in the ChronoFlow `wsgateway` service.
- Keeps REST edge and WebSocket edge in the same GCP/GKE operational model.
- Avoids cross-cloud connection registry and push complexity.

Cons:

- Not as "managed WebSocket gateway" as AWS API Gateway.
- The application still owns connection lifecycle and fanout logic.
- Needs Redis/Memorystore-backed connection state and fanout design.

Use this because:

- It is more realistic for the available implementation time.
- It aligns with the selected GKE platform.
- It lets us reuse existing security knowledge from ChronoFlow.
- The report can still show AWS strongly through IoT Core and Greengrass/edge, so the multi-cloud story remains credible.

### ChronoFlow Reference Pattern

Reference repo inspected:

- `/Users/thetnaungsoe/Desktop/Grad Cert 3/security_project/chronoflow-backend/wsgateway`

Useful patterns to carry into AquaShield:

- Java Spring WebFlux WebSocket gateway.
- Explicit first-frame `AUTH` message before subscribing the session.
- Short-lived WebSocket-only JWT minted by `/ws/token`.
- JWT claims scoped with issuer, audience, purpose, expiry, and `jti`.
- Redis-backed token mint rate limiting and `jti` replay protection.
- Origin allow-list to mitigate cross-site WebSocket hijacking.
- Auth timeout for clients that connect but never authenticate.
- Bounded frame sizes for unauthenticated and authenticated inbound traffic.
- Strict inbound message allow-list, mainly `PING`/`PONG`.
- Internal push endpoint protected with `X-Internal-Service-Token`.
- Durable feed/push record in MongoDB with delivered/seen/opened status in the ChronoFlow design.
- K8s deployment hardening: non-root user, read-only root filesystem, probes, HPA, PDB, PodMonitoring, service account, and mesh sidecar injection.

Adjustments needed for AquaShield:

- Replace ChronoFlow notification feed domain with AquaShield realtime events: sensor readings, threshold alerts, device status, and pond/project updates.
- Use project/pond/user subscription mapping instead of only user notification channels.
- Use Google Pub/Sub as the primary event source instead of only internal HTTP push.
- Use Redis/Memorystore for shared connection/subscription state and cross-pod fanout.
- Avoid local-only connection registry as the final scale design.
- Do not add MongoDB for AquaShield unless a later feature creates a clear document-store need.
- If a durable notification/alert feed is needed, use Cloud SQL PostgreSQL because it is business/domain state.
- Use Bigtable for high-volume sensor/time-series data and BigQuery for historical analytics, not for WebSocket session state.
- Remove Nacos/Dubbo assumptions for AquaShield; use Kubernetes DNS, gRPC, and optional Cloud Service Mesh/Istio for internal service traffic.

### Selected Fanout Design

Use Redis/Memorystore-backed fanout.

Target shape:

1. Each Realtime Gateway pod keeps local WebSocket sessions only for clients physically connected to that pod.
2. On successful WS auth, the pod records user/project/pond subscriptions in Redis/Memorystore with TTL.
3. Alert/Notification Service and Ingestion-derived realtime processors publish domain events to Google Pub/Sub.
4. Realtime Gateway workers consume Pub/Sub events such as `reading.ingested`, `alert.created`, and `device.offline`.
5. The gateway resolves the event's target project/pond/user subscriptions through Redis/Memorystore.
6. The event is published to a Redis pub/sub channel or Redis stream keyed by project/pond/user target.
7. All gateway pods receive the fanout signal, but only the pod with matching local sessions pushes to the browser.
8. If no user is online, the event can still be persisted by Alert/Notification/Audit services; the WebSocket gateway does not need to become the source of truth.

Why Redis/Memorystore:

- Supports cross-pod fanout without depending on sticky sessions.
- Fits the existing selected cache/runtime-state layer.
- Makes horizontal scaling realistic when multiple Realtime Gateway replicas run behind the GCP Load Balancer.
- Fixes the weakness in the ChronoFlow pattern where connection channels are only local to one pod.

### Working Decision

Selected: GCP Load Balancer + Realtime Gateway on GKE.

Implementation language: Java Spring WebFlux.

Implementation target:

1. Browser connects to `/ws` through GCP External Application Load Balancer.
2. Realtime Gateway runs on GKE.
3. Browser first obtains short-lived WS token through authenticated REST endpoint.
4. Browser opens WebSocket and sends first-frame `AUTH`.
5. Gateway verifies origin, WS token, expiry, purpose/audience, and replay protection.
6. Gateway subscribes authenticated user to allowed project/pond channels.
7. Gateway stores subscription/connection metadata in Redis/Memorystore with TTL.
8. Gateway consumes Pub/Sub-derived realtime events or receives internal push from Alert/Notification Service.
9. Gateway uses Redis/Memorystore fanout so every replica can receive the signal.
10. Only the replica holding the matching local WebSocket session pushes the event to the browser.

AWS API Gateway WebSocket is documented only as a future alternative.

## MQTT / IoT Decision

Decision status: accepted.

### Replace Mosquitto In Target Architecture

Current Mosquitto is acceptable as inherited/local baseline, but target architecture should use AWS IoT Core.

### Selected IoT Ingress: AWS IoT Core

Use AWS IoT Core for:

- MQTT broker
- Device identity
- Device certificates/policies
- MQTT over TLS
- MQTT over WSS if needed
- IoT Rules routing

### Why This Is Not "Two Event Buses"

This part must be explained carefully.

AWS IoT Core and Google Pub/Sub are both publish/subscribe-shaped systems, but they have different roles in this architecture.

| Layer | Technology | Role |
|---|---|---|
| Device ingress | AWS IoT Core MQTT broker | Accepts device MQTT connections, authenticates devices, applies IoT policies, receives telemetry from edge devices |
| Cross-cloud adapter | AWS IoT Rule + Lambda bridge | Converts device MQTT telemetry into a cloud application event |
| Application event bus | Google Pub/Sub | Distributes normalized events to GCP microservices with subscriptions, retries, DLQs, and fanout |

Key point:

> AWS IoT Core is the managed device communication layer. Google Pub/Sub is the internal application event bus. The Lambda bridge is the boundary between device telemetry ingress and backend event processing.

Why not use AWS IoT Core as the only event bus:

- It is optimized for device connectivity, MQTT topics, device identity, IoT policies, and rules.
- Our backend services run mainly on GCP/GKE.
- GCP services integrate more naturally with Pub/Sub, Dataflow, BigQuery, Cloud Run/GKE consumers, and Cloud Monitoring.
- Pub/Sub gives a cleaner internal event model for multiple backend consumers: ingestion, alerting, analytics, audit, realtime, and AI.

Why not use Pub/Sub directly from the Pi:

- Pub/Sub is not an MQTT device broker.
- The Pi/device side already speaks MQTT.
- AWS IoT Core gives managed device certificates, per-device policies, MQTT over TLS, and IoT rules.
- The current edge code maps naturally to MQTT.

Therefore, this is not "Pub/Sub twice." It is:

```text
MQTT device publish
  -> IoT ingress broker
  -> cross-cloud event bridge
  -> GCP application event bus
```

Suggested shape:

1. Raspberry Pi/device publishes telemetry to AWS IoT Core MQTT topic.
2. AWS IoT policy restricts device to its own topic namespace.
3. AWS IoT Rule filters/transforms message.
4. Rule action sends data to downstream target:
   - selected: Lambda bridge that publishes to GCP Pub/Sub, or
   - fallback: HTTP action to a secured GCP ingestion endpoint, or
   - Kinesis/S3/DynamoDB for AWS-side staging plus bridge later.
5. GCP Pub/Sub receives normalized ingestion events.
6. Java Ingestion Service consumes Pub/Sub and writes validated telemetry to persistence.

Selected bridge for this project:

- AWS IoT Rule invokes an AWS Lambda bridge.
- Lambda normalizes the IoT message envelope and publishes to Google Pub/Sub topic `iot.telemetry.received`.
- Lambda should authenticate to GCP using Workload Identity Federation where possible, not a long-lived service account key.

Alternative bridge:

- AWS IoT Rule HTTP action to a secured GCP HTTPS ingestion bridge endpoint.
- The endpoint verifies AWS-origin signature/header/shared secret and publishes to GCP Pub/Sub.

Decision:

- Select AWS IoT Rule -> AWS Lambda bridge -> Google Pub/Sub.
- Do not call Google Pub/Sub REST API directly from AWS IoT Core.
- Keep the GCP HTTPS ingestion bridge as fallback only if Lambda/WIF setup becomes too time-consuming.

Why this bridge is better architecturally:

- It avoids making the cross-cloud path look like an arbitrary REST call into GCP.
- It keeps AWS IoT integration inside AWS: IoT Core -> IoT Rule -> Lambda.
- It creates an explicit cross-cloud event bridge component.
- It keeps Google Pub/Sub as the first internal GCP event bus boundary.
- It avoids exposing a custom public GCP ingestion endpoint just for AWS IoT.
- The Lambda bridge can add a consistent envelope, correlation IDs, source metadata, and basic schema checks before publishing.

Implementation guardrails:

- Keep Lambda thin. It is not the business ingestion service.
- Do not put alerting, threshold logic, or persistence inside Lambda.
- Use TypeScript for the Lambda bridge if implemented.
- Use GCP Workload Identity Federation from AWS to avoid storing GCP service account keys in AWS.
- Give the GCP service account only `pubsub.publisher` on the target topic.
- Preserve the original payload and HMAC fields so Java Ingestion Service remains the source of truth for application validation.
- Configure AWS IoT Rule error action or CloudWatch alarms for failed bridge invocation.

Important:

- Keep the existing application-level HMAC or equivalent payload integrity even if AWS IoT device certificates are used.
- Device certificate proves device identity at connection level; payload signing/replay controls still help defend downstream data integrity.

### Edge Computing Position

The current `AquaMonitoring-Pi` repo is enough as the first edge-computing baseline.

Current edge capabilities:

- Modbus sensor reading on the Raspberry Pi.
- partial sensor failure handling.
- timestamping and `seq_no`.
- HMAC payload signing.
- MQTT over TLS.
- failed publish queue.
- local SQLite storage mode.
- simulator mode for cloud/demo testing without physical sensors.
- battery alerting.

Decision:

- Do not rewrite or risk the current Pi code during the first cloud-native implementation.
- Use the existing simulator/publisher pattern to generate equivalent telemetry.
- Connect the simulation or edge publisher to AWS IoT Core for the cloud-native ingestion demo.
- Position AWS IoT Greengrass V2 as the future managed edge runtime, not a mandatory first implementation dependency.

Target edge statement:

> AquaShield preserves the existing Raspberry Pi edge implementation as the hardware baseline, uses AWS IoT Core as the managed MQTT/device-ingress layer, and can later package the Pi workload as an AWS IoT Greengrass V2 component for managed edge deployment.

## Async Event Bus Decision

Decision status: accepted.

Use Google Pub/Sub as the main event bus.

Why:

- Main workloads are on GCP/GKE.
- Strong managed service.
- Fits event-driven microservices.
- Push/pull subscription options.
- Integrates well with Cloud Run, GKE, Dataflow, BigQuery, Cloud Logging, and monitoring.

Core topics:

- `iot.telemetry.received`
- `sensor.message.validated`
- `sensor.message.rejected`
- `reading.ingested`
- `reading.quarantined`
- `threshold.violated`
- `alert.created`
- `alert.resolved`
- `notification.requested`
- `notification.sent`
- `analytics.aggregate.requested`
- `ai.analysis.requested`
- `ai.analysis.completed`
- `audit.event.recorded`

Event design rules:

- Events must include `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `source`, and correlation IDs.
- Sensor events must include `deviceId`, `projectId`, `pondId`, `measuredAt`, `seqNo`, and idempotency key.
- Consumers must be idempotent.
- Use dead-letter topics for failed processing.
- Version event schemas.

Dead-letter queue decision:

- Every important subscription should define a Pub/Sub dead-letter topic.
- Failed messages should move to a dead-letter topic after configured delivery attempts.
- Dead-letter topics should be monitored and replayed manually or through a controlled repair job.
- Dead-letter payloads should include the original event, failure reason, consumer name, and correlation IDs when possible.

Example dead-letter topics:

- `iot.telemetry.received.dlq`
- `sensor.message.validated.dlq`
- `reading.ingested.dlq`
- `alert.created.dlq`
- `notification.requested.dlq`
- `analytics.aggregate.requested.dlq`
- `audit.event.recorded.dlq`

## Service Discovery Decision

Do not use Nacos.

### Baseline Service Discovery

Use Kubernetes Service DNS inside GKE.

Why:

- Native to Kubernetes.
- No extra registry to run.
- Services can call `service-name.namespace.svc.cluster.local`.
- Works well for MVP microservices.

### Java/Spring Integration

Possible choices:

- Use direct DNS names configured per service.
- Use Spring Cloud Kubernetes if dynamic service discovery/config is needed.
- Use gRPC clients with DNS targets.

### Selected Service Mesh: Istio / Google Cloud Service Mesh

Use Istio-compatible Google Cloud Service Mesh as the selected service mesh layer for internal service traffic.

- gRPC-aware traffic management.
- mTLS.
- Authorization policies.
- Observability across services.
- Canary/traffic splitting.

Relationship to Kubernetes DNS:

- Kubernetes DNS remains the baseline service discovery mechanism.
- Istio/Cloud Service Mesh does not replace Kubernetes Services.
- The mesh adds mTLS, identity-aware authorization, telemetry, and traffic policy around service-to-service calls.

Reference pattern from ChronoFlow:

- Per-workload sidecar injection using `sidecar.istio.io/inject: "true"`.
- Strict mTLS using Istio `PeerAuthentication`.
- Service-account based caller allow-lists using Istio `AuthorizationPolicy`.
- Dedicated Kubernetes `ServiceAccount` per service.
- Kustomize includes Istio manifests with the rest of the Kubernetes deployment.

AquaShield target pattern:

- Enable mesh sidecar injection for core service pods.
- Use strict mTLS for internal service-to-service traffic.
- Use `AuthorizationPolicy` so only expected service accounts can call each service.
- Permit health and metrics endpoints as needed for probes and monitoring.
- Use mesh telemetry for service dependency evidence, latency, error rates, and gRPC visibility.
- Keep external REST/WebSocket ingress handled by GCP External Application Load Balancer and GKE Gateway/Ingress.

Candidate service-account authorization examples:

- `gateway-sa` can call Identity, Project/Profile, Pond/Cycle, Analytics, and Realtime Gateway.
- `ingestion-service-sa` can call Sensor Registry and publish events.
- `alert-service-sa` can call Project/Profile, Pond/Cycle, Notification, and Audit.
- `analytics-service-sa` can call read-oriented APIs and query analytics stores.
- `realtime-gateway-sa` can receive internal push from Alert/Notification and access Redis/Memorystore.

Use Google Service Directory if we need:

- Multi-cloud service registry.
- Discover external AWS bridge endpoints.
- Register services across GCP, AWS, and possible local/on-prem environments.

Working decision:

- Baseline discovery: Kubernetes DNS.
- Selected mesh: Istio-compatible Google Cloud Service Mesh.
- Multi-cloud registry: Service Directory only if it reduces complexity in the AWS/GCP bridge.

## Polyglot Persistence Decision

Decision status: accepted.

Use the right datastore per workload.

Implementation stance:

- Implement and evidence Cloud SQL PostgreSQL primary plus read-replica behavior because it is comparatively affordable and easy to demonstrate.
- Implement Redis/Memorystore distributed caching/fanout if budget allows; local Redis is acceptable for development evidence and Memorystore is the target managed service.
- Keep Bigtable and BigQuery as target scale components with cost-controlled demos or documented architecture only.
- Do not implement Bigtable replication or BigQuery replication in the student demo.

### Read / Write / Replication Strategy

The target design should not be explained as one large database cluster. AquaShield uses different persistence systems with different read/write and replication behavior.

Global rules:

- Each service owns its data model.
- Writes go through the owning service, not directly from other services.
- Internal services use gRPC/API calls or events instead of reading another service's tables directly.
- Transactional reads that require strong correctness use Cloud SQL through the owning service.
- High-volume sensor/time-series reads use Bigtable.
- Historical analytics and reporting reads use BigQuery.
- Hot repeated reads, rate limits, and realtime fanout state use Redis/Memorystore.
- Cross-service consistency is event-driven, using Pub/Sub plus idempotent consumers and outbox-style publishing where needed.

Recommended read/write/replication model:

| Store | Write Path | Read Path | Replication / HA |
|---|---|---|---|
| Cloud SQL PostgreSQL | Owning Java services write to primary | Owning service reads primary for strong consistency; read replicas for heavy read-only screens/reports | Regional HA primary/standby for failover; read replicas for read scale |
| Cloud Bigtable | Java Ingestion Service writes append-heavy telemetry | Ingestion/Analytics/Realtime services read by row key ranges for recent time-series | Target scale store only; no replication implementation in student demo due cost |
| BigQuery | Dataflow/Pub/Sub pipeline or batch load writes historical facts | Analytics/Chart/ML services run SQL analytics | Target analytics warehouse only; no replication implementation in student demo due cost |
| Redis/Memorystore | Gateways/services write temporary state, cache entries, rate counters, subscriptions | Gateways/services read low-latency volatile state | Standard/cluster tier HA; asynchronous primary-to-replica replication |
| Cloud Storage | Services write files, exports, model artifacts, archives | Users/services read objects by signed URLs or service APIs | Regional/dual-region/multi-region buckets; optional cross-bucket replication |

Important wording:

> PostgreSQL is not the telemetry scale layer. PostgreSQL is the business consistency layer. Bigtable is the operational telemetry scale layer. BigQuery is the historical analytics layer. Redis/Memorystore is the low-latency runtime state layer.

### Transactional Domain Data

Use Cloud SQL for PostgreSQL.

Services:

- Identity and Access
- Project/Profile
- Pond/Cycle
- Sensor Registry
- Alert metadata

Reason:

- Strong relational consistency.
- Existing schema maps well.
- Easy to query and explain.
- Good for admin/config data.

Read/write strategy:

- All writes go to the Cloud SQL primary.
- Read-after-write or permission-sensitive reads use the primary.
- Read-heavy but not immediately consistent queries can use read replicas.
- Do not let services query each other's tables directly.
- Prefer service-owned schemas/databases even if the MVP uses one shared Cloud SQL instance.

Replication / availability:

- MVP cost-saving option: one Cloud SQL PostgreSQL instance.
- Better target: Cloud SQL regional HA instance for primary/standby failover.
- Add read replicas for read-heavy services or reporting views.
- Read replicas are read-only and should not be used for writes.
- Use automated backups and point-in-time recovery.
- Use connection pooling because many microservice pods can exhaust database connections.

Implementation evidence to show:

- Cloud SQL PostgreSQL primary instance.
- Cloud SQL read replica.
- Application configuration separating write datasource and read datasource where useful.
- Write operation goes to primary.
- Read-heavy query or dashboard endpoint can be routed to read replica.
- Screenshot/log evidence that the replica exists and is serving read traffic.
- Kubernetes Secret/External Secret for database credentials.
- Connection pooling configuration in Java services.

Candidate read-replica usage:

- Project/Profile read-only catalogue queries.
- Pond/Cycle list/detail screens.
- Alert history browsing.
- Admin/reporting screens.

Do not use PostgreSQL read replicas for:

- login/session writes,
- permission updates,
- alert state mutation,
- ingestion hot path,
- sensor time-series bulk writes.

### Raw Sensor Messages

Preferred target: Cloud Bigtable.

Why:

- High write throughput.
- Low-latency key-based reads.
- Good fit for time-series and IoT-style append workloads.
- Sparse/wide-column model can handle evolving sensor payloads.
- TTL policies can manage retention.

Possible row key:

- `deviceId#reverseTimestamp#seqNo`
- or `pondId#reverseTimestamp#deviceId#seqNo`

Column families:

- `raw`: raw JSON payload, topic, transport metadata
- `sig`: signature, validation result, certificate/device identity
- `meta`: projectId, pondId, receivedAt, ruleVersion

Why not PostgreSQL for raw messages:

- Raw telemetry messages are append-heavy and can grow very fast.
- They do not need frequent relational joins.
- Keeping them in PostgreSQL competes with transactional domain workloads.

Read/write strategy:

- Java Ingestion Service is the main writer.
- Writes should be append-style and idempotent using row keys that include device/pond/time/sequence information.
- Use batch mutations where useful.
- Avoid frequent updates to old telemetry rows.
- Avoid relational-style joins in Bigtable.
- Analytics/chart services read by row key ranges, such as pond + parameter + time window.

Hotspot prevention:

- Avoid row keys that monotonically increase at the beginning.
- Use hash/salt prefix when needed.
- Use reverse timestamp only after a distribution prefix such as device/pond hash.
- Keep row-key design aligned with the most important query patterns.

Implementation / availability:

- Target architecture: Cloud Bigtable for operational telemetry scale.
- Student implementation: do not implement Bigtable replication because of cost.
- Cost-safe demo option: Bigtable emulator or PostgreSQL partitioned/demo telemetry table.
- Slide/report note: Bigtable is the target production telemetry store, but real Bigtable replication is not implemented due student cloud-credit constraints.

### Parsed Sensor Readings

Preferred target:

- Cloud Bigtable for operational time-series serving, or
- PostgreSQL partitioning for MVP compatibility, plus BigQuery for analytics.

Refined recommendation:

- MVP: keep parsed readings in PostgreSQL partitioned tables or service-owned schema to reduce migration risk.
- Target: stream parsed readings to Bigtable for operational time-series reads and to BigQuery for analytical workloads.

Read/write strategy:

- Ingestion Service writes parsed operational readings.
- Alert Service should consume `reading.ingested` events instead of polling tables.
- Realtime Gateway should consume events/fanout, not query raw storage for every live update.
- Analytics Service can read recent windows from Bigtable and long historical windows from BigQuery.

Implementation note:

- If parsed readings stay in PostgreSQL for MVP, use table partitioning and avoid read-heavy dashboards hitting the primary.
- In target architecture, Bigtable handles operational time-series storage and BigQuery handles long-range analytical storage.
- Bigtable/BigQuery replication should be mentioned only as future production hardening, not as implemented scope.

### Analytics Warehouse

Use BigQuery.

Use for:

- Historical analytics.
- Dashboard aggregations at larger scale.
- ML feature generation.
- Long-range trends.
- Reporting.

Data movement:

- Pub/Sub -> Dataflow -> BigQuery, or
- Pub/Sub BigQuery subscription if suitable, or
- batch export from Bigtable/Cloud Storage.

Read/write strategy:

- BigQuery is not the application transaction database.
- Writes should come from event streams, Dataflow jobs, batch loads, or controlled export jobs.
- Tables should be partitioned by event/date fields such as `measured_at` or `event_date`.
- Tables should be clustered by fields such as `project_id`, `pond_id`, `device_id`, and `parameter`.
- Analytics Service reads BigQuery for historical trends, reports, model features, and management dashboards.

Implementation / resilience:

- For first implementation, one regional BigQuery dataset is enough.
- Do not implement BigQuery dataset replication/managed DR in the student demo because of cost.
- For stronger production architecture, mention dataset replication/managed DR only as future hardening.
- BigQuery does not replace backups or audit retention policy; raw/audit artifacts can also be archived to Cloud Storage.

### Cost-Constrained Analytics Implementation

Important budget constraint:

- The implementation will use a student/free-tier style Google Cloud account with about USD 300 credits.
- BigQuery and Bigtable must be treated carefully to avoid accidental cost overruns.

BigQuery cost-safe decision:

- Keep BigQuery in the target architecture.
- Use BigQuery only with small controlled demo datasets in the first implementation.
- Do not run large-scale streaming analytics or unrestricted dashboard queries.
- Do not use BigQuery slot reservations/capacity editions for this project.
- Use on-demand pricing/free-tier behavior only.
- Keep historical analytics queries partitioned, clustered, and bounded by date/project/pond filters.

BigQuery safeguards:

- Create a billing budget and alerts before enabling analytics workloads.
- Use BigQuery sandbox/free-tier limits where possible.
- Keep active BigQuery storage under the free-tier-sized demo range.
- Use query dry runs before expensive queries.
- Set `maximum_bytes_billed` for application-issued queries.
- Set custom BigQuery query quotas if possible.
- Partition tables by `event_date` or `measured_at`.
- Cluster tables by `project_id`, `pond_id`, `device_id`, and `parameter`.
- Avoid `SELECT *`.
- Avoid scanning unbounded historical tables from the dashboard.
- Prefer precomputed `daily_pond_summary` / `hourly_sensor_summary` tables for demos.

Cost-safe implementation stance:

```text
Report target:
  BigQuery for historical analytics and ML features

First implementation:
  Small BigQuery dataset + bounded queries + budget alerts

If budget becomes tight:
  Keep BigQuery as documented target and use PostgreSQL/CSV/demo summaries for the working demo
```

Bigtable cost warning:

- Bigtable can be more expensive than BigQuery for a student demo because provisioned nodes can charge even when mostly idle.
- For first implementation, avoid leaving a real Bigtable cluster running continuously.
- Use the Bigtable emulator for local testing where possible.
- If real Bigtable is needed for evidence, create a minimal short-lived instance, run the demo, capture evidence, then stop/delete it.
- If budget risk is high, keep parsed readings in PostgreSQL partitioned tables for MVP and present Bigtable as target scale architecture.

Teacher-facing wording:

> Because the implementation runs under limited student cloud credits, AquaShield demonstrates BigQuery using small bounded analytical datasets and cost controls, while documenting BigQuery as the target warehouse for large-scale historical analytics. The system design remains scalable, but the demo environment intentionally limits data volume and query scope.

### Cache / Rate Limit / Connection State

Use Redis/Memorystore.

Use for:

- API rate limiting
- short-lived cache
- selected WebSocket fanout and subscription registry
- workflow checkpointing if AI orchestrator is implemented

Distributed caching use cases:

- Project/Profile Service caches profile type catalogue.
- Project/Profile Service caches parameter catalogue.
- Project/Profile Service caches project parameter threshold settings.
- Project/Profile Service caches growth indicator settings.
- Pond/Cycle Service caches pond summary/status views for dashboard reads.
- Sensor Registry Service caches device-to-project/pond/port mapping for ingestion lookups.
- Identity and Access Service caches permission snapshots or token revocation entries when appropriate.
- Alert Service caches threshold lookup results for short windows to avoid repeatedly querying Cloud SQL.
- Realtime Gateway stores user/project/pond subscription mappings with TTL.
- Realtime Gateway uses Redis pub/sub or Redis Streams for cross-pod fanout.
- API edge/BFF uses Redis counters for rate limiting.

Cache invalidation rules:

- Use TTLs for all cache entries.
- Invalidate or refresh project/profile/threshold caches when admin settings change.
- Use event-driven invalidation where useful, such as `project.settings.updated` or `threshold.updated`.
- Never treat Redis as source of truth.
- On Redis failure, services should fall back to database/service calls where possible.

Read/write strategy:

- Store only volatile or reconstructable data.
- Use TTLs for session-adjacent state, subscriptions, rate counters, and cached views.
- Realtime Gateway writes connection/subscription metadata after WS authentication.
- Realtime Gateway uses Redis pub/sub or Redis Streams for cross-pod fanout.
- Services can cache read-heavy reference data, but Cloud SQL remains source of truth.

Replication / availability:

- Use Memorystore Standard/Cluster tier for HA rather than a single Redis pod.
- Redis replication is for availability and read scale, not durable business history.
- On Redis loss, the system should degrade and rebuild cache/subscription state, not lose core business data.

### Object Storage

Use Cloud Storage.

Use for:

- report exports
- archived raw payloads
- AI/RAG documents
- screenshots/evidence
- model artifacts if AI/ML slice is added

Read/write strategy:

- Services write immutable files/artifacts with metadata.
- Store object references in PostgreSQL when the object is part of business state.
- Use signed URLs or service-mediated downloads for user access.

Replication / availability:

- MVP: regional bucket in the main GCP region.
- Target: dual-region or multi-region bucket for important artifacts.
- Use lifecycle policies for archive/cost control.
- Use object versioning only for artifacts where rollback/history is useful.

### AWS-Side Stores

Use DynamoDB if AWS API Gateway WebSocket is used.

Use for:

- connection ID registry
- user/project/pond subscription mapping
- connection TTL

Do not use DynamoDB for the main AquaShield domain model unless the service itself is AWS-native.

## Refined Service List And Language Choices

### 1. Identity And Access Service

Language: Java.

Stack:

- Spring Boot
- Spring Security
- JWT/OAuth support
- PostgreSQL/Cloud SQL
- gRPC server for internal auth/access checks
- REST endpoints for login/session/profile/admin through API gateway

Responsibilities:

- Login/logout/refresh
- user profile
- platform admin
- project access
- feature/action permissions

### 2. Project/Profile Service

Language: Java.

Responsibilities:

- profile types
- projects
- parameter catalogue
- growth indicators
- project parameter thresholds
- energy settings

Communication:

- REST for frontend/admin queries.
- gRPC for internal lookup by other services.

Database:

- Cloud SQL PostgreSQL.

### 3. Pond And Cycle Service

Language: Java.

Responsibilities:

- ponds
- pond status
- cycles
- daily health
- stage metrics
- treatments
- pond treatment history

Database:

- Cloud SQL PostgreSQL.

### 4. Sensor Registry Service

Language: Java.

Responsibilities:

- sensor type catalogue
- IoT device registry
- device public identity / key metadata
- project sensor mappings
- port to pond mapping

Database:

- Cloud SQL PostgreSQL.

Integration:

- AWS IoT thing/device identity can be mirrored here for application context.

### 5. Ingestion Service

Language: Java.

Rationale:

- High-throughput backend workload.
- Strong concurrency and validation ecosystem.
- Pub/Sub client support is mature.
- Keeps core pipeline in your preferred language.

Responsibilities:

- consume normalized events from AWS IoT bridge / GCP Pub/Sub
- validate payload schema
- verify application-level signature/replay/idempotency
- resolve device/port mapping through Sensor Registry Service
- write raw message to Bigtable
- write parsed reading to operational store
- publish `reading.ingested` or `reading.quarantined`

Important distinction:

- AWS IoT Core owns MQTT broker/device connection.
- Ingestion Service owns application validation, persistence, and downstream events.

### 6. Alert And Notification Service

Language: Java.

Responsibilities:

- consume `reading.ingested`
- load thresholds/profile context through Project/Profile and Pond services
- detect threshold violations
- deduplicate alerts
- manage alert lifecycle
- publish alert events
- send email/push/web notification requests

Architecture:

- Event-driven first.
- gRPC only for required synchronous lookups.
- Use outbox pattern if writing alerts and publishing events must be consistent.

Database:

- Cloud SQL PostgreSQL for alert state and outbox.

### 7. API Gateway / API Composition

Language:

- Prefer cloud-managed gateway and routing.
- If BFF/API composition service is needed, use Java or TypeScript.

Decision:

- Accepted: GCP External Application Load Balancer + GKE Gateway/Ingress + Cloud Armor as main REST edge.
- Optional BFF service for frontend-specific aggregation.

### 8. Analytics And Chart Service

Language: TypeScript/Node.js.

Rationale:

- Existing frontend and backend_nodejs code are TypeScript-heavy.
- Chart responses are JSON/DTO heavy.
- Easier to align frontend contracts and analytics payloads.

Responsibilities:

- historical chart API
- pond comparison
- energy dashboard
- WQI/disease risk computed views
- BigQuery-backed analytical queries
- cache chart responses

Database:

- BigQuery for large-scale analytics.
- Bigtable or PostgreSQL for recent operational reads.
- Cloud SQL for chart configuration if not owned by Project/Profile service.

### 9. AI/ML/LLM Service

Language: Python.

Stack:

- FastAPI preferred.
- Flask acceptable only for very small demos.

Responsibilities:

- placeholder initially
- anomaly/forecast model serving if time allows
- alert explanation agent if time allows
- RAG/LLM workflow if time allows

Implementation level for first pass:

- Create placeholder service folder and CI/CD skeleton.
- Add only if the core architecture is stable.

### 10. Audit And Observability Service

Language: Java, unless TypeScript is more convenient for dashboard-facing APIs.

Responsibilities:

- consume audit events from Pub/Sub
- append immutable audit records
- store security-relevant and business-relevant events
- expose audit query APIs for admin/reporting
- correlate with Cloud Logging trace IDs
- optionally export to BigQuery/GCS for long-term retention

Data:

- Append-only Cloud SQL table for MVP.
- BigQuery or GCS cold archive for scale.

Important:

- Cloud Logging remains the infrastructure/application log sink.
- Audit Service is not a replacement for Cloud Logging.
- Audit Service stores business/security/compliance events in a queryable append-only domain model.

## Architecture Delivery Checklist

The refined workflow should start with target microservices documentation and target architecture planning, then move into implementation slices and evidence collection.

This checklist is intentionally generic. It should guide the project without locking every item to a fixed sequence.

The inherited monolith is reviewed only as source context to understand requirements, domain behavior, database shape, and existing screens. It is not a separate documentation deliverable.

### Documentation Baseline

Create:

- target microservices service catalogue
- target bounded context summary
- target service responsibility matrix
- target API ownership map
- target data ownership map
- target sensor-to-dashboard workflow checklist
- target security/trust boundary notes
- API documentation for external REST endpoints
- gRPC documentation for internal service contracts
- Pub/Sub documentation for event topics, subscriptions, schemas, DLQs, and consumers
- service contract catalogue
- evidence checklist for screenshots, logs, test results, cloud console proof, and demo recordings

API documentation should include:

- endpoint path
- method
- request body/query parameters
- response shape
- authentication/authorization requirement
- owning service
- expected error cases

gRPC documentation should include:

- `.proto` package and service name
- RPC methods
- request/response messages
- caller service
- owner service
- timeout/retry/idempotency notes
- security requirement through mesh mTLS and authorization policy

Pub/Sub documentation should include:

- topic name
- publisher
- subscriber
- event schema/version
- ordering/idempotency key if used
- dead-letter topic
- retry/replay behavior
- operational owner

### Target Architecture Package

Create:

- target DDD bounded context diagram
- target logical microservices diagram
- target physical cloud architecture
- target deployment diagram
- target event-driven architecture diagram
- target gRPC communication map
- target polyglot persistence diagram
- target security architecture
- target CI/CD pipeline diagram
- target observability and audit flow diagram

Workflow item:

- Keep the end-to-end workflow as a checklist, not a formal diagram.
- The main workflow checklist should describe how a sensor reading moves from edge device to IoT ingress, event bus, ingestion, persistence, alerting, realtime gateway, dashboard, audit, and observability.

### Implementation Slices

Break the target into deliverable slices:

- Slice A: API gateway/edge + Java Identity/Project/Pond service skeletons
- Slice B: AWS IoT Core + Lambda bridge + Google Pub/Sub + Java Ingestion Service
- Slice C: Alert/Notification service event-driven flow
- Slice D: Realtime Gateway with Java Spring WebFlux + Redis/Memorystore fanout
- Slice E: TypeScript Analytics/Chart service
- Slice F: Audit/Observability service
- Slice G: AI/ML placeholder or small AI feature if time allows

### Infrastructure Foundation

Create:

- Terraform for GCP base resources
- Terraform for AWS IoT if implemented
- Artifact Registry repositories
- GKE cluster
- GKE namespaces
- GKE Gateway/Ingress and Cloud Armor
- Istio/Cloud Service Mesh baseline
- Argo CD installation/applications
- Pub/Sub topics/subscriptions/DLQs
- Cloud SQL PostgreSQL primary and read replica
- Redis/Memorystore cache target
- Bigtable target architecture notes or cost-safe demo fallback
- BigQuery target architecture notes or cost-safe demo fallback
- Cloud Storage buckets
- IAM/service accounts/secrets

### Service Implementation Priority

Start with the services that prove architecture:

1. API edge/BFF.
2. Java Identity and Access Service.
3. Java Project/Profile or Sensor Registry Service.
4. Java Ingestion Service consuming Pub/Sub.
5. Java Alert/Notification Service consuming `reading.ingested`.
6. Java Realtime Gateway using WebFlux and Redis/Memorystore fanout.
7. TypeScript Analytics/Chart Service if time allows.
8. Python AI/ML service placeholder or small feature if time allows.

### CI/CD And Evidence

Add:

- lint
- tests
- SAST
- SCA
- secret scan
- SBOM
- container build
- container scan
- image push to Artifact Registry
- GitOps manifest update
- Argo CD sync to GKE
- smoke test
- DAST
- k6/Gatling

### Service-Specific CI/CD Strategy

Teacher-expected scenario:

> If a developer changes only Identity and Access Service, only that service should be tested, built, containerized, scanned, pushed, and rolled out to GKE.

Use a monorepo-aware CI/CD pipeline with GitOps deployment.

Selected delivery model:

- GitHub Actions is the CI system.
- Argo CD is the CD/GitOps system.
- GCP Artifact Registry stores service container images.
- Kustomize is the preferred Kubernetes manifest format.
- Git is the source of truth for what is deployed to GKE.
- Argo CD runs inside or alongside the GKE cluster and reconciles the cluster state from Git.

Recommended repository shape:

```text
services/
  identity-access-service/
  project-profile-service/
  pond-cycle-service/
  sensor-registry-service/
  ingestion-service/
  alert-notification-service/
  realtime-gateway/
  analytics-chart-service/
  audit-observability-service/
  ai-ml-service/
libs/
  proto-contracts/
  shared-java/
  shared-typescript/
deploy/
  k8s/
    base/
    overlays/
      dev/
      staging/
      prod/
  argocd/
    applications/
.github/
  workflows/
```

Pipeline behavior:

1. Developer pushes code to GitHub.
2. GitHub Actions detects changed paths.
3. If only `services/identity-access-service/**` changed, CI runs only Identity service pipeline plus any shared-contract checks required by dependencies.
4. Pipeline runs unit tests, integration tests, lint, SAST, SCA, SBOM generation, and container build for Identity service.
5. Pipeline pushes only the Identity service image to Artifact Registry.
6. Pipeline updates only the Identity service Kubernetes deployment manifest/image tag in Git.
7. Argo CD detects the Git change and syncs the Identity service application to GKE.
8. Kubernetes performs a rolling update only for `identity-access-service` pods.
9. Other services remain unchanged.
10. Post-deploy smoke test checks Identity health, login/token endpoint, and any internal gRPC health endpoint.

Example path-to-service mapping:

| Changed Path | Pipeline Action |
|---|---|
| `services/identity-access-service/**` | build/deploy Identity only |
| `services/project-profile-service/**` | build/deploy Project/Profile only |
| `services/ingestion-service/**` | build/deploy Ingestion only |
| `services/realtime-gateway/**` | build/deploy Realtime Gateway only |
| `services/analytics-chart-service/**` | build/deploy Analytics only |
| `libs/proto-contracts/**` | run contract generation/tests for affected services |
| `deploy/k8s/**` | run manifest validation and deployment plan |
| `infra/**` | run Terraform plan/apply through protected environment |

Image tagging:

```text
asia-southeast1-docker.pkg.dev/<project>/aquashield/identity-access-service:<git-sha>
asia-southeast1-docker.pkg.dev/<project>/aquashield/identity-access-service:<branch>-<short-sha>
```

Kubernetes rollout target:

```text
Deployment: identity-access-service
Namespace: aquashield-dev / aquashield-staging / aquashield-prod
Container: identity-access-service
Image: Artifact Registry image tagged with current commit SHA
```

Recommended GitHub Actions workflow pattern:

```text
detect-changes
  -> service-ci matrix for changed services
  -> build-and-push image for changed services
  -> update Kustomize image tag for changed services
  -> commit GitOps manifest change
  -> Argo CD syncs changed Kubernetes workloads
  -> service-specific smoke tests
```

For the Identity and Access Service example:

```text
git push
  -> path filter detects services/identity-access-service/**
  -> run Identity tests
  -> build identity-access-service image
  -> scan image
  -> push image to Artifact Registry
  -> authenticate to GCP using Workload Identity Federation
  -> update Identity Kustomize image tag in Git
  -> Argo CD detects Git change
  -> Argo CD syncs identity-access-service application
  -> Kubernetes rolls out identity-access-service Deployment
  -> smoke test /actuator/health and auth endpoints
```

Security controls:

- Use GitHub Actions OIDC with GCP Workload Identity Federation instead of long-lived service account keys.
- Use least-privilege deployment service account.
- Use branch protection before staging/prod deployment.
- Use GitHub environment approval for production.
- Run SAST, SCA, secret scan, SBOM, and container scan before deployment.
- Sign or attest images if time allows.

Deployment mechanism choices:

- Argo CD is selected as the continuous delivery and GitOps tool.
- Kustomize is preferred for this academic project because it is simple and Kubernetes-native.
- Helm is acceptable if we need templating, but it may add unnecessary complexity.
- `kubectl set image` is acceptable only as an emergency/manual demo fallback.
- Kustomize image patches committed to Git are preferred because Argo CD can prove the cluster matches the GitOps desired state.

Recommended Argo CD shape:

- Use one Argo CD `Application` per service per environment where possible.
- Example: `identity-access-service-dev`, `project-profile-service-dev`, `ingestion-service-dev`.
- Each Argo CD application points to the service's Kustomize overlay.
- Dev can use automatic sync for fast feedback.
- Staging/prod should use manual sync or protected GitHub environment approval.
- Enable self-heal and drift detection for demo evidence if time allows.
- Use Argo CD UI screenshots to show sync status, commit SHA, deployed image tag, and health state.

Recommended implementation:

- Use GitHub Actions path filters or a changed-files action to compute changed services.
- Use one reusable workflow for all services.
- Use a build matrix so multiple changed services can build in parallel.
- Use GCP Artifact Registry for images.
- Use `google-github-actions/auth` with Workload Identity Federation.
- GitHub Actions should update Kustomize image tags in the GitOps manifest path.
- Argo CD should perform the actual GKE rollout from Git.
- Use `gcloud container clusters get-credentials`, `google-github-actions/get-gke-credentials`, `kubectl apply`, or `kubectl set image` only for bootstrap/fallback operations, not the normal CD path.

Evidence to capture for report/demo:

- GitHub commit touching only Identity service.
- GitHub Actions run showing only Identity service jobs executed.
- Artifact Registry showing new Identity image tag.
- GitOps commit showing only Identity service manifest/image tag changed.
- Argo CD application showing synced/healthy state for Identity service.
- GKE Deployment rollout showing only Identity pods restarted.
- Other service pods unchanged.
- Smoke test output after rollout.

### Demo And Report Assembly

Produce:

- app demo video
- CI/CD demo video
- diagram evidence
- cloud console/Kubernetes screenshots
- test and scan artifacts
- API/gRPC/Pub/Sub documentation extracts
- management/technical/security risk table

## Refined Critical Flow: Sensor Reading To Dashboard

Target flow:

1. Device publishes MQTT telemetry to AWS IoT Core.
2. AWS IoT Core authenticates device with certificate/policy.
3. AWS IoT Rule invokes AWS Lambda bridge.
4. Lambda bridge publishes `iot.telemetry.received` to Google Pub/Sub.
5. Java Ingestion Service consumes event.
6. Ingestion validates schema, signature/replay/idempotency.
7. Ingestion calls Sensor Registry Service over gRPC to resolve device/port to pond/project.
8. Ingestion writes raw message to telemetry store: Bigtable in target architecture, PostgreSQL/controlled demo store if budget-constrained.
9. Ingestion writes parsed reading to operational store.
10. Ingestion publishes `reading.ingested`.
11. Java Alert Service consumes `reading.ingested`.
12. Alert Service calls Project/Profile Service over gRPC for thresholds.
13. Alert Service creates/deduplicates/resolves alert state in Cloud SQL.
14. Alert Service publishes `alert.created` or `alert.resolved`.
15. Realtime path:
    - Selected option: Realtime Gateway on GKE pushes through WebSocket behind GCP External Application Load Balancer.
    - Future alternative only: AWS API Gateway WebSocket with cross-cloud push bridge.
16. React dashboard receives update and refreshes pond state/alerts.
17. Audit Service consumes audit events and stores append-only records.
18. Cloud Logging/Monitoring captures infrastructure and application telemetry.

## Open Decisions

These are not final yet:

- Whether parsed readings stay in PostgreSQL for MVP or move immediately to Bigtable.
- Whether Analytics Service reads BigQuery only or uses mixed BigQuery + operational store.
- Whether API composition/BFF is Java or TypeScript.
- Whether AI/ML service remains placeholder or implements one small alert explanation/anomaly feature.

## Current Working Recommendations

Use this as the baseline until changed:

- Core services: Java Spring Boot.
- Internal calls: gRPC.
- External REST edge: GCP Load Balancer + GKE Gateway/Ingress + Cloud Armor.
- CDN: GCP Cloud CDN for first implementation; Cloudflare optional Phase 4/global CDN.
- Async event bus: Google Pub/Sub.
- Async failure handling: Pub/Sub dead-letter topics per important subscription.
- IoT/MQTT: AWS IoT Core.
- IoT cross-cloud bridge: AWS IoT Rule -> TypeScript AWS Lambda bridge -> Google Pub/Sub.
- Edge baseline: existing AquaMonitoring-Pi edge publisher/simulator is enough for first implementation.
- Future edge runtime: AWS IoT Greengrass V2 as managed edge enhancement.
- WebSocket target: GCP Load Balancer + Realtime Gateway on GKE.
- WebSocket implementation: Java Spring WebFlux.
- WebSocket fanout: Redis/Memorystore-backed shared subscription registry and cross-pod fanout.
- WebSocket future alternative: AWS API Gateway WebSocket.
- Service discovery: Kubernetes DNS; no Nacos.
- Service mesh: Istio-compatible Google Cloud Service Mesh with strict mTLS and AuthorizationPolicy.
- Transactional data: Cloud SQL PostgreSQL.
- Transactional replication: Cloud SQL regional HA plus read replicas for read-heavy workloads.
- Raw sensor messages: Cloud Bigtable.
- Budget fallback for telemetry: PostgreSQL partitioned/demo store or Bigtable emulator if real Bigtable cost is too high.
- Telemetry replication: not implemented for Bigtable in student demo; mention only as future production hardening.
- Analytics warehouse: BigQuery.
- Analytics replication: not implemented for BigQuery in student demo; mention only as future production hardening.
- Analytics cost control: small bounded BigQuery demo datasets; no slot reservations; use budgets, query caps, partitioning, and clustering.
- Cache/fanout/rate limits: Redis/Memorystore.
- Cache/fanout replication: Memorystore HA; treat Redis data as volatile/reconstructable.
- Object/archive: Cloud Storage.
- Analytics/chart service: TypeScript/Node.js.
- AI/ML service: Python FastAPI placeholder.
- Audit service: append-only domain audit plus Cloud Logging for platform logs.

## What Not To Claim Yet

Until implemented and evidenced, do not claim:

- AWS IoT Core is already integrated.
- AWS API Gateway WebSocket is already integrated.
- Java microservices are already extracted.
- gRPC contracts are already implemented.
- Bigtable/BigQuery persistence is already wired.
- Cloud Service Mesh is already enabled.
- Polyglot persistence is already operational.
- Kubernetes deployment is already production-ready.

These are refined target architecture decisions for the next implementation and diagram phase.
