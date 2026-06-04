package com.aquashield.pond.api.dto;

import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Entities.Treatment;
import com.aquashield.pond.domain.Pond;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PARITY casing is PER-ENDPOINT: pond/cycle/treatment LIST serializers are snake_case;
 * /cycles/{id}/details and pond-comparison are camelCase (built as raw maps in services).
 */
public final class PondDtos {

  private PondDtos() {}

  /** snake_case PondSerializer shape + photo_url (DDL truth, monolith dropped it). */
  public record PondDto(
      @JsonProperty("pond_id") UUID pondId,
      String name,
      String description,
      JsonNode metadata,
      @JsonProperty("project_id") UUID projectId,
      @JsonProperty("project_name") String projectName,
      @JsonProperty("profile_type") String profileType,
      String status,
      @JsonProperty("photo_url") String photoUrl,
      @JsonProperty("is_active") boolean isActive,
      @JsonProperty("created_at") OffsetDateTime createdAt,
      @JsonProperty("updated_at") OffsetDateTime updatedAt) {

    public static PondDto from(Pond p, String projectName, String profileType) {
      return new PondDto(p.getPondId(), p.getName(), p.getDescription(), p.getMetadata(),
          p.getProjectId(), projectName, profileType, p.getStatus(), p.getPhotoUrl(),
          p.isActive(), p.getCreatedAt(), p.getUpdatedAt());
    }
  }

  public record CreatePondRequest(
      @NotBlank String name,
      String description,
      JsonNode metadata,
      String status,
      @JsonProperty("photo_url") String photoUrl) {}

  public record UpdatePondRequest(
      String name, String description, JsonNode metadata, String status,
      @JsonProperty("photo_url") String photoUrl) {}

  /** snake_case CycleSerializer shape (current_day/duration_days/is_ongoing computed). */
  public record CycleDto(
      @JsonProperty("cycle_id") UUID cycleId,
      @JsonProperty("pond_id") UUID pondId,
      @JsonProperty("pond_name") String pondName,
      @JsonProperty("start_date") LocalDate startDate,
      @JsonProperty("end_date") LocalDate endDate,
      String status,
      @JsonProperty("current_day") int currentDay,
      @JsonProperty("duration_days") int durationDays,
      @JsonProperty("is_ongoing") boolean isOngoing) {

    public static CycleDto from(Cycle c, String pondName, LocalDate today) {
      return new CycleDto(c.getCycleId(), c.getPondId(), pondName, c.getStartDate(),
          c.getEndDate(), c.getStatus(), c.currentDay(today), c.durationDays(today),
          c.isOngoing());
    }
  }

  public record StartCycleRequest(
      @JsonProperty("start_date") @NotNull LocalDate startDate,
      String status) {}

  public record UpdateCycleRequest(
      String status,
      @JsonProperty("end_date") LocalDate endDate) {}

  /** snake_case TreatmentSerializer (PARITY: bare array, global, no RBAC). */
  public record TreatmentDto(
      @JsonProperty("treatment_id") UUID treatmentId,
      String code,
      String name,
      String description,
      @JsonProperty("is_active") boolean isActive) {

    public static TreatmentDto from(Treatment t) {
      return new TreatmentDto(t.getTreatmentId(), t.getCode(), t.getName(),
          t.getDescription(), t.isActive());
    }
  }

  /** snake_case PondTreatmentSerializer with denormalized treatment fields. */
  public record PondTreatmentDto(
      @JsonProperty("pond_treatment_id") UUID pondTreatmentId,
      @JsonProperty("pond_id") UUID pondId,
      @JsonProperty("treatment_id") UUID treatmentId,
      @JsonProperty("treatment_code") String treatmentCode,
      @JsonProperty("treatment_name") String treatmentName,
      @JsonProperty("treatment_description") String treatmentDescription,
      @JsonProperty("started_at") LocalDate startedAt,
      @JsonProperty("ended_at") LocalDate endedAt,
      String notes,
      @JsonProperty("is_active") boolean isActive) {

    public static PondTreatmentDto from(PondTreatment t) {
      return new PondTreatmentDto(null, t.getPondId(), t.getTreatment().getTreatmentId(),
          t.getTreatment().getCode(), t.getTreatment().getName(),
          t.getTreatment().getDescription(), t.getStartedAt(), t.getEndedAt(),
          t.getNotes(), t.isActive());
    }
  }
}
