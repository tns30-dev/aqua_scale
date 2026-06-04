package com.aquashield.project.service;

import com.aquashield.project.api.dto.ProjectDtos.EnergySettingsDto;
import com.aquashield.project.api.dto.ProjectDtos.PutEnergySettingsRequest;
import com.aquashield.project.domain.ProjectEnergySetting;
import com.aquashield.project.repo.Repositories.ProjectEnergySettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Energy settings + dashboard (spec: main/project_service.md; parity: energy_dashboard.py).
 *
 * PARITY (settings): merge-upsert by (project, type) — only provided keys written;
 * created_by/updated_by = acting user; defaults dict with exists:false when no row.
 *
 * DIVERGENCE-IN-TRANSITION (dashboard): the monolith computed from sensor_readings
 * directly. Telemetry now belongs to Ingestion (Bigtable) — until that read path exists,
 * the dashboard returns the parity SHAPE with zero-data semantics (oracle: totals 0,
 * '—' labels), keeping the frontend contract stable. Tracked in services_tracker.
 */
@Service
public class EnergyService {

  private static final Set<String> GROUP_BY = Set.of("hour", "day", "week", "month");
  private static final Map<String, String> CURRENCY_SYMBOLS =
      Map.of("USD", "$", "EUR", "€", "GBP", "£", "MMK", "K", "THB", "฿", "SGD", "S$");

  private final ProjectEnergySettingRepository energySettings;

  public EnergyService(ProjectEnergySettingRepository energySettings) {
    this.energySettings = energySettings;
  }

  @Transactional(readOnly = true)
  public EnergySettingsDto getSettings(UUID projectId, String type) {
    return energySettings.findByProjectIdAndType(projectId, type)
        .map(EnergySettingsDto::from)
        .orElseGet(() -> EnergySettingsDto.defaults(type));
  }

  @Transactional
  public EnergySettingsDto putSettings(UUID projectId, String type,
                                       PutEnergySettingsRequest req, UUID actingUserId) {
    ProjectEnergySetting setting = energySettings.findByProjectIdAndType(projectId, type)
        .orElseGet(() -> new ProjectEnergySetting(projectId, type, actingUserId));
    // PARITY: merge — only keys present in the body are written
    if (req.unit() != null) {
      setting.setUnit(req.unit());
    }
    if (req.tariffPerUnit() != null) {
      setting.setTariffPerUnit(req.tariffPerUnit());
    }
    if (req.currency() != null) {
      setting.setCurrency(req.currency());
    }
    if (req.highHourlyThreshold() != null) {
      setting.setHighHourlyThreshold(req.highHourlyThreshold());
    }
    if (req.highDailyThreshold() != null) {
      setting.setHighDailyThreshold(req.highDailyThreshold());
    }
    if (req.manualEntryEnabled() != null) {
      setting.setManualEntryEnabled(req.manualEntryEnabled());
    }
    if (req.notes() != null) {
      setting.setNotes(req.notes());
    }
    setting.setUpdatedBy(actingUserId);
    return EnergySettingsDto.from(energySettings.save(setting));
  }

  /** Validates query params with parity 400s, then returns the zero-data dashboard shape. */
  @Transactional(readOnly = true)
  public Map<String, Object> dashboard(UUID projectId, String groupBy,
                                       String startDate, String endDate) {
    if (!GROUP_BY.contains(groupBy)) {
      throw new ProjectAppService.BadRequestException(
          "Invalid groupBy. Must be one of: hour, day, week, month");
    }
    LocalDate end = parseDate(endDate, LocalDate.now());
    LocalDate start = parseDate(startDate, end.minusDays(6));
    if (end.isBefore(start)) {
      throw new ProjectAppService.BadRequestException("endDate must be on or after startDate");
    }

    EnergySettingsDto settings = getSettings(projectId, "electricity");
    String symbol = CURRENCY_SYMBOLS.getOrDefault(settings.currency(), settings.currency());
    DateTimeFormatter label = DateTimeFormatter.ofPattern("MMM d");

    Map<String, Object> kpis = new LinkedHashMap<>();
    kpis.put("totalKwh", 0.0);
    kpis.put("estimatedCost", 0.0);
    kpis.put("currency", settings.currency());
    kpis.put("currencySymbol", symbol);
    kpis.put("tariffPerUnit", settings.tariffPerUnit());
    kpis.put("changeVsPreviousPct", 0.0);
    kpis.put("costChange", 0.0);
    kpis.put("avgDailyKwh", 0.0);
    kpis.put("peakHourLabel", "—");
    kpis.put("peakHourKwh", 0.0);
    kpis.put("highHourlyThreshold", settings.highHourlyThreshold());
    kpis.put("highDailyThreshold", settings.highDailyThreshold());

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("lastUpdated", "—");
    body.put("dateRangeLabel", label.format(start) + " – " + label.format(end));
    body.put("kpis", kpis);
    body.put("trend", List.of());
    body.put("trendCurrentLabel", "Current period");
    body.put("trendPreviousLabel", "Previous period");
    body.put("heatmap", Map.of("dateLabels", List.of(), "hourLabels", List.of(),
        "matrix", List.of(), "maxValue", 0.0));
    body.put("summary", List.of());
    body.put("byPeriod", Map.of("title", "By " + groupBy, "rows", List.of()));
    body.put("alerts", List.of());
    body.put("dataQuality", Map.of("completenessPct", 0.0, "lastReceived", "—",
        "source", "Energy Meter"));
    body.put("compareInfo", "vs previous " + (start.until(end).getDays() + 1) + " days");
    return body;
  }

  private static LocalDate parseDate(String value, LocalDate fallback) {
    if (value == null || value.isBlank()) {
      return fallback;
    }
    try {
      return LocalDate.parse(value);
    } catch (Exception e) {
      throw new ProjectAppService.BadRequestException("Invalid date format. Use YYYY-MM-DD");
    }
  }
}
