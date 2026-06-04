package com.aquashield.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.UUID;

/**
 * PARITY (module_chart.ProjectVisualisation, managed=False → DDL authoritative).
 * The chart engine consults ONLY `enabled` (which charts appear) and `y_parameters`
 * (multi/historical parameter selection); flag/x_parameters/title are stored but
 * unused by the historical-charts path — preserved for DDL parity.
 */
@Entity
@Table(name = "project_visualisations")
public class ProjectVisualisation {

  @Id
  @GeneratedValue
  @Column(name = "project_visualisation_id")
  private UUID projectVisualisationId;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "visualisation_type_id")
  private VisualisationType visualisationType;

  @Column(nullable = false)
  private boolean enabled = true;

  @Column
  private Integer flag;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(name = "x_parameters", columnDefinition = "uuid[]")
  private List<UUID> xParameters;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(name = "y_parameters", columnDefinition = "uuid[]")
  private List<UUID> yParameters;

  @Column
  private String title;

  public UUID getProjectVisualisationId() { return projectVisualisationId; }
  public UUID getProjectId() { return projectId; }
  public VisualisationType getVisualisationType() { return visualisationType; }
  public boolean isEnabled() { return enabled; }
  public Integer getFlag() { return flag; }
  public List<UUID> getXParameters() { return xParameters; }
  public List<UUID> getYParameters() { return yParameters; }
  public String getTitle() { return title; }

  public void setProjectId(UUID projectId) { this.projectId = projectId; }
  public void setVisualisationType(VisualisationType visualisationType) { this.visualisationType = visualisationType; }
  public void setEnabled(boolean enabled) { this.enabled = enabled; }
  public void setFlag(Integer flag) { this.flag = flag; }
  public void setXParameters(List<UUID> xParameters) { this.xParameters = xParameters; }
  public void setYParameters(List<UUID> yParameters) { this.yParameters = yParameters; }
  public void setTitle(String title) { this.title = title; }
}
