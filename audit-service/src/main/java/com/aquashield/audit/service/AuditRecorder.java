package com.aquashield.audit.service;

import com.aquashield.audit.domain.AuditEvent;
import com.aquashield.audit.repo.AuditEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;

/**
 * Validation + idempotent append (spec: main/audit_service.md).
 *
 * Two ingress shapes:
 *  - record(): a dedicated audit payload from the audit.event.recorded topic — strict
 *    required-field validation (auditId, eventType, serviceName, resourceType, action,
 *    outcome, occurredAt, correlationId; actorUserId for user actions).
 *  - recordBusinessEvent(): any platform business event envelope — the audit record is
 *    derived (auditId = envelope eventId, outcome = success, payload kept as metadata).
 *
 * Idempotency: audit_id is the PK; a duplicate insert is DUPLICATE, never an error.
 */
@Service
public class AuditRecorder {

  public enum Result { RECORDED, DUPLICATE, REJECTED }

  private static final Logger log = LoggerFactory.getLogger(AuditRecorder.class);
  private static final Set<String> CATEGORIES = Set.of("security", "business");

  private final AuditEventRepository events;

  public AuditRecorder(AuditEventRepository events) {
    this.events = events;
  }

  /** Strict path: payload IS the audit record (audit.event.recorded topic). */
  @Transactional
  public Result record(JsonNode envelope) {
    JsonNode payload = envelope.path("payload");
    UUID auditId = uuidOrNull(payload.path("auditId").asText(null));
    String eventType = textOrNull(payload, "eventType");
    String serviceName = firstNonNull(textOrNull(payload, "serviceName"),
        textOrNull(envelope, "source"));
    String resourceType = textOrNull(payload, "resourceType");
    String action = textOrNull(payload, "action");
    String outcome = textOrNull(payload, "outcome");
    OffsetDateTime occurredAt = instantOrNull(payload.path("occurredAt").asText(null));
    String correlationId = firstNonNull(textOrNull(payload, "correlationId"),
        textOrNull(envelope, "correlationId"));

    if (auditId == null || eventType == null || serviceName == null || resourceType == null
        || action == null || outcome == null || occurredAt == null || correlationId == null) {
      log.warn("REJECTED audit event (missing required fields): {}", payload.toString());
      return Result.REJECTED;
    }
    String category = payload.path("category").asText("business");
    if (!CATEGORIES.contains(category)) {
      log.warn("REJECTED audit event (unknown category {})", category);
      return Result.REJECTED;
    }
    UUID actor = uuidOrNull(payload.path("actorUserId").asText(null));
    UUID projectId = uuidOrNull(firstNonNull(payload.path("projectId").asText(null),
        envelope.path("projectId").asText(null)));

    return append(new AuditEvent(auditId, eventType, category, actor, serviceName, projectId,
        resourceType, textOrNull(payload, "resourceId"), action, outcome, occurredAt,
        correlationId, textOrNull(payload, "traceId"),
        payload.path("metadata").isMissingNode() ? null : payload.get("metadata")));
  }

  /**
   * Derived path: any canonical business envelope becomes an audit record.
   * eventType "project.settings.updated" -> resourceType "project.settings", action
   * "updated" (last dot segment = action). The full payload is preserved as metadata.
   */
  @Transactional
  public Result recordBusinessEvent(JsonNode envelope) {
    UUID auditId = uuidOrNull(envelope.path("eventId").asText(null));
    String eventType = textOrNull(envelope, "eventType");
    String source = textOrNull(envelope, "source");
    OffsetDateTime occurredAt = instantOrNull(envelope.path("occurredAt").asText(null));
    String correlationId = textOrNull(envelope, "correlationId");
    if (auditId == null || eventType == null || source == null || occurredAt == null
        || correlationId == null) {
      log.warn("REJECTED business event for audit (malformed envelope)");
      return Result.REJECTED;
    }
    int lastDot = eventType.lastIndexOf('.');
    String resourceType = lastDot > 0 ? eventType.substring(0, lastDot) : eventType;
    String action = lastDot > 0 ? eventType.substring(lastDot + 1) : "occurred";
    JsonNode payload = envelope.path("payload");
    UUID actor = uuidOrNull(payload.path("actorUserId").asText(null));

    return append(new AuditEvent(auditId, eventType, "business", actor, source,
        uuidOrNull(envelope.path("projectId").asText(null)), resourceType,
        envelope.path("pondId").asText(null), action, "success", occurredAt,
        correlationId, null, payload.isMissingNode() ? null : payload));
  }

  private Result append(AuditEvent event) {
    if (events.existsById(event.getAuditId())) {
      return Result.DUPLICATE;
    }
    try {
      events.save(event);
      return Result.RECORDED;
    } catch (DataIntegrityViolationException e) {
      return Result.DUPLICATE; // concurrent redelivery lost the PK race — idempotent
    }
  }

  private static String textOrNull(JsonNode node, String field) {
    String value = node.path(field).asText(null);
    return value == null || value.isBlank() ? null : value;
  }

  private static UUID uuidOrNull(String value) {
    try {
      return value == null ? null : UUID.fromString(value);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private static OffsetDateTime instantOrNull(String value) {
    try {
      return value == null ? null : Instant.parse(value).atOffset(ZoneOffset.UTC);
    } catch (Exception e) {
      return null;
    }
  }

  private static String firstNonNull(String a, String b) {
    return a != null && !a.isBlank() ? a : (b != null && !b.isBlank() ? b : null);
  }
}
