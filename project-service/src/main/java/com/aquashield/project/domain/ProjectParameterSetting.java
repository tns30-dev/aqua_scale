package com.aquashield.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * PARITY (module_project.ProjectParameterSetting): UNIQUE(project,parameter);
 * NULL threshold side is skipped; bounds are INCLUSIVE.
 */
@Entity
@Table(name = "project_parameter_settings")
public class ProjectParameterSetting {

  @Id
  @GeneratedValue
  @Column(name = "project_parameter_setting_id")
  private UUID id;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "parameter_id")
  private ParameterType parameter;

  @Column(name = "min_threshold")
  private Double minThreshold;

  @Column(name = "max_threshold")
  private Double maxThreshold;

  @Column(name = "is_key_parameter", nullable = false)
  private boolean keyParameter;

  protected ProjectParameterSetting() {}

  public ProjectParameterSetting(UUID projectId, ParameterType parameter,
                                 Double minThreshold, Double maxThreshold, boolean keyParameter) {
    this.projectId = projectId;
    this.parameter = parameter;
    this.minThreshold = minThreshold;
    this.maxThreshold = maxThreshold;
    this.keyParameter = keyParameter;
  }

  /** PARITY (is_within_threshold): inclusive bounds; NULL side skipped. */
  public boolean isWithinThreshold(double value) {
    if (minThreshold != null && value < minThreshold) {
      return false;
    }
    return maxThreshold == null || value <= maxThreshold;
  }

  /** PARITY (get_violation_message): null when within range. */
  public String getViolationMessage(double value) {
    String code = parameter.thresholdKey();
    if (minThreshold != null && value < minThreshold) {
      return code + " below minimum: " + fmt(value) + " < " + fmt(minThreshold);
    }
    if (maxThreshold != null && value > maxThreshold) {
      return code + " above maximum: " + fmt(value) + " > " + fmt(maxThreshold);
    }
    return null;
  }

  private static String fmt(double v) {
    return v == Math.floor(v) && !Double.isInfinite(v) ? String.valueOf((long) v) : String.valueOf(v);
  }

  public UUID getId() { return id; }
  public UUID getProjectId() { return projectId; }
  public ParameterType getParameter() { return parameter; }
  public Double getMinThreshold() { return minThreshold; }
  public void setMinThreshold(Double minThreshold) { this.minThreshold = minThreshold; }
  public Double getMaxThreshold() { return maxThreshold; }
  public void setMaxThreshold(Double maxThreshold) { this.maxThreshold = maxThreshold; }
  public boolean isKeyParameter() { return keyParameter; }
  public void setKeyParameter(boolean keyParameter) { this.keyParameter = keyParameter; }
}
