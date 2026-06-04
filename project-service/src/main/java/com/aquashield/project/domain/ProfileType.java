package com.aquashield.project.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * PARITY (module_project.ProfileType): stage_config supports BOTH shapes — a plain list
 * of stages, or {"stages":[...],"cycleLengthDays":N}; inner keys are camelCase
 * (startDay/endDay) by design. theme JSONB: {"primary","gradient":{"from","to"}}.
 * key_* arrays may be NULL (serialize as null, not [] — frontend coerces).
 */
@Entity
@Table(name = "profile_types")
public class ProfileType {

  @Id
  @GeneratedValue
  @Column(name = "profile_type_id")
  private UUID profileTypeId;

  @Column(nullable = false, unique = true)
  private String name;

  @Column(unique = true)
  private String code;

  @Column(columnDefinition = "text")
  private String description;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "stage_config")
  private JsonNode stageConfig;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(name = "key_parameter_indicators", columnDefinition = "text[]")
  private List<String> keyParameterIndicators;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(name = "key_growth_indicators", columnDefinition = "text[]")
  private List<String> keyGrowthIndicators;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private JsonNode theme;

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

  /** PARITY (get_stages): null→[]; list→as-is; {"stages":[...]}→inner list; else []. */
  public List<JsonNode> getStages() {
    if (stageConfig == null || stageConfig.isNull()) {
      return List.of();
    }
    JsonNode source = stageConfig.isArray() ? stageConfig
        : (stageConfig.isObject() && stageConfig.path("stages").isArray()
            ? stageConfig.get("stages") : null);
    if (source == null) {
      return List.of();
    }
    List<JsonNode> stages = new ArrayList<>();
    source.forEach(stages::add);
    return stages;
  }

  /** PARITY (get_stage_by_day): first stage with startDay <= day <= endDay; null-bound stages skipped. */
  public JsonNode getStageByDay(int day) {
    for (JsonNode stage : getStages()) {
      JsonNode start = stage.get("startDay");
      JsonNode end = stage.get("endDay");
      if (start == null || end == null || !start.canConvertToInt() || !end.canConvertToInt()) {
        continue;
      }
      if (start.asInt() <= day && day <= end.asInt()) {
        return stage;
      }
    }
    return null;
  }

  /** PARITY (get_cycle_length): max endDay across stages, else 0. */
  public int getCycleLength() {
    int max = 0;
    for (JsonNode stage : getStages()) {
      JsonNode end = stage.get("endDay");
      if (end != null && end.canConvertToInt()) {
        max = Math.max(max, end.asInt());
      }
    }
    return max;
  }

  // --- accessors ---
  public UUID getProfileTypeId() { return profileTypeId; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getCode() { return code; }
  public void setCode(String code) { this.code = code; }
  public String getDescription() { return description; }
  public JsonNode getStageConfig() { return stageConfig; }
  public void setStageConfig(JsonNode stageConfig) { this.stageConfig = stageConfig; }
  public List<String> getKeyParameterIndicators() { return keyParameterIndicators; }
  public List<String> getKeyGrowthIndicators() { return keyGrowthIndicators; }
  public JsonNode getTheme() { return theme; }
  public void setTheme(JsonNode theme) { this.theme = theme; }
}
