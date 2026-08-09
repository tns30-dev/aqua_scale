# 06 Presentation Assessment - App Demo

Rubric: Assessment Rubrics IV.1
Duration: Max 5 minutes
Cloud dependency: High

## Priority

This is one of the highest-priority recordings while the cloud environment is running.

## What This Video Must Prove

- The deployed application works from the public frontend domain.
- The frontend is connected to the deployed GKE backend through the public API domain.
- Core domain features are presentable with real project/pond data.
- Real-time or near-real-time behavior can be demonstrated.

## Suggested Demo Flow

1. Open `https://www.aquashield.live`.
2. Login as admin/demo user.
3. Show overview/dashboard data.
4. Show pond comparison with populated pond data.
5. Show treatments analysis.
6. Show feeding and growth.
7. Show alerts/notification behavior if simulator is running.
8. Mention that heavy telemetry is stored in Bigtable/BigQuery, while the dashboard consumes API-ready summaries.

## Speaker Notes Draft

- This is the deployed AquaShield microservice version, not the first-submission monolith.
- The frontend is served from Firebase Hosting and talks to `https://api.aquashield.live`.
- The backend runs on GKE and uses Cloud SQL for operational data, Bigtable/BigQuery for high-volume telemetry, and Redis for caching.
- The demo shows the main aquaculture workflows: pond visibility, treatment impact, feeding/growth tracking, and alerting.

## Screenshots Or Video Clips Needed

- Browser landing on `https://www.aquashield.live`.
- Successful login.
- Overview/dashboard with data.
- Pond comparison with readings.
- Treatments page with analysis result loaded.
- Feeding and growth page.
- Alerts page or notification after simulator publishes telemetry.

## Open Items

- Confirm final demo account credentials.
- Confirm the pages that are stable enough for recording.
- Decide whether to run the IoT simulator during the app demo.
