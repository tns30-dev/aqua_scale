package com.aquashield.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PARITY (module_project.ProjectEnergySetting): UNIQUE(project,type); tariff 4dp,
 * thresholds 3dp; created_by/updated_by are plain UUIDs (not FKs); PUT is a MERGE
 * upsert (absent keys keep prior values).
 */
@Entity
@Table(name = "project_energy_settings")
public class ProjectEnergySetting {

  @Id
  @GeneratedValue
  @Column(name = "project_energy_setting_id")
  private UUID id;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @Column(nullable = false)
  private String type = "electricity";

  @Column(nullable = false)
  private String unit = "kWh";

  @Column(name = "tariff_per_unit", nullable = false, precision = 10, scale = 4)
  private BigDecimal tariffPerUnit = BigDecimal.ZERO;

  @Column(nullable = false)
  private String currency = "USD";

  @Column(name = "high_hourly_threshold", precision = 10, scale = 3)
  private BigDecimal highHourlyThreshold;

  @Column(name = "high_daily_threshold", precision = 10, scale = 3)
  private BigDecimal highDailyThreshold;

  @Column(name = "manual_entry_enabled", nullable = false)
  private boolean manualEntryEnabled = true;

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

  protected ProjectEnergySetting() {}

  public ProjectEnergySetting(UUID projectId, String type, UUID createdBy) {
    this.projectId = projectId;
    this.type = type;
    this.createdBy = createdBy;
    this.updatedBy = createdBy;
  }

  // --- accessors ---
  public UUID getId() { return id; }
  public UUID getProjectId() { return projectId; }
  public String getType() { return type; }
  public String getUnit() { return unit; }
  public void setUnit(String unit) { this.unit = unit; }
  public BigDecimal getTariffPerUnit() { return tariffPerUnit; }
  public void setTariffPerUnit(BigDecimal tariffPerUnit) { this.tariffPerUnit = tariffPerUnit; }
  public String getCurrency() { return currency; }
  public void setCurrency(String currency) { this.currency = currency; }
  public BigDecimal getHighHourlyThreshold() { return highHourlyThreshold; }
  public void setHighHourlyThreshold(BigDecimal v) { this.highHourlyThreshold = v; }
  public BigDecimal getHighDailyThreshold() { return highDailyThreshold; }
  public void setHighDailyThreshold(BigDecimal v) { this.highDailyThreshold = v; }
  public boolean isManualEntryEnabled() { return manualEntryEnabled; }
  public void setManualEntryEnabled(boolean manualEntryEnabled) { this.manualEntryEnabled = manualEntryEnabled; }
  public String getNotes() { return notes; }
  public void setNotes(String notes) { this.notes = notes; }
  public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
