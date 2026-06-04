package com.aquashield.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/** PARITY (module_project.GrowthIndicator): soft-referenced by ProfileType key codes. */
@Entity
@Table(name = "growth_indicators")
public class GrowthIndicator {

  @Id
  @GeneratedValue
  @Column(name = "growth_indicator_id")
  private UUID growthIndicatorId;

  @Column(nullable = false, unique = true)
  private String code;

  @Column(nullable = false)
  private String name;

  @Column
  private String unit;

  @Column(name = "data_type", nullable = false)
  private String dataType = "float";

  public UUID getGrowthIndicatorId() { return growthIndicatorId; }
  public String getCode() { return code; }
  public String getName() { return name; }
  public String getUnit() { return unit; }
  public String getDataType() { return dataType; }
}
