package com.aquashield.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * PARITY (module_project.ParameterType). CRITICAL ALIAS: the monolith's
 * `ParameterType.name` property returns parameter_code — the entire threshold engine
 * keys its maps on parameter_code. thresholdKey() preserves that contract.
 */
@Entity
@Table(name = "parameter_types")
public class ParameterType {

  @Id
  @GeneratedValue
  @Column(name = "parameter_id")
  private UUID parameterId;

  @Column(name = "parameter_name", nullable = false)
  private String parameterName;

  @Column(name = "parameter_code", nullable = false, unique = true)
  private String parameterCode;

  @Column
  private String unit;

  @Column(name = "data_type", nullable = false)
  private String dataType = "float";

  /** PARITY: monolith's `.name` alias — threshold maps key on the CODE, never the display name. */
  public String thresholdKey() {
    return parameterCode;
  }

  public UUID getParameterId() { return parameterId; }
  public String getParameterName() { return parameterName; }
  public String getParameterCode() { return parameterCode; }
  public String getUnit() { return unit; }
  public String getDataType() { return dataType; }
}
