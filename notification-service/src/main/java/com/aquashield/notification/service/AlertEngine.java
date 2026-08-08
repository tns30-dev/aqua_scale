package com.aquashield.notification.service;

import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.ReadingRow;
import com.aquashield.api.project.v1.EnergySettings;
import com.aquashield.api.project.v1.GetEnergySettingsRequest;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.notification.domain.AlertLog;
import com.aquashield.notification.events.NotificationEventPublisher;
import com.aquashield.notification.repo.AlertLogRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;

/**
 * EXACT port of the monolith ThresholdService._check_thresholds
 * (module_data_ingestion/services.py:153-272). Parity rules, all oracle-pinned:
 *  - skip null/non-numeric values and parameters without thresholds
 *  - MAX checked first and WINS (if/elif): value > max -> critical; value < min -> warning
 *  - comparisons are STRICT — boundary equality is within range
 *  - NULL side never breaches (both NULL -> can never alert)
 *  - dedup key = (pond, parameter_code, active); severity NOT in the key (no escalation);
 *    acknowledged rows are invisible to dedup AND auto-resolve (oracle 14)
 *  - within range -> bulk auto-resolve active rows (resolved=true; + resolved_at, our
 *    documented improvement); monolith emitted no event — alert.resolved is new-arch
 *  - EXACT message strings: "{code} exceeded maximum: {v} > {max}" / "{code} below
 *    minimum: {v} < {min}" with Python float rendering of thresholds (30.0)
 *  - log_type mapping: critical->alert, warning->warning
 */
@Service
public class AlertEngine {

  private static final Logger log = LoggerFactory.getLogger(AlertEngine.class);
  static final String ENERGY_HOURLY_PARAM = "electricity_hourly";
  static final String ENERGY_DAILY_PARAM = "electricity_daily";

  private final ThresholdCache thresholds;
  private final AlertLogRepository alerts;
  private final NotificationEventPublisher events;
  private final ObjectMapper mapper;
  private final ProjectServiceGrpc.ProjectServiceBlockingStub projectStub;
  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub;
  private final ZoneId zone;

  public AlertEngine(ThresholdCache thresholds, AlertLogRepository alerts,
                     NotificationEventPublisher events, ObjectMapper mapper,
                     ProjectServiceGrpc.ProjectServiceBlockingStub projectStub,
                     IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub,
                     @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.thresholds = thresholds;
    this.alerts = alerts;
    this.events = events;
    this.mapper = mapper;
    this.projectStub = projectStub;
    this.ingestionStub = ingestionStub;
    this.zone = ZoneId.of(timezone);
  }

  /**
   * Deliberately NOT one big transaction: each create/auto-resolve commits independently
   * (parity — the monolith's loop operations are independent and failures are swallowed
   * per-parameter). A unique-guard violation on one parameter must not poison the rest.
   */
  public void evaluate(UUID projectId, UUID pondId, JsonNode values,
                       OffsetDateTime readingTimestamp, String correlationId) {
    if (pondId == null) {
      evaluateEnergy(projectId, values, readingTimestamp, correlationId);
      return;
    }
    Map<String, ThresholdCache.Threshold> map = thresholds.forProject(projectId);
    values.properties().forEach(entry -> {
      String code = entry.getKey();
      JsonNode valueNode = entry.getValue();
      if (valueNode == null || !valueNode.isNumber()) {
        return; // parity: null / non-numeric skipped
      }
      ThresholdCache.Threshold t = map.get(code);
      if (t == null) {
        return; // parity: no threshold configured -> skipped entirely
      }
      double value = valueNode.asDouble();
      String severity = null;
      double thresholdValue = 0;
      String message = null;
      if (t.hasMax() && value > t.max()) {                 // max first — and WINS
        severity = "critical";
        thresholdValue = t.max();
        message = code + " exceeded maximum: " + num(valueNode) + " > " + pyFloat(t.max());
      } else if (t.hasMin() && value < t.min()) {
        severity = "warning";
        thresholdValue = t.min();
        message = code + " below minimum: " + num(valueNode) + " < " + pyFloat(t.min());
      }

      if (severity != null) {
        createIfNoActive(projectId, pondId, code, severity, message, thresholdValue,
            valueNode, readingTimestamp, correlationId);
      } else {
        int resolvedCount = alerts.autoResolve(pondId, code, OffsetDateTime.now());
        if (resolvedCount > 0) {
          // NEW-ARCH event (no monolith analog): lets Realtime clear banners
          events.publish(NotificationEventPublisher.TOPIC_ALERT_RESOLVED, correlationId,
              projectId.toString(), pondId.toString(),
              mapper.createObjectNode().put("parameter", code)
                  .put("resolvedCount", resolvedCount));
        }
      }
    });
  }

  private void evaluateEnergy(UUID projectId, JsonNode values,
                              OffsetDateTime readingTimestamp, String correlationId) {
    JsonNode electricity = values == null ? null : values.get("electricity");
    if (electricity == null || !electricity.isNumber()) {
      return;
    }
    double kwh = electricity.asDouble();
    EnergySettings settings = projectStub.getEnergySettings(GetEnergySettingsRequest.newBuilder()
        .setProjectId(projectId.toString())
        .setType("electricity")
        .build());
    String unit = settings.getUnit().isBlank() ? "kWh" : settings.getUnit();

    if (settings.getHasHighHourlyThreshold()) {
      double threshold = settings.getHighHourlyThreshold();
      if (kwh > threshold) {
        AlertLog row = openEnergyAlert(projectId, ENERGY_HOURLY_PARAM, readingTimestamp,
            "Electricity hourly consumption exceeded threshold");
        if (row != null) {
          publishEnergy(row, projectId, kwh, threshold, correlationId);
        }
      } else {
        publishEnergyResolved(projectId, ENERGY_HOURLY_PARAM, correlationId,
            alerts.autoResolveEnergy(projectId, ENERGY_HOURLY_PARAM, OffsetDateTime.now()));
      }
    }

    if (settings.getHasHighDailyThreshold()) {
      double threshold = settings.getHighDailyThreshold();
      double total = dayTotal(projectId, readingTimestamp);
      if (total > threshold) {
        OffsetDateTime local = readingTimestamp.atZoneSameInstant(zone).toOffsetDateTime();
        String message = "Electricity daily consumption exceeded threshold: "
            + formatNumber(total) + " " + unit + " > " + formatNumber(threshold) + " "
            + unit + " (" + local.format(java.time.format.DateTimeFormatter.ofPattern("MMM dd",
                java.util.Locale.ENGLISH)) + ")";
        AlertLog row = upsertDailyEnergyAlert(projectId, local, readingTimestamp, message);
        if (row != null) {
          publishEnergy(row, projectId, total, threshold, correlationId);
        }
      } else {
        publishEnergyResolved(projectId, ENERGY_DAILY_PARAM, correlationId,
            alerts.autoResolveEnergy(projectId, ENERGY_DAILY_PARAM, OffsetDateTime.now()));
      }
    }
  }

  private void createIfNoActive(UUID projectId, UUID pondId, String code, String severity,
                                  String message, double thresholdValue, JsonNode valueNode,
                                  OffsetDateTime readingTimestamp, String correlationId) {
    // parity dedup (active rows only) + our UNIQUE guard closing the concurrency race
    if (alerts.existsByPondIdAndParameterAndAcknowledgedFalseAndResolvedFalse(pondId, code)) {
      log.debug("Dedup: active alert exists pond={} parameter={}", pondId, code);
      return;
    }
    String logType = "critical".equals(severity) ? "alert" : "warning"; // parity mapping
    AlertLog alert = new AlertLog(projectId, pondId, logType, message, severity, code,
        readingTimestamp);
    try {
      alert = alerts.save(alert);
    } catch (DataIntegrityViolationException e) {
      log.debug("Dedup (unique guard): concurrent active alert pond={} parameter={}", pondId, code);
      return;
    }

    // events: threshold.violated + alert.created carry the monolith broadcast-dict shape
    ObjectNode payload = mapper.createObjectNode()
        .put("log_id", alert.getLogId().toString())
        .put("project_id", projectId.toString())
        .put("pond_id", pondId.toString())
        .put("parameter", code)
        .put("severity", severity)
        .put("message", message)
        .put("threshold", thresholdValue)
        .put("timestamp", readingTimestamp.toString())
        .put("log_type", logType);
    payload.set("current_value", valueNode);
    events.publish(NotificationEventPublisher.TOPIC_THRESHOLD_VIOLATED, correlationId,
        projectId.toString(), pondId.toString(), payload);
    events.publish(NotificationEventPublisher.TOPIC_ALERT_CREATED, correlationId,
        projectId.toString(), pondId.toString(), payload);
    events.publish(NotificationEventPublisher.TOPIC_NOTIFICATION_REQUESTED, correlationId,
        projectId.toString(), pondId.toString(), payload);
  }

  private AlertLog openEnergyAlert(UUID projectId, String parameter,
                                   OffsetDateTime readingTimestamp, String message) {
    if (alerts.existsByProjectIdAndPondIdIsNullAndParameterAndAcknowledgedFalseAndResolvedFalse(
        projectId, parameter)) {
      log.debug("Dedup: active energy alert exists project={} parameter={}", projectId, parameter);
      return null;
    }
    AlertLog alert = new AlertLog(projectId, null, "alert", message, "critical", parameter,
        readingTimestamp);
    try {
      return alerts.save(alert);
    } catch (DataIntegrityViolationException e) {
      log.debug("Dedup (unique guard): concurrent active energy alert project={} parameter={}",
          projectId, parameter);
      return null;
    }
  }

  private AlertLog upsertDailyEnergyAlert(UUID projectId, OffsetDateTime local,
                                          OffsetDateTime readingTimestamp, String message) {
    OffsetDateTime dayStart = local.toLocalDate().atStartOfDay(zone).toOffsetDateTime();
    OffsetDateTime dayEnd = dayStart.plusDays(1);
    java.util.Optional<AlertLog> existing = alerts
        .findFirstByProjectIdAndPondIdIsNullAndParameterAndReadingTimestampGreaterThanEqualAndReadingTimestampLessThan(
            projectId, ENERGY_DAILY_PARAM, dayStart, dayEnd);
    if (existing.isPresent()) {
      AlertLog row = existing.get();
      if (!row.isAcknowledged()) {
        row.setMessage(message);
        alerts.save(row);
      }
      return null;
    }

    AlertLog alert = new AlertLog(projectId, null, "alert", message, "critical",
        ENERGY_DAILY_PARAM, readingTimestamp);
    try {
      return alerts.save(alert);
    } catch (DataIntegrityViolationException e) {
      log.debug("Dedup (unique guard): concurrent daily energy alert project={}", projectId);
      return null;
    }
  }

  private double dayTotal(UUID projectId, OffsetDateTime readingTimestamp) {
    LocalDate day = readingTimestamp.atZoneSameInstant(zone).toLocalDate();
    String start = day.atStartOfDay(zone).toInstant().toString();
    String end = day.plusDays(1).atStartOfDay(zone).minusNanos(1).toInstant().toString();
    double total = 0;
    for (ReadingRow row : ingestionStub.getReadings(GetReadingsRequest.newBuilder()
        .setProjectId(projectId.toString())
        .setStart(start)
        .setEnd(end)
        .addParameters("electricity")
        .setLimit(50000)
        .build()).getRowsList()) {
      Double value = row.getValuesMap().get("electricity");
      if (value != null) {
        total += value;
      }
    }
    return total;
  }

  private void publishEnergy(AlertLog alert, UUID projectId, double value, double threshold,
                             String correlationId) {
    ObjectNode payload = mapper.createObjectNode()
        .put("log_id", alert.getLogId().toString())
        .put("project_id", projectId.toString())
        .putNull("pond_id")
        .put("pond_name", "Project")
        .put("parameter", alert.getParameter())
        .put("severity", alert.getSeverity())
        .put("message", alert.getMessage())
        .put("current_value", round(value, 3))
        .put("threshold", threshold)
        .put("timestamp", alert.getReadingTimestamp().toString())
        .put("log_type", alert.getLogType());
    events.publish(NotificationEventPublisher.TOPIC_ALERT_CREATED, correlationId,
        projectId.toString(), null, payload);
    events.publish(NotificationEventPublisher.TOPIC_NOTIFICATION_REQUESTED, correlationId,
        projectId.toString(), null, payload);
  }

  private void publishEnergyResolved(UUID projectId, String parameter, String correlationId,
                                     int resolvedCount) {
    if (resolvedCount <= 0) {
      return;
    }
    events.publish(NotificationEventPublisher.TOPIC_ALERT_RESOLVED, correlationId,
        projectId.toString(), null,
        mapper.createObjectNode().put("parameter", parameter)
            .put("resolvedCount", resolvedCount));
  }

  private static double round(double value, int digits) {
    double factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
  }

  private static String formatNumber(double value) {
    if (value == Math.floor(value) && !Double.isInfinite(value)) {
      return String.valueOf((long) value);
    }
    return String.valueOf(round(value, 3));
  }

  /** Python float rendering for thresholds: 30 -> "30.0", 6.5 -> "6.5" (parity strings). */
  static String pyFloat(double v) {
    if (v == Math.floor(v) && !Double.isInfinite(v)) {
      return (long) v + ".0";
    }
    return String.valueOf(v);
  }

  /** Reading values keep their JSON textual form (31 -> "31", 7.25 -> "7.25"). */
  static String num(JsonNode node) {
    return node.asText();
  }
}
