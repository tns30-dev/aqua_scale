# 03 Technical Assessment - Software Design

Rubric: Assessment Rubrics III, Software Design
Duration: 5 minutes
Cloud dependency: Low

## What This Video Must Prove

- The system has clear software design beyond deployment infrastructure.
- Critical use cases are described using use case, class, and sequence diagrams.
- The design shows the transition from analysis to implementation.
- Data models are clear across transactional and telemetry storage.

## Required Rubric Points

- Use case diagram.
- Class and sequence diagrams for a critical use case.
- Transition from analysis to design.
- Use of design patterns.
- Data schemas and models.

## Suggested Critical Use Cases

- Live telemetry ingestion and alerting:
  - Device sends telemetry.
  - AWS IoT receives message.
  - Lambda bridge publishes to Pub/Sub.
  - Ingestion service validates HMAC and allowed parameters.
  - Sensor readings/messages are written to Bigtable/BigQuery.
  - Notification service creates alerts.
  - Realtime gateway broadcasts updates.
- Pond treatment analysis:
  - User selects pond and treatment period.
  - API edge routes request.
  - Pond/analytics services resolve treatments, readings, and stability.
  - UI displays water stability, cost, and treatment impact.
- Feeding and growth analysis:
  - User selects pond/cycle.
  - Backend summarizes feed logs, cost, growth, FCR, and stage breakdown.

## Design Patterns To Mention

- API gateway/BFF style edge routing through `api-edge-proxy`.
- Repository/service layering inside backend services.
- Event-driven ingestion through Pub/Sub.
- Adapter/bridge pattern for AWS IoT to GCP Pub/Sub.
- Separation of transactional data from telemetry analytics storage.

## Data Models To Show

- Cloud SQL domain entities:
  - project, pond, device, treatment, feed log, growth cycle, alert log.
- Bigtable telemetry model:
  - high-volume sensor readings keyed for time-series access.
- BigQuery telemetry model:
  - analytical sensor readings/messages for aggregate reporting and evidence.

## Evidence To Prepare

- Use case diagram.
- Class diagram for one critical flow.
- Sequence diagram for telemetry ingestion and alerting.
- Data schema diagrams for Cloud SQL, Bigtable, and BigQuery.

## Open Items

- Choose final critical use case for class and sequence diagrams.
- Add final diagram file references.
