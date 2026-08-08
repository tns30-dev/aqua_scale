package com.aquashield.pond.api.dto;

import com.aquashield.pond.domain.Cycle;
import com.aquashield.pond.domain.Entities.FeedType;
import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Entities.Treatment;
import com.aquashield.pond.domain.Pond;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
      @JsonProperty("is_ongoing") boolean isOngoing,
      @JsonProperty("stocking_biomass_kg") BigDecimal stockingBiomassKg,
      @JsonProperty("harvest_biomass_kg") BigDecimal harvestBiomassKg) {

    public static CycleDto from(Cycle c, String pondName, LocalDate today) {
      return new CycleDto(c.getCycleId(), c.getPondId(), pondName, c.getStartDate(),
          c.getEndDate(), c.getStatus(), c.currentDay(today), c.durationDays(today),
          c.isOngoing(), c.getStockingBiomassKg(), c.getHarvestBiomassKg());
    }
  }

  public record StartCycleRequest(
      @JsonProperty("start_date") @NotNull LocalDate startDate,
      String status) {}

  public record UpdateCycleRequest(
      String status,
      @JsonProperty("end_date") LocalDate endDate) {}

  public record CycleBiomassRequest(
      @DecimalMin("0.00") BigDecimal stockingBiomassKg,
      @DecimalMin("0.00") BigDecimal harvestBiomassKg) {}

  /** snake_case TreatmentSerializer. */
  public record TreatmentDto(
      @JsonProperty("treatment_id") UUID treatmentId,
      @JsonProperty("project") UUID projectId,
      String code,
      String name,
      String description,
      @JsonProperty("target_parameters") List<String> targetParameters,
      @JsonProperty("unit_price") BigDecimal unitPrice,
      @JsonProperty("price_unit") String priceUnit,
      @JsonProperty("is_active") boolean isActive,
      @JsonProperty("created_at") OffsetDateTime createdAt,
      @JsonProperty("updated_at") OffsetDateTime updatedAt) {

    public static TreatmentDto from(Treatment t) {
      return new TreatmentDto(t.getTreatmentId(), t.getProjectId(), t.getCode(), t.getName(),
          t.getDescription(), jsonStringList(t.getTargetParameters()), t.getUnitPrice(),
          t.getPriceUnit(), t.isActive(), t.getCreatedAt(), t.getUpdatedAt());
    }
  }

  public record CreateTreatmentRequest(
      @NotNull @JsonProperty("project") UUID projectId,
      @NotBlank String name,
      String description,
      @NotNull @JsonProperty("target_parameters") List<String> targetParameters,
      @DecimalMin(value = "0.00", message = "Price can't be negative")
      @JsonProperty("unit_price") BigDecimal unitPrice,
      @JsonProperty("price_unit") String priceUnit,
      @JsonProperty("is_active") Boolean active) {}

  public record UpdateTreatmentRequest(
      @JsonProperty("project") UUID projectId,
      String name,
      String description,
      @JsonProperty("target_parameters") List<String> targetParameters,
      @DecimalMin(value = "0.00", message = "Price can't be negative")
      @JsonProperty("unit_price") BigDecimal unitPrice,
      @JsonProperty("price_unit") String priceUnit,
      @JsonProperty("is_active") Boolean active) {}

  /** snake_case PondTreatmentSerializer with denormalized treatment fields. */
  public record PondTreatmentDto(
      @JsonProperty("pond_treatment_id") UUID pondTreatmentId,
      UUID pond,
      UUID treatment,
      @JsonProperty("pond_id") UUID pondId,
      @JsonProperty("treatment_id") UUID treatmentId,
      @JsonProperty("treatment_code") String treatmentCode,
      @JsonProperty("treatment_name") String treatmentName,
      @JsonProperty("treatment_description") String treatmentDescription,
      @JsonProperty("started_at") LocalDate startedAt,
      @JsonProperty("ended_at") LocalDate endedAt,
      String notes,
      BigDecimal amount,
      String unit,
      @JsonProperty("unit_price") BigDecimal unitPrice,
      @JsonProperty("price_unit") String priceUnit,
      BigDecimal cost,
      @JsonProperty("is_active") boolean isActive,
      List<TreatmentCourseCycleDto> cycles,
      @JsonProperty("created_at") OffsetDateTime createdAt,
      @JsonProperty("updated_at") OffsetDateTime updatedAt) {

    public static PondTreatmentDto from(PondTreatment t) {
      return from(t, List.of());
    }

    public static PondTreatmentDto from(PondTreatment t, List<TreatmentCourseCycleDto> cycles) {
      return new PondTreatmentDto(t.getPondTreatmentId(), t.getPondId(),
          t.getTreatment().getTreatmentId(), t.getPondId(), t.getTreatment().getTreatmentId(),
          t.getTreatment().getCode(), t.getTreatment().getName(),
          t.getTreatment().getDescription(), t.getStartedAt(), t.getEndedAt(),
          t.getNotes(), t.getAmount(), t.getUnit(), t.getUnitPrice(), t.getPriceUnit(),
          courseCost(t.getAmount(), t.getUnit(), t.getUnitPrice(), t.getPriceUnit()),
          t.isActive(), cycles, t.getCreatedAt(), t.getUpdatedAt());
    }
  }

  public record TreatmentCourseCycleDto(
      @JsonProperty("cycle_id") UUID cycleId,
      String name,
      @JsonProperty("start_date") LocalDate startDate,
      @JsonProperty("end_date") LocalDate endDate) {}

  public record CreatePondTreatmentRequest(
      @NotNull @JsonProperty("pond") @JsonAlias("pond_id") UUID pondId,
      @NotNull @JsonProperty("treatment") @JsonAlias("treatment_id") UUID treatmentId,
      @NotNull @JsonProperty("started_at") LocalDate startedAt,
      @JsonProperty("ended_at") LocalDate endedAt,
      String notes,
      @DecimalMin(value = "0.001", message = "Amount must be more than zero")
      BigDecimal amount,
      String unit) {}

  public record UpdatePondTreatmentRequest(
      @JsonProperty("pond") @JsonAlias("pond_id") UUID pondId,
      @JsonProperty("treatment") @JsonAlias("treatment_id") UUID treatmentId,
      @JsonProperty("started_at") LocalDate startedAt,
      @JsonProperty("ended_at") LocalDate endedAt,
      String notes,
      @DecimalMin(value = "0.001", message = "Amount must be more than zero")
      BigDecimal amount,
      String unit) {}

  /** snake_case FeedTypeSerializer shape. */
  public record FeedTypeRecordDto(
      @JsonProperty("feed_type_id") UUID feedTypeId,
      @JsonProperty("project") UUID projectId,
      String name,
      @JsonProperty("pack_kg") BigDecimal packKg,
      @JsonProperty("pack_price") BigDecimal packPrice,
      String currency,
      boolean active,
      @JsonProperty("created_at") OffsetDateTime createdAt,
      @JsonProperty("updated_at") OffsetDateTime updatedAt) {

    public static FeedTypeRecordDto from(FeedType ft) {
      return new FeedTypeRecordDto(ft.getFeedTypeId(), ft.getProjectId(), ft.getName(),
          ft.getPackKg(), ft.getPackPrice(), ft.getCurrency(), ft.isActive(),
          ft.getCreatedAt(), ft.getUpdatedAt());
    }
  }

  public record CreateFeedTypeRequest(
      @NotNull @JsonProperty("project") UUID projectId,
      @NotBlank String name,
      @NotNull @DecimalMin(value = "0.01", message = "Pack size must be more than 0 kg")
      @JsonProperty("pack_kg") BigDecimal packKg,
      @NotNull @DecimalMin(value = "0.00", message = "Pack price can't be negative")
      @JsonProperty("pack_price") BigDecimal packPrice,
      String currency) {}

  public record UpdateFeedTypeRequest(
      String name,
      @DecimalMin(value = "0.01", message = "Pack size must be more than 0 kg")
      @JsonProperty("pack_kg") BigDecimal packKg,
      @DecimalMin(value = "0.00", message = "Pack price can't be negative")
      @JsonProperty("pack_price") BigDecimal packPrice,
      String currency,
      Boolean active) {}

  public record FeedEntryWrite(
      UUID feedLogId,
      @NotNull UUID feedTypeId,
      @NotNull @DecimalMin("0.01") BigDecimal amountKg,
      LocalTime fedTime) {}

  public record FeedDayWriteRequest(@NotNull @Valid List<FeedEntryWrite> entries) {}

  private static List<String> jsonStringList(JsonNode node) {
    if (node == null || !node.isArray()) {
      return List.of();
    }
    List<String> out = new ArrayList<>();
    node.forEach(item -> {
      if (item.isTextual() && !item.asText().isBlank()) {
        out.add(item.asText());
      }
    });
    return out;
  }

  private static BigDecimal courseCost(BigDecimal amount, String unit, BigDecimal unitPrice,
                                       String priceUnit) {
    if (amount == null || unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
      return null;
    }
    BigDecimal factor = unitFactor(unit, priceUnit);
    if (factor == null) {
      return null;
    }
    return amount.multiply(factor).multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);
  }

  private static BigDecimal unitFactor(String unit, String priceUnit) {
    Map<String, BigDecimal> mass = Map.of("g", new BigDecimal("0.001"), "kg", BigDecimal.ONE);
    Map<String, BigDecimal> volume = Map.of("ml", new BigDecimal("0.001"), "l", BigDecimal.ONE);
    return switch (priceUnit == null ? "" : priceUnit) {
      case "kg" -> mass.get(unit);
      case "l" -> volume.get(unit);
      default -> null;
    };
  }
}
