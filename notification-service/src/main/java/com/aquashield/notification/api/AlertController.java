package com.aquashield.notification.api;

import com.aquashield.notification.config.SnapshotAuthFilter.SnapshotPrincipal;
import com.aquashield.notification.domain.AlertLog;
import com.aquashield.notification.repo.AlertLogRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * PARITY REST: GET /api/alerts (camelCase hand-built shape: alertId/pondId/pondName/
 * severity/message/timestamp/acknowledged; active-only by default; ?all=true includes
 * everything; ?severity= and ?pond= filters; projectId query param is camelCase) and
 * POST /api/alerts/{id}/acknowledge (actor from JWT, body ignored, exact response).
 * NOTE: the monolith has NO resolve endpoint — the UI "Resolve" button acknowledges.
 * Project scoping via the snapshot (replaces RBACService.get_user_project_ids).
 */
@RestController
public class AlertController {

  private final AlertLogRepository alerts;
  private final ZoneId zone;

  public AlertController(AlertLogRepository alerts,
                         @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.alerts = alerts;
    this.zone = ZoneId.of(timezone);
  }

  @GetMapping({"/api/alerts", "/api/alerts/"})
  public Map<String, Object> list(@RequestParam(required = false) String projectId,
                                  @RequestParam(required = false) String severity,
                                  @RequestParam(required = false) String pond,
                                  @RequestParam(required = false) String parameterPrefix,
                                  @RequestParam(required = false) String startDate,
                                  @RequestParam(required = false) String endDate,
                                  @RequestParam(required = false, defaultValue = "false") String all,
                                  @AuthenticationPrincipal SnapshotPrincipal principal) {
    List<UUID> accessible = principal.snapshot().projectIds();
    if (projectId != null && !projectId.isBlank()) {
      UUID requested = UUID.fromString(projectId);
      accessible = accessible.contains(requested) ? List.of(requested) : List.of();
    }
    List<AlertLog> rows = accessible.isEmpty() ? List.of()
        : ("true".equalsIgnoreCase(all)
            ? alerts.findByProjectIdInOrderByTimestampDesc(accessible)
            : alerts.findByProjectIdInAndAcknowledgedFalseAndResolvedFalseOrderByTimestampDesc(accessible));
    OffsetDateTime start = startDate == null || startDate.isBlank()
        ? null : LocalDate.parse(startDate).atStartOfDay(zone).toOffsetDateTime();
    OffsetDateTime end = endDate == null || endDate.isBlank()
        ? null : LocalDate.parse(endDate).plusDays(1).atStartOfDay(zone).toOffsetDateTime();

    List<Map<String, Object>> out = rows.stream()
        .filter(a -> severity == null || severity.equalsIgnoreCase(a.getSeverity()))
        .filter(a -> pond == null || (a.getPondId() != null && pond.equals(a.getPondId().toString())))
        .filter(a -> parameterPrefix == null || parameterPrefix.isBlank()
            || (a.getParameter() != null && a.getParameter().startsWith(parameterPrefix)))
        .filter(a -> start == null || !eventTime(a).isBefore(start))
        .filter(a -> end == null || eventTime(a).isBefore(end))
        .map(a -> {
          Map<String, Object> m = new LinkedHashMap<String, Object>();
          m.put("alertId", a.getLogId().toString());
          m.put("pondId", a.getPondId() == null ? null : a.getPondId().toString());
          m.put("pondName", a.getPondId() == null ? "Project" : a.getPondName());
          m.put("severity", a.getSeverity());
          m.put("message", a.getMessage());
          m.put("timestamp", a.getTimestamp().toString());
          m.put("acknowledged", a.isAcknowledged());
          m.put("resolved", a.isResolved());
          m.put("parameter", a.getParameter());
          m.put("readingTimestamp", a.getReadingTimestamp() == null
              ? null : a.getReadingTimestamp().toString());
          return m;
        })
        .toList();
    return Map.of("alerts", out);
  }

  @PostMapping({"/api/alerts/{alertId}/acknowledge", "/api/alerts/{alertId}/acknowledge/"})
  public ResponseEntity<Map<String, String>> acknowledge(
      @PathVariable UUID alertId, @AuthenticationPrincipal SnapshotPrincipal principal) {
    AlertLog alert = alerts.findById(alertId).orElse(null);
    if (alert == null || alert.getProjectId() == null
        || !principal.hasProjectAccess(alert.getProjectId())) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND)
          .body(Map.of("detail", "Not found."));
    }
    // PARITY: actor from the authenticated user; request body ignored
    alert.acknowledge(principal.userId(), OffsetDateTime.now());
    alerts.save(alert);
    return ResponseEntity.ok(Map.of("message", "Alert acknowledged",
        "alertId", alertId.toString()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, String>> badId() {
    return ResponseEntity.badRequest().body(Map.of("detail", "Invalid id"));
  }

  private OffsetDateTime eventTime(AlertLog alert) {
    return alert.getReadingTimestamp() == null ? alert.getTimestamp() : alert.getReadingTimestamp();
  }
}
