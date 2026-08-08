package com.aquashield.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PARITY (alert_log DDL): the real alert entity. Status = (acknowledged, resolved) pair —
 * no enum column. Severity produced: only "critical" (max breach) / "warning" (min);
 * log_type mapping critical->alert, warning->warning. `parameter` stores parameter_code.
 * Acknowledged-but-unresolved rows are INVISIBLE to dedup and auto-resolve (asymmetry
 * the monolith tests on purpose — oracle 14).
 */
@Entity
@Table(name = "alert_log")
public class AlertLog {

  @Id
  @GeneratedValue
  @Column(name = "log_id")
  private UUID logId;

  @Column(name = "pond_id")
  private UUID pondId;

  @Column(name = "project_id")
  private UUID projectId;

  @Column(name = "pond_name")
  private String pondName;

  @CreationTimestamp
  @Column(name = "\"timestamp\"", updatable = false)
  private OffsetDateTime timestamp;

  @Column(name = "log_type", nullable = false)
  private String logType;

  @Column(nullable = false, columnDefinition = "text")
  private String message;

  @Column
  private String severity;

  @Column(nullable = false)
  private boolean acknowledged;

  @Column(name = "acknowledged_by")
  private UUID acknowledgedBy;

  @Column(name = "acknowledged_at")
  private OffsetDateTime acknowledgedAt;

  @Column(nullable = false)
  private boolean resolved;

  @Column
  private String parameter;

  @Column(name = "reading_timestamp")
  private OffsetDateTime readingTimestamp;

  @Column(name = "resolved_by")
  private UUID resolvedBy;

  @Column(name = "resolved_at")
  private OffsetDateTime resolvedAt;

  protected AlertLog() {}

  public AlertLog(UUID projectId, UUID pondId, String logType, String message,
                  String severity, String parameter, OffsetDateTime readingTimestamp) {
    this.projectId = projectId;
    this.pondId = pondId;
    this.logType = logType;
    this.message = message;
    this.severity = severity;
    this.parameter = parameter;
    this.readingTimestamp = readingTimestamp;
  }

  /** PARITY: is_active = not acknowledged and not resolved. */
  public boolean isActive() {
    return !acknowledged && !resolved;
  }

  public UUID getLogId() { return logId; }
  public UUID getPondId() { return pondId; }
  public UUID getProjectId() { return projectId; }
  public String getPondName() { return pondName; }
  public OffsetDateTime getTimestamp() { return timestamp; }
  public String getLogType() { return logType; }
  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
  public String getSeverity() { return severity; }
  public boolean isAcknowledged() { return acknowledged; }
  public void acknowledge(UUID userId, OffsetDateTime at) {
    this.acknowledged = true;
    this.acknowledgedBy = userId;
    this.acknowledgedAt = at;
  }
  public boolean isResolved() { return resolved; }
  public String getParameter() { return parameter; }
  public OffsetDateTime getReadingTimestamp() { return readingTimestamp; }
  public void setReadingTimestamp(OffsetDateTime readingTimestamp) {
    this.readingTimestamp = readingTimestamp;
  }
}
