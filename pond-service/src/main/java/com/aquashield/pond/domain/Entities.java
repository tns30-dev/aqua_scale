package com.aquashield.pond.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Remaining pond-domain entities (DDL-authoritative shapes). */
public final class Entities {

  private Entities() {}

  /** PARITY: one row per (cycle, day_number) UNIQUE; day 1..200; status incl. 'future'. */
  @Entity
  @Table(name = "cycle_daily_health")
  public static class CycleDailyHealth {

    @Id
    @GeneratedValue
    @Column(name = "health_id")
    private UUID healthId;

    @Column(name = "cycle_id", nullable = false)
    private UUID cycleId;

    @Column(name = "day_number", nullable = false)
    private int dayNumber;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "health_status")
    private String healthStatus;

    @Column(name = "alert_count", nullable = false)
    private int alertCount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    protected CycleDailyHealth() {}

    public CycleDailyHealth(UUID cycleId, int dayNumber, LocalDate date,
                            String healthStatus, int alertCount) {
      this.cycleId = cycleId;
      this.dayNumber = dayNumber;
      this.date = date;
      this.healthStatus = healthStatus;
      this.alertCount = alertCount;
    }

    public UUID getCycleId() { return cycleId; }
    public int getDayNumber() { return dayNumber; }
    public LocalDate getDate() { return date; }
    public String getHealthStatus() { return healthStatus; }
    public int getAlertCount() { return alertCount; }
  }

  /** PARITY: metrics JSONB {"code": {"avg","min","max"}}; only calculated_at; NO unique. */
  @Entity
  @Table(name = "cycle_stage_metrics")
  public static class CycleStageMetric {

    @Id
    @GeneratedValue
    @Column(name = "metric_id")
    private UUID metricId;

    @Column(name = "cycle_id", nullable = false)
    private UUID cycleId;

    @Column(name = "stage_name")
    private String stageName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private JsonNode metrics;

    @CreationTimestamp
    @Column(name = "calculated_at", updatable = false)
    private OffsetDateTime calculatedAt;

    protected CycleStageMetric() {}

    public CycleStageMetric(UUID cycleId, String stageName, JsonNode metrics) {
      this.cycleId = cycleId;
      this.stageName = stageName;
      this.metrics = metrics;
    }

    public UUID getCycleId() { return cycleId; }
    public String getStageName() { return stageName; }
    public JsonNode getMetrics() { return metrics; }
  }

  /** PARITY: global catalogue (NOT project-scoped, no RBAC), code unique, name-ordered. */
  @Entity
  @Table(name = "treatments")
  public static class Treatment {

    @Id
    @GeneratedValue
    @Column(name = "treatment_id")
    private UUID treatmentId;

    @Column(nullable = false, unique = true, columnDefinition = "text")
    private String code;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    public UUID getTreatmentId() { return treatmentId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public boolean isActive() { return active; }
  }

  /** PARITY: is_active is DERIVED (ended_at IS NULL); history rows preserved. */
  @Entity
  @Table(name = "pond_treatments")
  public static class PondTreatment {

    @Id
    @GeneratedValue
    @Column(name = "pond_treatment_id")
    private UUID pondTreatmentId;

    @Column(name = "pond_id", nullable = false)
    private UUID pondId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "treatment_id")
    private Treatment treatment;

    @Column(name = "started_at", nullable = false)
    private LocalDate startedAt;

    @Column(name = "ended_at")
    private LocalDate endedAt;

    @Column(columnDefinition = "text")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    public boolean isActive() {
      return endedAt == null; // PARITY: derived
    }

    public UUID getPondId() { return pondId; }
    public Treatment getTreatment() { return treatment; }
    public LocalDate getStartedAt() { return startedAt; }
    public LocalDate getEndedAt() { return endedAt; }
    public String getNotes() { return notes; }
  }
}
