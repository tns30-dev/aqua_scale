# Security And DevSecOps Context

Last updated: 2026-06-03

This file captures security requirements, threat-model ideas, current AquaShield controls, and target DevSecOps controls. Use it when writing security sections, designing microservices, planning CI/CD, or proposing LLMSecOps.

## Source Inputs

- `cooking_tracker/hard_context_reference/security.pdf`
- `AquaMonitoringv2/backend/config/settings/base.py`
- `AquaMonitoringv2/backend/config/settings/production.py`
- `AquaMonitoringv2/backend/module_user/`
- `AquaMonitoringv2/backend/module_sensor/management/commands/mqtt_adapter.py`
- `AquaMonitoringv2/backend/module_data_ingestion/services.py`
- `AquaMonitoringv2/frontend/src/services/api.service.ts`
- `AquaMonitoringv2/frontend/src/services/websocket.service.ts`
- `AquaMonitoringv2/deploy/DEPLOYMENT_GUIDE.md`

## ChronoFlow Security Capability Summary

The ChronoFlow security reference demonstrates:

- Security requirements by category
- STRIDE threat modelling
- Trust boundary matrix
- Threat register and risk prioritization
- Security control mapping
- Verification table
- Edge security and WAF rules
- TLS, HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- Server-side RBAC
- Private database access
- Secrets management
- CI SAST/SCA/security scans
- WebSocket security
- Push notification encryption
- Zero Trust controls with service identities, Istio mTLS, AuthorizationPolicy, and NetworkPolicy
- SIEM/log pipeline
- TOTP MFA and password policy

The key lesson for AquaShield: security marks require both architecture and evidence. A table of controls is not enough unless tests, logs, screenshots, or CI artifacts prove them.

## Current AquaShield Security Controls

### Authentication And Session

Current evidence:

- `module_user.views.LoginView` stores access and refresh JWTs in HttpOnly cookies.
- JWT cookies use `SameSite=Strict`.
- Secure cookies are enabled outside debug mode.
- Frontend does not store raw tokens.
- `RefreshView` reads refresh token from HttpOnly cookie and sets a new access cookie.
- `logout_view` blacklists refresh token where possible and clears cookies.
- Frontend Axios uses `withCredentials: true`.
- Frontend bootstrap calls `/api/csrf` and attaches `X-CSRFToken` for unsafe methods.

### Authorization

Current evidence:

- `RBACService.get_user_project_ids()`
- `RBACService.has_project_access()`
- `RBACService.has_feature_access()`
- `RBACService.has_action_control()`
- Admin-only views use `IsPlatformAdmin`.
- Session payload includes project assignments and feature/action permissions.

### WebSocket Security

Current evidence:

- `config/asgi.py` wraps WebSocket routes with `AllowedHostsOriginValidator` and custom `JWTAuthMiddleware`.
- Frontend WebSocket URLs do not place tokens in query parameters.
- Browser sends HttpOnly cookie during same-site WebSocket upgrade.
- WebSocket routes include project and pond channels.

Target improvement:

- For microservices, consider AUTH-first short-lived WebSocket token if cookies and origin validation are insufficient for cross-domain production topology.

### Transport And Browser Security

Current evidence:

- `production.py` sets `SECURE_SSL_REDIRECT = True`.
- `SESSION_COOKIE_SECURE = True`.
- `CSRF_COOKIE_SECURE = True`.
- `SECURE_CONTENT_TYPE_NOSNIFF = True`.
- `X_FRAME_OPTIONS = 'DENY'`.
- HSTS enabled for one year with subdomains and preload.
- CORS and CSRF trusted origins are environment-driven.

Target improvement:

- Add CSP explicitly at gateway/ingress.
- Add WAF or Cloud Armor/Front Door equivalent managed rules.
- Verify security headers with DAST and curl/browser evidence.

### IoT/MQTT Security

Current evidence:

- MQTT adapter topic allow-listing.
- Payload size guard.
- Required key validation.
- JSON object validation.
- Timestamp skew check.
- Device lookup by `device_code`.
- HMAC signature verification using `IoTDevice.device_key`.
- Constant-time `hmac.compare_digest`.
- Optional MQTT TLS.
- Deduplication by IoT device and sequence number.

This is one of AquaShield's strongest security narratives because it is domain-specific and tied to IoT data integrity.

### Deployment Security

Current evidence from Azure guide:

- VM1 public, VM2 private.
- VM2 services reachable from VNet only.
- PostgreSQL, Redis, Mosquitto, Django/Daphne hosted privately on VM2.
- SSH to VM2 through VM1 jump host.
- Redis password configuration.
- fail2ban, unattended upgrades, and log rotation mentioned.

Target improvement:

- Move from VM/systemd deployment to Kubernetes with network policies, service accounts, secrets, probes, and container scans.

## Target Trust Boundaries For AquaShield

Use this matrix in the report.

| Boundary | Separates | Primary risks |
|---|---|---|
| TB-1 Public Client to Edge | Browser/React users to API gateway/ingress | brute force, CORS/CSRF abuse, XSS, unauthorized API access, DoS |
| TB-2 IoT Device to MQTT/Ingress | Raspberry Pi/gateways to broker/ingestion | device spoofing, replay, payload tampering, fake readings, broker abuse |
| TB-3 Edge to Backend Services | API gateway/WebSocket gateway to services | gateway bypass, missing authorization propagation, service impersonation |
| TB-4 Service to Data Plane | services to PostgreSQL/Redis/object storage/vector DB | data exposure, stale permissions, lateral movement, audit tampering |
| TB-5 Service to Event Bus | services to Pub/Sub/Kafka/RabbitMQ | rogue publishers, duplicate events, poisoned events, missing idempotency |
| TB-6 Build to Runtime | GitHub Actions, artifacts, images, manifests to production | secret leakage, image tampering, vulnerable dependencies, unsigned images |
| TB-7 AI Tooling to Data/Actions | LLM/agent services to RAG/tools/operations | prompt injection, excessive agency, data leakage, unsafe recommendations |

## AquaShield Threat Register Starter

Prioritize these for the report and implementation.

| ID | Threat | Affected area | Initial controls |
|---|---|---|---|
| T-01 | XSS or frontend injection steals data or causes unsafe actions | React/API | React escaping, CSP, input validation, DAST |
| T-02 | Secrets committed or leaked in CI/deploy | all services | GitHub secret scanning, TruffleHog/Gitleaks, Secret Manager/K8s Secrets |
| T-03 | Brute-force login or credential stuffing | auth | rate limiting, lockout/MFA roadmap, generic login errors |
| T-04 | Broken object-level authorization exposes another project/pond | APIs | centralized project access checks, tests for BOLA |
| T-05 | WebSocket hijacking or unauthorized pond subscription | realtime | origin validation, JWT/cookie validation, AUTH-first token roadmap |
| T-06 | Fake IoT device sends readings | ingestion | HMAC per device, TLS, device registry, active device checks |
| T-07 | MQTT replay or duplicate readings corrupt trends | ingestion | timestamp skew, sequence deduplication, idempotency |
| T-08 | Sensor payload tampering triggers false alerts | ingestion/alerts | HMAC, schema validation, anomaly checks |
| T-09 | Alert spam exhausts notification budget | alerts | deduplication, per-project/user/device rate limits |
| T-10 | Database exposed publicly or plaintext client traffic allowed | data | private DB, TLS, backups/PITR |
| T-11 | Compromised service moves laterally in cluster | microservices | NetworkPolicy, service accounts, mTLS/service mesh optional |
| T-12 | Vulnerable dependency or image reaches production | supply chain | SCA, SBOM, Trivy/Grype, signed images |
| T-13 | LLM prompt injection through SOP/RAG document | AI/RAG | validator, prompt-injection scan, isolated untrusted sources |
| T-14 | LLM reveals sensitive farm/user data | AI | project-scoped retrieval, PII scan, audit logs |
| T-15 | LLM makes unsafe operational recommendation | AI | structured output, safety evaluator, human approval |
| T-16 | Model/tool DoS through huge prompts or sensor history | AI | token budgets, rate limits, retrieval caps |

## Target Security Requirements

### Auth And Access

- Only authenticated users may access protected APIs and screens.
- Server-side project ownership checks on every project/pond/cycle/alert/chart endpoint.
- Admin operations require platform-admin role or explicit action control.
- JWTs are not exposed to JavaScript.
- CSRF protection applies to cookie-authenticated unsafe requests.
- Password policy, reset flow, and MFA can be added as stretch goals.

### IoT And Ingestion

- Every device has a registered identity and secret/key.
- MQTT payloads are signed.
- Replay window is bounded.
- Duplicate messages are idempotent.
- Invalid payloads are rejected and logged.
- Sensor readings can be quarantined if data-quality checks fail.
- Device keys are stored as secrets, not exposed in screenshots/logs.

### Data Protection

- Database is private.
- Backups and point-in-time recovery are enabled.
- Encryption in transit and at rest are documented.
- Sensitive audit/session/config data is not logged.
- Project/tenant isolation is tested.

### Edge And API Gateway

- TLS 1.2+ or TLS 1.3.
- HSTS.
- CSP.
- X-Frame-Options.
- X-Content-Type-Options.
- Request size limits.
- Rate limits.
- WAF managed rules for SQLi, XSS, path traversal, sensitive file access, command injection.

### Microservices And Kubernetes

- One Kubernetes ServiceAccount per service.
- Secrets injected at runtime.
- Readiness and liveness probes.
- Resource limits.
- NetworkPolicy restricts east-west traffic.
- Ingress only reaches API gateway/BFF/realtime gateway.
- Internal databases/brokers are not public.
- Optional service mesh mTLS for high marks if evidence can be produced.

### DevSecOps

- SAST: Bandit/Semgrep for Python, ESLint security rules where useful.
- SCA: pip-audit, npm audit, Dependabot/Renovate.
- SBOM: CycloneDX.
- Container scan: Trivy or Grype.
- Secret scan: Gitleaks or TruffleHog.
- DAST: OWASP ZAP baseline against deployed app.
- Load/stress: k6 or Gatling.
- E2E: Playwright.
- Unit/integration: pytest, Vitest.
- CI artifacts retained for evidence.

### LLMSecOps

- Model Broker or centralized LLM wrapper.
- Prompt versions logged.
- Inputs/outputs schema validated.
- RAG sources classified by trust level.
- Prompt-injection and PII scans.
- Token/cost/rate limits.
- Human-in-the-loop before operational recommendations.
- OWASP LLM Top 10 risk register.
- Promptfoo/DeepEval/DeepTeam or smaller equivalent fixtures as evidence.

## Verification Evidence To Capture

For first/final submission, capture:

- Login protected route evidence
- Unauthenticated API returns 401
- Unauthorized project/pond access rejected
- JWT not present in localStorage
- CSRF required for unsafe request
- WSS or secure WebSocket configuration
- MQTT invalid HMAC rejected
- Duplicate MQTT message deduped
- Security headers screenshot/curl
- CI SAST/SCA/secret/container scan results
- DAST scan report
- k6/Gatling performance result
- Kubernetes NetworkPolicy/service account evidence if implemented
- Database private connectivity/backups evidence if implemented
- AI adversarial/guardrail test evidence if implemented

## Report Framing

Use a security engineering structure:

1. Security objectives
2. Trust boundaries
3. Threat model
4. Risk prioritization
5. Controls
6. Verification evidence
7. Known limitations
8. Future work

Be explicit about residual risk. Honest limitations are better than unsupported claims.
