package com.aquashield.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.UUID;

/**
 * PARITY (module_chart.VisualisationType, managed=False → DDL authoritative).
 * `name` is the chart engine's case-sensitive dispatch key — e.g. "Multi-Parameter
 * Trends" — and must match the monolith strings exactly.
 */
@Entity
@Table(name = "visualisation_types")
public class VisualisationType {

  @Id
  @GeneratedValue
  @Column(name = "visualisation_type_id")
  private UUID visualisationTypeId;

  @Column(nullable = false)
  private String name;

  @Column
  private String description;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(name = "required_parameters", columnDefinition = "uuid[]")
  private List<UUID> requiredParameters;

  @Column(name = "chart_type")
  private String chartType;

  public UUID getVisualisationTypeId() { return visualisationTypeId; }
  public String getName() { return name; }
  public String getDescription() { return description; }
  public List<UUID> getRequiredParameters() { return requiredParameters; }
  public String getChartType() { return chartType; }
}
