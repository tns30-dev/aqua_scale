# AquaShield Current System Context

Last updated: 2026-06-03

This file summarizes the current AquaShield/AquaMonitoring v2 application from the local codebase and refinement notes. Use it as the "current state" before proposing microservices, cloud-native deployment, DevSecOps, MLOps, or LLMSecOps changes.

## Source Inputs

- `AquaMonitoringv2/`
- `cooking_tracker/aquashield_reference/`
- Key code paths inspected:
  - `AquaMonitoringv2/README.md`
  - `AquaMonitoringv2/backend/config/settings/base.py`
  - `AquaMonitoringv2/backend/config/asgi.py`
  - `AquaMonitoringv2/backend/module_*`
  - `AquaMonitoringv2/backend_nodejs/src`
  - `AquaMonitoringv2/frontend/src`
  - `AquaMonitoringv2/.github/workflows/deploy-backend.yml`
  - `AquaMonitoringv2/.github/workflows/deploy-frontend.yml`

## Product Summary

AquaShield is a real-time aquaculture monitoring platform for shrimp, fish, crab hatchery, and treatment profiles.

Core business value:

- Monitor water quality and farm operations in real time.
- Track ponds, projects, growth cycles, treatments, and sensor hardware.
- Detect threshold violations and generate alerts.
- Visualize digital twin state, historical trends, pond comparison, and energy consumption.
- Provide role-based access to farm/project data.

## Current Application Shape

The codebase is not a clean single-stack monolith. It currently contains:

- Django backend under `AquaMonitoringv2/backend`
- React/Vite frontend under `AquaMonitoringv2/frontend`
- TypeScript/Express backend under `AquaMonitoringv2/backend_nodejs`
- Azure VM deployment scripts under `AquaMonitoringv2/deploy`

The main documented runtime is:

- Frontend: React, TypeScript, Vite, Zustand, Recharts, React Router, Tailwind/shadcn-style UI pieces
- Backend: Django 5.1.4, Django REST Framework, Django Channels, Daphne, PostgreSQL, Redis
- Real time: native WebSocket via Django Channels
- IoT ingestion: MQTT adapter plus compatibility WebSocket ingest path
- Auth: JWT stored in HttpOnly cookies, CSRF cookie/header for mutating requests
- Database: PostgreSQL, custom SQL-managed tables, `managed = False` Django models

The TypeScript/Express backend appears to be an alternate/newer backend slice with Express, Socket.IO, PostgreSQL, services/controllers, and a simulator. Treat it as useful reference or migration material, not the primary documented backend unless later confirmed.

## Existing Django Modules

### `module_user`

Owns identity and access.

Important concepts:

- Custom `User`
- `UserProject` direct project access assignment
- `FeatureAccess`
- `ActionControl`
- legacy `Role`
- `RBACService`
- cookie-based JWT login/logout/refresh
- `/api/auth/me`
- admin-only user management endpoints

Security-relevant existing behavior:

- Access and refresh JWTs are placed in HttpOnly cookies.
- Frontend does not read/store tokens.
- `SameSite=Strict` is used for JWT cookies.
- CSRF bootstrap endpoint sets readable `csrftoken` for unsafe requests.
- `RBACService` checks project access, feature access, action controls, and platform admin status.

### `module_project`

Owns project setup and profile/reference configuration.

Important models:

- `ProfileType`: aquaculture templates with `code`, `stage_config`, key parameter indicators, key growth indicators, and theme JSON.
- `Project`: farm/project container linked to owner and profile type.
- `ParameterType`: water-quality parameter catalogue.
- `GrowthIndicator`: growth metric catalogue.
- `ProjectParameterSetting`: per-project thresholds and key-parameter flags.
- `ProjectEnergySetting`: tariff and energy threshold configuration.

Current refinement notes show this module was deliberately reduced from a too-large project module into a focused setup/config boundary.

### `module_pond`

Owns pond and operational cycle management.

Important models:

- `Pond`: physical pond/tank with metadata and five-state status.
- `Cycle`: production/growth cycle.
- `CycleDailyHealth`: day-by-day health status timeline.
- `CycleStageMetric`: JSON metrics per cycle stage.
- `Treatment`: treatment catalogue.
- `PondTreatment`: pond-treatment lifecycle assignments.

Important services:

- `PondComparisonService`: backend-driven pond comparison/A-B style feature.

### `module_sensor`

Owns sensor hardware and IoT device configuration.

Important models:

- `SensorType`: hardware catalogue with measurable parameter IDs.
- `IoTDevice`: gateway device with `device_code`, status, config, and `device_key`.
- `ProjectSensor`: deployment mapping from project + pond + sensor type + IoT device + port.
- `SensorMessage`: raw ingested message.
- `SensorReading`: wide time-series reading table with aquaculture parameters.

Current parameter coverage includes temperature, salinity, pH, water level, dissolved oxygen, turbidity, electricity, nitrate, nitrite, ammonia, ammonium, pH lab, carbonate, bicarbonate, TAN, alkalinity, calcium, magnesium, phosphate, total hardness, hydrogen sulfide, total vibrio count, and total bacteria count.

### `module_data_ingestion`

Owns runtime ingestion behavior.

Important services:

- `IngestionService`: validates payloads, resolves devices, deduplicates by IoT device and sequence number, inserts raw messages and readings, and triggers threshold/broadcast work.
- `ThresholdService`: compares readings against `ProjectParameterSetting`, creates/deduplicates/resolves alert logs.
- `BroadcastService`: sends reading and alert updates to Django Channels groups.
- `mqtt_adapter`: subscribes to broker, validates topic prefix, payload size, required keys, timestamp skew, HMAC signature, and optional TLS.

This is one of the strongest existing boundaries for future microservice extraction because it is write-heavy, runtime-sensitive, and naturally event-driven.

### `module_chart`

Owns historical chart configuration and chart rendering.

Important models:

- `VisualisationType`
- `ProjectVisualisation`
- `ChartParameter`
- profile/chart linking and override models

Important service:

- `ChartService`: builds historical chart data from sensor readings, including multi-parameter trends, correlation heatmaps, nitrogen cycle, temperature trend, dissolved oxygen, disease risk, and water quality index.

### `module_notification`

Owns alerts and alert log lifecycle.

Important models:

- `Alert`
- `AlertLog`

Current alert lifecycle includes triggered, acknowledged, and resolved state. Threshold checks create alerts and auto-resolve open alerts when values normalize.

### `module_ai`

Currently empty placeholder. This is useful as a planned boundary but not proof of implemented AI capability.

## Frontend Features

Main routes in `frontend/src/App.tsx`:

- `/login`
- `/overview`
- `/digital-twin`
- `/real-time`
- `/historical`
- `/energy`
- `/pond-comparison`
- `/user-management/users`

Notable frontend capabilities:

- Session hydration through `/api/auth/me`
- Protected routes and admin-only routes
- Global WebSocket initialization
- Dynamic profile context loaded from `GET /api/profile-types/`
- Overview dashboard
- Digital twin page
- Forecast/real-time page
- Historical data page
- Energy consumption dashboard
- Pond comparison page
- User management dialogs and tests

## Current Data Flow

Existing real-time flow:

1. Simulator or MQTT device emits sensor data.
2. Ingestion endpoint/adapter receives payload.
3. Payload is validated.
4. Device and sensor mapping are resolved.
5. Raw `SensorMessage` is inserted.
6. Parsed `SensorReading` row is inserted.
7. Thresholds are checked against project settings.
8. `AlertLog` is created or auto-resolved.
9. Reading and alerts are broadcast over Redis-backed Django Channels.
10. React WebSocket client updates Zustand state and UI.

Existing historical flow:

1. Frontend requests pond historical data or chart package.
2. Backend verifies project/pond access.
3. Backend queries `sensor_readings`.
4. `ChartService`, `EnergyDashboardService`, or `PondComparisonService` aggregates data.
5. Frontend renders charts/cards.

## Current Deployment

The current deployment path is Azure VM oriented:

- VM1: frontend, Nginx, public IP, optional MQTT proxy
- VM2: backend, Django/Daphne, PostgreSQL, Redis, Mosquitto, private IP
- GitHub Actions deployment workflows exist for backend and frontend on `main`
- Backend workflow pulls code on VM2, syncs systemd files, collects static files, restarts `daphne` and `mqtt-adapter`, then performs a health check
- Frontend workflow builds React and syncs `dist` to VM1 via rsync, then reloads Nginx

This is useful operational evidence, but it is not yet cloud-native microservices or Kubernetes.

## Current Testing Evidence

Existing testing assets include:

- Backend module_user pytest tests for auth, profile, users, access, permissions, serializers, services
- Backend verification scripts for API endpoints, chart models, data ingestion models, MQTT adapter, notification models, project models, sensor models, users, WebSockets, Redis, settings, database
- Frontend Vitest/Testing Library tests for login, API service, schema, layout, user management
- Frontend Playwright e2e for user management

Testing is uneven across modules. The strongest automated coverage appears to be user management and frontend user-management flows.

## Natural Microservice Candidates

Use these as bounded-context candidates:

- Identity and Access Service: users, project access, feature/action controls, auth/session
- Project/Profile Service: profile types, projects, parameter catalogues, project parameter settings, energy settings
- Pond and Cycle Service: ponds, cycles, daily health, stage metrics, treatments
- Sensor Registry Service: sensor types, IoT devices, project sensor deployment mapping
- Ingestion Service: MQTT/WebSocket ingest, validation, idempotency, raw message/readings writes
- Alert and Notification Service: alert lifecycle, notification dispatch, escalation
- Chart and Analytics Service: historical charts, pond comparison, energy analytics, WQI/disease risk calculations
- Realtime Gateway Service: WebSocket subscriptions and fanout
- AI/ML Service: forecast/anomaly/disease-risk model serving, LLM/agent workflows
- Audit/Observability Service: audit events, trace correlation, decision logs

## Current Strengths To Emphasize

- Real aquaculture domain with IoT and real-time monitoring.
- Existing modularization already points toward DDD boundaries.
- PostgreSQL schema has meaningful domain entities, not just CRUD tables.
- MQTT ingestion already has device HMAC and replay/timestamp protection.
- JWT cookies and CSRF protection are already implemented.
- RBAC/project access is centralized in `RBACService`.
- Alerting, charts, energy, pond comparison, and profile-driven configuration are present.
- Existing documentation and refinement notes show engineering process, not only final code.

## Current Gaps To Be Honest About

- No implemented Kubernetes microservice platform yet.
- No database-per-service implementation yet.
- `module_ai` is empty.
- DevSecOps evidence is incomplete compared with target goals.
- Existing deployment is VM/systemd based.
- The TypeScript/Express backend and Django backend need positioning to avoid confusing assessors.
- Existing tests are not uniformly distributed across all modules.
- MLOps/LLMSecOps/Agentic AI should be described as planned add-ons until implemented.

## Recommended Assessment Narrative

Position the project as an inherited aquaculture monolith that has already been substantially stabilized and modularized, then explain the capstone value as the next engineering step:

- Step 1: Stabilize and document current monolith.
- Step 2: Identify DDD bounded contexts from existing modules.
- Step 3: Design cloud-native target architecture.
- Step 4: Extract a significant slice into deployable services.
- Step 5: Add DevSecOps and test evidence.
- Step 6: Add one credible AI/ML/LLM enhancement with governance and safety controls.

Do not present every aspirational feature as done. Present a roadmap with implemented MVP slice, evidence, and clear future hardening.
