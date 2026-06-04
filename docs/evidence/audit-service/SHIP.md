# Audit Service — Ship Evidence

Ship date: 2026-06-04. Spec: `cooking_tracker/main/audit_service.md`. NET-NEW platform
capability — the monolith has no audit table (verified: no audit DDL in the schema dump;
only Django admin registrations match "audit").

## What shipped

| Piece | Where |
|---|---|
| audit-service (Java, Boot, port 8092) | `audit-service/` — Maven module enabled in root pom |
| Append-only store | `audit.audit_events` (V1) — UPDATE/DELETE blocked by a DB trigger, not just app discipline |
| Ingress | Pub/Sub consumers: dedicated `audit.event.recorded` (strict payload validation) + the business event stream (15 catalogue subs, envelope-derived records) |
| Admin query API | `GET /api/audit/{events,events/{id},projects/{id},users/{id},security}` — ALL platform-admin only |
| Identity audit publishing | `IdentityAuditPublisher` — `login.succeeded` / `login.failed` (reasons: invalid_credentials, rate_limited) on `audit.event.recorded`; closes identity's long-PENDING audit item |
| CI | audit-service added to java path filters + SERVICES matrix (lesson from the pond gap applied at ship time) |

## Design decisions

- **Two ingress shapes** (catalogue: `scripts/pubsub-bootstrap.sh` already routed 15 topics
  to `audit.*.sub` subs): strict audit payloads carry the full spec field set
  (auditId/eventType/category/actorUserId/serviceName/resourceType/resourceId/action/
  outcome/occurredAt/correlationId/traceId/metadata); business envelopes derive
  resourceType + action from eventType (`project.settings.updated` → `project.settings` /
  `updated`), outcome=success, auditId=envelope eventId, payload preserved as metadata.
- **Idempotency**: audit_id is the PK; duplicate delivery → DUPLICATE → ack (PK-race safe).
- **Ack discipline** (main/eda.md): RECORDED/DUPLICATE/REJECTED → ack (terminal);
  transient DB failure → nack → redelivery → DLQ after 5 attempts.
- **Append-only in the DATABASE**: `BEFORE UPDATE OR DELETE` trigger raises — even the
  owning role cannot mutate history (IT t07 proves it).
- **Categories**: `security` | `business` (CHECK constraint); `/api/audit/security` review
  endpoint filters category=security.
- **Auth**: platform pattern (JwtVerifier public key + fail-closed snapshot); every query
  endpoint `@PreAuthorize(hasRole('PLATFORM_ADMIN'))`. 401 no/bad token, 403 non-admin.
- **Identity flow**: audit publish is best-effort (login never fails because the bus
  hiccuped); payloads never carry credentials or token material (IT-asserted); failed
  logins by KNOWN accounts are attributed (actorUserId), unknown emails are not.

## Deferred (tracked)

- Audit payloads from project/pond/sensor/notification services on the dedicated topic —
  their business events already reach the trail via envelope derivation; richer per-action
  payloads (incl. actorUserId on writes) are a follow-up.
- BigQuery/GCS cold archive (spec future option). Cloud Logging trace correlation will
  light up once services run on GKE (traceId column is ready).

## Test evidence

- `AuditServiceIT`: **7/7 green** (`mvn -pl audit-service -am clean verify`, 2026-06-04) —
  t01 valid audit event stored once with the full field set; t02 duplicate auditId
  idempotent; t03 missing required field rejected, never stored; t04 business envelope
  (project.updated) derived into an audit record (resource/action split, metadata
  preserved, outcome success); t05 query API 401 unauth / 403 non-admin / 200 admin with
  filters; t06 detail + 404 envelope + project/user/security trails; t07 UPDATE and
  DELETE both raise `audit_events is append-only` AT THE DATABASE.
- `identity-access-service`: **33 tests green** (AuthFlowIT 13 incl. NEW
  `t12_loginAttempts_emitSecurityAuditEvents` — pulls the real emulator subscription and
  asserts the login.succeeded/login.failed payload contract: category=security,
  attributable actor on known-account failures, reason codes, and NO credential material
  in the payload; LoginRateLimitIT + IdentityGrpcIT run with events disabled).
- Spec Test Checklist coverage: valid stored once ✓ (t01), duplicate idempotent ✓ (t02),
  missing field rejected ✓ (t03), admin query by project ✓ (t06), trace correlation ✓
  (t01 asserts trace_id round-trip).

## Build/verify gotcha worth remembering

`mvn -pl audit-service verify` (without `-am`) fails dependency resolution (`common` is
never installed to ~/.m2 by reactor builds) — and a `cmd | grep` pipeline masks mvn's
exit code. Two "passing" runs were stale reports; the real run is `-pl <svc> -am`.

## Field mapping (spec "Audit Event Fields" → store)

All 13 spec fields map 1:1 to columns; `category` added for the security review endpoint.
Required-field validation: auditId, eventType, serviceName (payload or envelope source),
resourceType, action, outcome, occurredAt, correlationId (payload or envelope). Missing →
REJECTED (acked, logged) — never stored partially.

## CI verdict (post-push)

Run `26952061112` (push `7e08019`, 2026-06-04): **SUCCESS.**
- `java-verify` fanned out to ALL EIGHT java services (root pom change) — including
  `audit-service`'s first CI run (1m37s) ✓
- `container (audit-service)` image build + Trivy CRITICAL gate ✓ (1m17s)
- all security gates (gitleaks / semgrep / trivy-fs / sbom) ✓
- analytics lanes correctly SKIPPED (no analytics-service or proto changes) —
  path-awareness working as designed
