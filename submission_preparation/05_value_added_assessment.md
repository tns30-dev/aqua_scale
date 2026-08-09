# 05 Value Added Assessment

Rubric: Assessment Rubrics V
Duration: 5 minutes
Cloud dependency: Medium to High

## What This Video Must Prove

- The project goes beyond the minimum expected application.
- The platform is close to production-style operation and has sponsor/user value.
- The project includes technically advanced areas such as real-time processing, analytics, cloud-native architecture, and IoT integration.

## Required Rubric Points

- Meeting the minimum requirements of the MTech SE internship/capstone project.
- Accepted by the sponsor and preferably going live.
- Exploration of technically advanced or innovative areas:
  - Data analytics.
  - Real-time processing.
  - Cloud-native microservices.
  - IoT integration.
  - DevSecOps automation.

## Value Added Points To Mention

- Real AWS IoT Core integration with mutual TLS simulator for the missing physical Raspberry Pi.
- Full telemetry path verified: AWS IoT -> Lambda bridge -> Pub/Sub -> ingestion -> alert log.
- 4M telemetry evidence stored in Bigtable/BigQuery instead of overloading PostgreSQL.
- Firebase custom domain frontend and public API domain.
- Istio/Grafana/Prometheus observability for service-level latency during load testing.
- k6 load, stress, growth, and WebSocket performance evidence.
- Cloud-native deployment with GKE, Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery, and Artifact Registry.

## Suggested Speaker Notes

- Start with the minimum expected system, then explain what was added in the second round.
- Focus on value, not only tools: faster operational decisions, scalable telemetry storage, safer deployment, and real-time alerts.
- Explain that the simulator is not fake UI data; it publishes real messages through AWS IoT and the backend processes them through the same ingestion path.
- Explain why Bigtable and BigQuery are value added: they allow the system to handle sensor-volume data without slowing transactional features.

## Evidence To Capture While Cloud Is Running

- AWS IoT Thing/rule and Lambda bridge evidence.
- Pub/Sub topic/subscription receiving telemetry.
- Alert log showing simulator-triggered alert.
- Bigtable/BigQuery telemetry evidence.
- Grafana dashboard during load test.
- Live frontend showing alerts/dashboard.

## Open Items

- Add sponsor acceptance or go-live statement if available.
- Add final live demo screenshots for IoT alert flow.
