package com.aquashield.project.api.dto;

import com.aquashield.project.domain.ParameterType;
import com.aquashield.project.domain.ProfileType;
import com.aquashield.project.domain.Project;
import com.aquashield.project.domain.ProjectEnergySetting;
import com.aquashield.project.domain.ProjectParameterSetting;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * API contract. PARITY — CASING IS PER-ENDPOINT and must not be normalized:
 *  snake_case: /api/profile-types, /api/parameter-types, /api/growth-indicators,
 *              /api/projects (list/detail), parameter-settings
 *  camelCase:  /api/projects/all, energy settings + dashboard
 * stage_config is passed through VERBATIM (inner keys stay camelCase by design);
 * key_* arrays serialize as null when unset (frontend coerces) — never as [].
 */
public final class ProjectDtos {

  private ProjectDtos() {}

  // ---------- catalogues (snake_case) ----------

  public record ProfileTypeDto(
      @JsonProperty("profile_type_id") UUID profileTypeId,
      String code,
      String name,
      String description,
      @JsonProperty("stage_config") JsonNode stageConfig,
      @JsonProperty("key_parameter_indicators") List<String> keyParameterIndicators,
      @JsonProperty("key_growth_indicators") List<String> keyGrowthIndicators,
      JsonNode theme) {

    public static ProfileTypeDto from(ProfileType p) {
      return new ProfileTypeDto(p.getProfileTypeId(), p.getCode(), p.getName(),
          p.getDescription(), p.getStageConfig(), p.getKeyParameterIndicators(),
          p.getKeyGrowthIndicators(), p.getTheme());
    }
  }

  public record ParameterTypeDto(
      @JsonProperty("parameter_id") UUID parameterId,
      @JsonProperty("parameter_name") String parameterName,
      @JsonProperty("parameter_code") String parameterCode,
      String unit,
      @JsonProperty("data_type") String dataType) {

    public static ParameterTypeDto from(ParameterType p) {
      return new ParameterTypeDto(p.getParameterId(), p.getParameterName(),
          p.getParameterCode(), p.getUnit(), p.getDataType());
    }
  }

  public record GrowthIndicatorDto(
      @JsonProperty("growth_indicator_id") UUID growthIndicatorId,
      String code,
      String name,
      String unit,
      @JsonProperty("data_type") String dataType) {}

  // ---------- projects ----------

  /** snake_case list/detail shape (nested profile type, newest first). */
  public record ProjectDto(
      @JsonProperty("project_id") UUID projectId,
      String name,
      String description,
      @JsonProperty("profile_type") ProfileTypeDto profileType,
      @JsonProperty("owner_user_id") UUID ownerUserId,   // divergence: owner_email lives in Identity now
      @JsonProperty("created_at") OffsetDateTime createdAt,
      @JsonProperty("updated_at") OffsetDateTime updatedAt) {

    public static ProjectDto from(Project p) {
      return new ProjectDto(p.getProjectId(), p.getName(), p.getDescription(),
          ProfileTypeDto.from(p.getProfileType()), p.getOwnerUserId(),
          p.getCreatedAt(), p.getUpdatedAt());
    }
  }

  /** PARITY: /api/projects/all is camelCase + flat (admin view). */
  public record ProjectAdminItem(
      UUID projectId,
      String name,
      UUID profileTypeId,
      String profileType) {

    public static ProjectAdminItem from(Project p) {
      return new ProjectAdminItem(p.getProjectId(), p.getName(),
          p.getProfileType().getProfileTypeId(), p.getProfileType().getCode());
    }
  }

  /** NET-NEW (no monolith write API): platform-admin only. */
  public record CreateProjectRequest(
      @NotBlank String name,
      String description,
      @NotNull UUID profileTypeId,
      UUID ownerUserId) {}

  public record UpdateProjectRequest(String name, String description) {}

  // ---------- parameter settings (snake_case, per monolith serializer shape) ----------

  public record ParameterSettingDto(
      @JsonProperty("parameter_code") String parameterCode,
      @JsonProperty("parameter_name") String parameterName,
      @JsonProperty("parameter_unit") String parameterUnit,
      @JsonProperty("min_threshold") Double minThreshold,
      @JsonProperty("max_threshold") Double maxThreshold,
      @JsonProperty("is_key_parameter") boolean isKeyParameter) {

    public static ParameterSettingDto from(ProjectParameterSetting s) {
      return new ParameterSettingDto(s.getParameter().getParameterCode(),
          s.getParameter().getParameterName(), s.getParameter().getUnit(),
          s.getMinThreshold(), s.getMaxThreshold(), s.isKeyParameter());
    }
  }

  public record PutParameterSettingItem(
      @JsonProperty("parameter_code") @NotBlank String parameterCode,
      @JsonProperty("min_threshold") Double minThreshold,
      @JsonProperty("max_threshold") Double maxThreshold,
      @JsonProperty("is_key_parameter") Boolean isKeyParameter) {}

  // ---------- energy (camelCase) ----------

  public record EnergySettingsDto(
      String type,
      String unit,
      double tariffPerUnit,
      String currency,
      BigDecimal highHourlyThreshold,
      BigDecimal highDailyThreshold,
      boolean manualEntryEnabled,
      String notes,
      boolean exists) {

    /** PARITY (settings_dict): defaults when no row exists. */
    public static EnergySettingsDto defaults(String type) {
      return new EnergySettingsDto(type, "kWh", 0.0, "USD", null, null, true, null, false);
    }

    public static EnergySettingsDto from(ProjectEnergySetting s) {
      return new EnergySettingsDto(s.getType(), s.getUnit(),
          s.getTariffPerUnit().doubleValue(), s.getCurrency(), s.getHighHourlyThreshold(),
          s.getHighDailyThreshold(), s.isManualEntryEnabled(), s.getNotes(), true);
    }
  }

  /** PARITY: merge-upsert — only provided keys are written. */
  public record PutEnergySettingsRequest(
      String unit,
      BigDecimal tariffPerUnit,
      String currency,
      BigDecimal highHourlyThreshold,
      BigDecimal highDailyThreshold,
      Boolean manualEntryEnabled,
      String notes) {}
}
