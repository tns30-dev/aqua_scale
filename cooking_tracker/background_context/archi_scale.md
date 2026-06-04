# Scalable Cloud-Native Architecture Context

Last updated: 2026-06-03

This file captures scalable architecture patterns from the ChronoFlow architecture reference and adapts them into a target AquaShield microservices architecture.

## Source Inputs

- `cooking_tracker/hard_context_reference/architecting_scalable.docx`
- AquaShield source code and refinement notes
- ChronoFlow architecture patterns from the user's previous project work

## ChronoFlow Architecture Capability Summary

ChronoFlow demonstrated:

- Domain-driven microservice decomposition
- API gateway entry point
- Independent service boundaries
- Synchronous service calls for validation flows
- Asynchronous Pub/Sub/event-driven notifications
- Database-per-service style logical ownership
- Kubernetes deployment
- HPA, PDB, rolling updates, liveness/readiness probes
- Nacos/service discovery
- Redis caching/rate control
- Cloud SQL, MongoDB, GCS, Pub/Sub, FCM/email/WebSocket integrations
- Terraform-provisioned cloud infrastructure
- GitHub Actions CI/CD
- SAST, SCA, SBOM, Sonar, DAST, performance testing
- Gatling load test evidence up to high concurrency
- Clear quality attribute mapping: performance, availability, security, extensibility, maintainability

These patterns should be reused as target design patterns for AquaShield, not claimed as current AquaShield implementation until built.

## AquaShield Target Architecture Goal

Convert AquaShield from an inherited monolith into a cloud-native aquaculture operations platform.

The target should prove:

- Scalability: independent scaling for ingestion, realtime, charts, AI, and frontend/API traffic
- Reliability: self-healing services, retries, idempotency, circuit breakers, graceful degradation
- Security: least privilege, project isolation, secure IoT ingestion, DevSecOps pipeline
- Maintainability: clear DDD boundaries, owned data models, contract-first APIs
- Observability: logs, metrics, traces, alerting, audit events
- AI readiness: event and data architecture ready for MLOps/LLMSecOps add-ons

## Proposed Bounded Contexts

### 1. Identity And Access Service

Current source:

- `module_user`
- `RBACService`
- auth views and serializers

Responsibilities:

- Login/logout/refresh
- User profile
- Project access assignment
- Feature/action permissions
- Admin user management
- Session and token policy

Data ownership:

- users
- user_projects
- feature_access
- action_control

### 2. Project/Profile Service

Current source:

- `module_project`

Responsibilities:

- Profile templates
- Project/farm setup
- Parameter catalogue
- Growth indicator catalogue
- Project thresholds
- Energy settings

Data ownership:

- profile_types
- projects
- parameter_types
- growth_indicators
- project_parameter_settings
- project_energy_settings

### 3. Pond And Cycle Service

Current source:

- `module_pond`

Responsibilities:

- Pond metadata/status
- Growth cycles
- Daily health timeline
- Stage metrics
- Treatment catalogue
- Pond treatment history
- Pond comparison service logic if not placed in analytics

Data ownership:

- ponds
- cycles
- cycle_daily_health
- cycle_stage_metrics
- treatments
- pond_treatments

### 4. Sensor Registry Service

Current source:

- `module_sensor` hardware/config models

Responsibilities:

- Sensor type catalogue
- IoT device registry
- Device secrets
- Sensor-to-pond deployment mappings

Data ownership:

- sensor_types
- iot_devices
- project_sensors

### 5. Ingestion Service

Current source:

- `module_data_ingestion`
- `mqtt_adapter`
- `SensorMessage`
- `SensorReading`

Responsibilities:

- MQTT subscription
- Device authentication/HMAC verification
- Payload validation
- Idempotent raw message storage
- Parsed reading storage
- Sensor data quality/quarantine
- Publish `reading.ingested` and `reading.rejected` events

Data ownership:

- sensor_messages
- sensor_readings
- optional quarantined_readings

Scaling notes:

- This service is write-heavy and latency-sensitive.
- It should scale independently from dashboard/API services.
- It should use backpressure and bounded worker concurrency.

### 6. Alert And Notification Service

Current source:

- `module_notification`
- `ThresholdService`

Responsibilities:

- Threshold evaluation
- Alert lifecycle
- Deduplication
- Escalation
- Notification dispatch
- Event publication for alert created/resolved

Data ownership:

- alerts
- alert_log
- notification_outbox if added

### 7. Realtime Gateway Service

Current source:

- Django Channels consumers
- frontend WebSocket service

Responsibilities:

- WebSocket authentication
- Project/pond subscription authorization
- Reading and alert fanout
- Connection lifecycle
- Backpressure and rate limits

Scaling notes:

- Keep separate from ingestion and REST API.
- Use Redis or managed pub/sub for fanout.

### 8. Analytics And Chart Service

Current source:

- `module_chart`
- `ChartService`
- `EnergyDashboardService`
- `PondComparisonService`

Responsibilities:

- Historical chart generation
- Pond comparison
- Energy analytics
- Water quality index
- Disease risk calculations
- Read-optimized APIs

Data ownership:

- visualisation_types
- project_visualisations
- chart configuration tables
- optionally precomputed aggregates

### 9. AI/ML/LLM Service

Current source:

- `module_ai` placeholder
- future implementation

Responsibilities:

- Forecast/anomaly model inference
- Alert explanation agent
- Report generation
- RAG/knowledge service
- Model broker
- AI decision audit

Data ownership:

- model_predictions
- ai_decision_log
- prompt_versions
- knowledge_documents
- vector chunks if implemented

### 10. Audit And Observability Service

Responsibilities:

- Security audit events
- AI decision events
- Operational event trail
- Token/cost ledger
- Compliance evidence export

May start as shared logging tables and evolve into a service later.

## Target Communication Patterns

### Synchronous APIs

Use for request/response operations that need immediate results:

- Login/session
- Fetch projects/ponds
- Fetch chart data
- Admin CRUD
- Query sensor registry
- Validate access

Preferred protocols:

- REST for external API and frontend
- gRPC for internal service-to-service calls if time permits

### Asynchronous Events

Use for high-volume or decoupled workflows:

- `sensor.message.received`
- `reading.ingested`
- `reading.rejected`
- `threshold.violated`
- `alert.created`
- `alert.resolved`
- `notification.requested`
- `ai.analysis.requested`
- `ai.analysis.completed`
- `report.generated`

Event bus options:

- Google Pub/Sub if using GCP
- Kafka if demonstrating open-source event streaming
- RabbitMQ/NATS for a simpler local MVP

### MQTT

MQTT remains the IoT ingress protocol.

Recommended shape:

- Mosquitto or managed MQTT broker
- TLS on broker
- Per-device credentials or mTLS roadmap
- HMAC payload signature remains as application-level integrity
- Broker forwards to Ingestion Service workers

### WebSocket

WebSocket fanout should be isolated behind a Realtime Gateway.

Recommended shape:

- Client connects to Realtime Gateway.
- Gateway verifies session/token and project/pond access.
- Gateway subscribes to reading/alert events.
- Gateway broadcasts only authorized data.

## Persistence Strategy

### MVP Practical Path

Start with PostgreSQL, but enforce logical service ownership:

- Separate schemas per service, or separate databases if practical.
- Each service owns its schema.
- No cross-service direct table access in new code.
- Use API/events for cross-boundary interaction.

### Target Path

- PostgreSQL/Cloud SQL for relational domain data
- TimescaleDB or PostgreSQL partitioning for sensor readings
- Redis for cache, rate limits, WebSocket fanout, workflow checkpoints
- Object storage for reports, exports, AI knowledge documents
- pgvector/vector DB for RAG
- Separate audit log store or append-only audit tables

Do not split databases before service boundaries are understood. A bad database split will slow implementation and weaken the demo.

## Cloud-Native Deployment Target

Preferred assessment target:

- Kubernetes cluster, e.g. GKE, AKS, or local kind/minikube for demo plus cloud screenshots if budget allows
- Container image per service
- API Gateway/Ingress
- HPA per service
- PDB for critical services
- Readiness and liveness probes
- Resource requests/limits
- ConfigMaps and Secrets
- NetworkPolicies
- Rolling updates
- Horizontal scaling demo for ingestion or chart service

Current Azure VM deployment can be described as the baseline. The target architecture should move beyond it.

## Recommended Kubernetes Workloads

- `frontend-web`
- `api-gateway` or `backend-bff`
- `identity-service`
- `project-service`
- `pond-service`
- `sensor-registry-service`
- `ingestion-service`
- `alert-service`
- `realtime-gateway`
- `analytics-service`
- `ai-service` if implemented
- `postgres` only for local/demo, managed DB in cloud target
- `redis`
- `mqtt-broker` for demo if not managed

## CI/CD Target

Use GitHub Actions as the main evidence surface.

Recommended lanes:

1. Detect changed services
2. Lint/typecheck
3. Unit tests
4. Integration tests
5. Frontend tests
6. E2E tests
7. SAST
8. SCA
9. SBOM generation
10. Secret scan
11. Container build
12. Container scan
13. Push image to registry
14. Deploy to dev/test namespace
15. Run smoke tests
16. Run DAST
17. Run k6/Gatling load test
18. Manual approval for prod/demo namespace
19. Rollout status and rollback evidence

Tools:

- Python: ruff, pytest, pytest-cov, bandit, pip-audit
- Frontend: eslint, vitest, Playwright, npm audit
- Container: Docker Buildx, Trivy/Grype
- SBOM: CycloneDX
- DAST: OWASP ZAP baseline
- Load: k6 or Gatling
- Quality: SonarCloud optional
- IaC: Terraform plan/apply

## Migration Strategy

Use a strangler-fig migration instead of rewriting everything at once.

### Phase 0: Baseline Evidence

- Document current architecture and data flows.
- Run existing app.
- Capture screenshots and current tests.
- Identify module boundaries.

### Phase 1: Containerize Existing App

- Dockerfile for backend and frontend.
- Docker Compose for local Postgres/Redis/MQTT.
- Health endpoints.
- Basic CI build/test.

### Phase 2: Extract Identity And Project/Profile APIs

- Keep monolith database initially.
- Build service contracts.
- Move auth/project boundaries behind API gateway/BFF.
- Add tests for project access.

### Phase 3: Extract Ingestion And Alerts

- Ingestion service consumes MQTT and writes readings.
- Alert service consumes reading events and creates alerts.
- Realtime gateway broadcasts alert/reading events.
- Prove independent scaling.

### Phase 4: Extract Analytics

- Chart/energy/pond comparison service reads sensor readings and project config through contracts or read replica.
- Add caching and pre-aggregation where needed.

### Phase 5: Add AI/ML Slice

- Add forecast/anomaly or alert explanation workflow.
- Add MLOps/LLMSecOps evidence.

### Phase 6: Harden

- Network policies.
- Secrets manager.
- DAST/load testing.
- Observability dashboards.
- Rollback demo.

## Quality Attribute Mapping

### Performance

Mechanisms:

- Separate ingestion from read APIs.
- Use event bus for alerts/notifications.
- Cache read-heavy endpoints.
- Pre-aggregate historical chart data.
- HPA on ingestion, realtime, analytics.
- Use time-series partitioning/TimescaleDB for readings.

Evidence:

- k6/Gatling result
- HPA scaling screenshot
- response time chart
- database query plan or aggregate performance comparison

### Availability

Mechanisms:

- Multiple replicas for API/realtime/ingestion.
- Readiness/liveness probes.
- Rolling updates.
- PDB.
- Managed DB backups/PITR.
- Redis persistence or managed Redis for critical state.

Evidence:

- Kubernetes deployment manifests
- rollout status
- pod restart/self-healing demo
- backup configuration screenshot

### Security

Mechanisms:

- API gateway.
- JWT cookies/CSRF.
- RBAC/project isolation.
- MQTT HMAC/TLS.
- secrets management.
- network policies.
- SAST/SCA/container/DAST scans.

Evidence:

- security scan artifacts
- blocked unauthorized API test
- blocked invalid MQTT HMAC test
- network policy/service account evidence

### Maintainability

Mechanisms:

- DDD bounded contexts.
- OpenAPI/gRPC contracts.
- service-owned schemas.
- shared libraries limited to cross-cutting utilities.
- ADRs for major decisions.

Evidence:

- bounded context diagram
- service dependency diagram
- ADR table
- code module/service structure

### Observability

Mechanisms:

- structured logs
- metrics
- distributed traces
- correlation IDs
- audit events
- dashboards

Evidence:

- log/metric/trace screenshots
- alert dashboard
- audit event sample

## Architecture Decisions To Record

Create ADRs for:

- AD-01: Domain-driven service decomposition
- AD-02: API gateway/BFF as single external entry point
- AD-03: MQTT plus event bus for ingestion and downstream workflows
- AD-04: PostgreSQL-first persistence with service-owned schemas for MVP
- AD-05: Redis for cache, WebSocket fanout, rate limits, and workflow checkpoints
- AD-06: Kubernetes deployment with HPA/PDB/probes
- AD-07: GitHub Actions DevSecOps pipeline
- AD-08: Terraform-managed infrastructure
- AD-09: Centralized observability
- AD-10: AI/ML service added as bounded, governed extension rather than chatbot bolt-on

## Evidence Needed For Architecture Marks

At minimum, prepare:

- Current architecture diagram
- Target logical architecture diagram
- Target physical deployment diagram
- DDD bounded context diagram
- Service dependency diagram
- Critical use-case sequence diagram, e.g. sensor reading to alert to dashboard
- Database ownership diagram
- CI/CD pipeline diagram
- Kubernetes deployment diagram
- Security trust boundary diagram
- Test and scan result table
- Performance test report
- Demo video script

## Recommended Demo Slice

A strong slice for first submission:

1. Current app demo: login, overview, real-time/digital twin, historical chart, pond comparison, energy or user management.
2. CI/CD demo: pipeline runs lint/tests/security scans/build.
3. Architecture demo: show target microservices and explain boundaries.
4. Kubernetes/cloud-native demo if ready: deploy two or three extracted/containerized services and show health/rollout.
5. Security demo: invalid MQTT HMAC rejected; unauthorized project access blocked.
6. Optional AI demo: alert explanation with structured output and audit record.

Keep the story coherent. A smaller working slice with proof is better than a large architecture with no evidence.
