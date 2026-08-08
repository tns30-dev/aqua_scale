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
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
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

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

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
    public void setDate(LocalDate date) { this.date = date; }
    public String getHealthStatus() { return healthStatus; }
    public void setHealthStatus(String healthStatus) { this.healthStatus = healthStatus; }
    public int getAlertCount() { return alertCount; }
    public void setAlertCount(int alertCount) { this.alertCount = alertCount; }
    public UUID getCreatedBy() { return createdBy; }
    public UUID getUpdatedBy() { return updatedBy; }
    public boolean isHumanEdited() { return createdBy != null || updatedBy != null; }
  }

  /** PARITY: metrics JSONB {"code": {"avg","min","max"}}; one row per (cycle, stage). */
  @Entity
  @Table(name = "cycle_stage_metrics",
      uniqueConstraints = @UniqueConstraint(
          name = "uq_cycle_stage_metrics_cycle_stage",
          columnNames = {"cycle_id", "stage_name"}))
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

  /**
   * Treatment catalogue. New rows are project-scoped; NULL project_id rows are first-round
   * global seed data retained for demo/backward compatibility.
   */
  @Entity
  @Table(name = "treatments")
  public static class Treatment {

    @Id
    @GeneratedValue
    @Column(name = "treatment_id")
    private UUID treatmentId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(nullable = false, columnDefinition = "text")
    private String code;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "target_parameters", nullable = false)
    private JsonNode targetParameters;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(name = "price_unit", nullable = false, length = 2)
    private String priceUnit = "kg";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected Treatment() {}

    public Treatment(UUID projectId, String code, String name, String description,
                     JsonNode targetParameters, BigDecimal unitPrice, String priceUnit) {
      this.projectId = projectId;
      this.code = code;
      this.name = name;
      this.description = description;
      this.targetParameters = targetParameters;
      this.unitPrice = unitPrice == null ? BigDecimal.ZERO : unitPrice;
      this.priceUnit = priceUnit == null || priceUnit.isBlank() ? "kg" : priceUnit;
    }

    public UUID getTreatmentId() { return treatmentId; }
    public UUID getProjectId() { return projectId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public JsonNode getTargetParameters() { return targetParameters; }
    public void setTargetParameters(JsonNode targetParameters) { this.targetParameters = targetParameters; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public String getPriceUnit() { return priceUnit; }
    public void setPriceUnit(String priceUnit) { this.priceUnit = priceUnit; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
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

    @Column(precision = 12, scale = 3)
    private BigDecimal amount;

    @Column(length = 2)
    private String unit;

    @Column(name = "unit_price", precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "price_unit", length = 2)
    private String priceUnit;

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

    protected PondTreatment() {}

    public PondTreatment(UUID pondId, Treatment treatment, LocalDate startedAt,
                         LocalDate endedAt, String notes, BigDecimal amount, String unit,
                         UUID actingUserId) {
      this.pondId = pondId;
      this.treatment = treatment;
      this.startedAt = startedAt;
      this.endedAt = endedAt;
      this.notes = notes;
      this.amount = amount;
      this.unit = unit;
      snapshotPrice(treatment);
      this.createdBy = actingUserId;
      this.updatedBy = actingUserId;
    }

    public boolean isActive() {
      return endedAt == null; // PARITY: derived
    }

    public UUID getPondTreatmentId() { return pondTreatmentId; }
    public UUID getPondId() { return pondId; }
    public Treatment getTreatment() { return treatment; }
    public void setTreatment(Treatment treatment) { this.treatment = treatment; }
    public LocalDate getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDate startedAt) { this.startedAt = startedAt; }
    public LocalDate getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDate endedAt) { this.endedAt = endedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public String getPriceUnit() { return priceUnit; }
    public void setPriceUnit(String priceUnit) { this.priceUnit = priceUnit; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }

    public void snapshotPrice(Treatment product) {
      this.unitPrice = product == null ? null : product.getUnitPrice();
      this.priceUnit = product == null ? null : product.getPriceUnit();
    }
  }

  /** Per-project feed catalogue. Unit price is derived, never stored. */
  @Entity
  @Table(name = "feed_types")
  public static class FeedType {

    @Id
    @GeneratedValue
    @Column(name = "feed_type_id")
    private UUID feedTypeId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "pack_kg", nullable = false, precision = 7, scale = 2)
    private BigDecimal packKg;

    @Column(name = "pack_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal packPrice;

    @Column(nullable = false, length = 3)
    private String currency = "SGD";

    @Column(nullable = false)
    private boolean active = true;

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

    protected FeedType() {}

    public FeedType(UUID projectId, String name, BigDecimal packKg, BigDecimal packPrice,
                    String currency, UUID actingUserId) {
      this.projectId = projectId;
      this.name = name;
      this.packKg = packKg;
      this.packPrice = packPrice;
      this.currency = currency == null || currency.isBlank() ? "SGD" : currency;
      this.createdBy = actingUserId;
      this.updatedBy = actingUserId;
    }

    public UUID getFeedTypeId() { return feedTypeId; }
    public UUID getProjectId() { return projectId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getPackKg() { return packKg; }
    public void setPackKg(BigDecimal packKg) { this.packKg = packKg; }
    public BigDecimal getPackPrice() { return packPrice; }
    public void setPackPrice(BigDecimal packPrice) { this.packPrice = packPrice; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
  }

  /** One feeding event. Pack size and price are frozen snapshots at write time. */
  @Entity
  @Table(name = "feed_logs")
  public static class FeedLog {

    @Id
    @GeneratedValue
    @Column(name = "feed_log_id")
    private UUID feedLogId;

    @Column(name = "pond_id", nullable = false)
    private UUID pondId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "feed_type_id")
    private FeedType feedType;

    @Column(name = "fed_on", nullable = false)
    private LocalDate fedOn;

    @Column(name = "fed_time")
    private LocalTime fedTime;

    @Column(name = "amount_kg", nullable = false, precision = 7, scale = 2)
    private BigDecimal amountKg;

    @Column(name = "pack_kg", nullable = false, precision = 7, scale = 2)
    private BigDecimal packKg;

    @Column(name = "pack_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal packPrice;

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

    protected FeedLog() {}

    public FeedLog(UUID pondId, FeedType feedType, LocalDate fedOn, LocalTime fedTime,
                   BigDecimal amountKg, UUID actingUserId) {
      this.pondId = pondId;
      this.feedType = feedType;
      this.fedOn = fedOn;
      this.fedTime = fedTime;
      this.amountKg = amountKg;
      snapshotPack(feedType);
      this.createdBy = actingUserId;
      this.updatedBy = actingUserId;
    }

    public void snapshotPack(FeedType feedType) {
      this.feedType = feedType;
      this.packKg = feedType.getPackKg();
      this.packPrice = feedType.getPackPrice();
    }

    public UUID getFeedLogId() { return feedLogId; }
    public UUID getPondId() { return pondId; }
    public FeedType getFeedType() { return feedType; }
    public LocalDate getFedOn() { return fedOn; }
    public LocalTime getFedTime() { return fedTime; }
    public void setFedTime(LocalTime fedTime) { this.fedTime = fedTime; }
    public BigDecimal getAmountKg() { return amountKg; }
    public void setAmountKg(BigDecimal amountKg) { this.amountKg = amountKg; }
    public BigDecimal getPackKg() { return packKg; }
    public BigDecimal getPackPrice() { return packPrice; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
  }
}
