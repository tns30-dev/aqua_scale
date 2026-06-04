package com.aquashield.notification.service;

import com.aquashield.notification.domain.AlertLog;
import com.aquashield.notification.events.NotificationEventPublisher;
import com.aquashield.notification.repo.AlertLogRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
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

  private final ThresholdCache thresholds;
  private final AlertLogRepository alerts;
  private final NotificationEventPublisher events;
  private final ObjectMapper mapper;

  public AlertEngine(ThresholdCache thresholds, AlertLogRepository alerts,
                     NotificationEventPublisher events, ObjectMapper mapper) {
    this.thresholds = thresholds;
    this.alerts = alerts;
    this.events = events;
    this.mapper = mapper;
  }

  /**
   * Deliberately NOT one big transaction: each create/auto-resolve commits independently
   * (parity — the monolith's loop operations are independent and failures are swallowed
   * per-parameter). A unique-guard violation on one parameter must not poison the rest.
   */
  public void evaluate(UUID projectId, UUID pondId, JsonNode values,
                       OffsetDateTime readingTimestamp, String correlationId) {
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
