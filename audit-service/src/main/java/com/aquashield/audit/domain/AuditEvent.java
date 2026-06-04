package com.aquashield.audit.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One immutable audit record (spec: main/audit_service.md "Audit Event Fields").
 * APPEND-ONLY: no setters beyond construction; UPDATE/DELETE are blocked by a DB
 * trigger as well (V1__init.sql) — immutability is not just app discipline.
 */
@Entity
@Table(name = "audit_events")
public class AuditEvent {

  @Id
  @Column(name = "audit_id")
  private UUID auditId;

  @Column(name = "event_type", nullable = false)
  private String eventType;

  @Column(nullable = false)
  private String category = "business";

  @Column(name = "actor_user_id")
  private UUID actorUserId;

  @Column(name = "service_name", nullable = false)
  private String serviceName;

  @Column(name = "project_id")
  private UUID projectId;

  @Column(name = "resource_type", nullable = false)
  private String resourceType;

  @Column(name = "resource_id")
  private String resourceId;

  @Column(nullable = false)
  private String action;

  @Column(nullable = false)
  private String outcome;

  @Column(name = "occurred_at", nullable = false)
  private OffsetDateTime occurredAt;

  @Column(name = "recorded_at", insertable = false, updatable = false)
  private OffsetDateTime recordedAt;

  @Column(name = "correlation_id", nullable = false)
  private String correlationId;

  @Column(name = "trace_id")
  private String traceId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column
  private JsonNode metadata;

  protected AuditEvent() {} // JPA

  public AuditEvent(UUID auditId, String eventType, String category, UUID actorUserId,
                    String serviceName, UUID projectId, String resourceType, String resourceId,
                    String action, String outcome, OffsetDateTime occurredAt,
                    String correlationId, String traceId, JsonNode metadata) {
    this.auditId = auditId;
    this.eventType = eventType;
    this.category = category;
    this.actorUserId = actorUserId;
    this.serviceName = serviceName;
    this.projectId = projectId;
    this.resourceType = resourceType;
    this.resourceId = resourceId;
    this.action = action;
    this.outcome = outcome;
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.traceId = traceId;
    this.metadata = metadata;
  }

  public UUID getAuditId() { return auditId; }
  public String getEventType() { return eventType; }
  public String getCategory() { return category; }
  public UUID getActorUserId() { return actorUserId; }
  public String getServiceName() { return serviceName; }
  public UUID getProjectId() { return projectId; }
  public String getResourceType() { return resourceType; }
  public String getResourceId() { return resourceId; }
  public String getAction() { return action; }
  public String getOutcome() { return outcome; }
  public OffsetDateTime getOccurredAt() { return occurredAt; }
  public OffsetDateTime getRecordedAt() { return recordedAt; }
  public String getCorrelationId() { return correlationId; }
  public String getTraceId() { return traceId; }
  public JsonNode getMetadata() { return metadata; }
}
