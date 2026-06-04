package com.aquashield.audit.api;

import com.aquashield.audit.domain.AuditEvent;
import com.aquashield.audit.repo.AuditEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Admin audit queries (spec: main/audit_service.md REST API Checklist). ALL endpoints
 * are platform-admin only. Results are newest-first; `limit` clamps to [1, 200].
 */
@RestController
@RequestMapping("/api/audit")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class AuditQueryController {

  static final int DEFAULT_LIMIT = 50;
  static final int MAX_LIMIT = 200;

  private final AuditEventRepository events;

  public AuditQueryController(AuditEventRepository events) {
    this.events = events;
  }

  public record AuditEventDto(UUID auditId, String eventType, String category,
                              UUID actorUserId, String serviceName, UUID projectId,
                              String resourceType, String resourceId, String action,
                              String outcome, OffsetDateTime occurredAt,
                              OffsetDateTime recordedAt, String correlationId,
                              String traceId, JsonNode metadata) {

    static AuditEventDto from(AuditEvent e) {
      return new AuditEventDto(e.getAuditId(), e.getEventType(), e.getCategory(),
          e.getActorUserId(), e.getServiceName(), e.getProjectId(), e.getResourceType(),
          e.getResourceId(), e.getAction(), e.getOutcome(), e.getOccurredAt(),
          e.getRecordedAt(), e.getCorrelationId(), e.getTraceId(), e.getMetadata());
    }
  }

  @GetMapping("/events")
  public List<AuditEventDto> search(@RequestParam(required = false) String eventType,
                                    @RequestParam(required = false) String serviceName,
                                    @RequestParam(required = false) String category,
                                    @RequestParam(required = false) String outcome,
                                    @RequestParam(required = false) UUID actorUserId,
                                    @RequestParam(required = false) UUID projectId,
                                    @RequestParam(required = false) String correlationId,
                                    @RequestParam(required = false) String from,
                                    @RequestParam(required = false) String to,
                                    @RequestParam(required = false) Integer limit) {
    return query(spec(eventType, serviceName, category, outcome, actorUserId, projectId,
        correlationId, parseInstant(from), parseInstant(to)), limit);
  }

  @GetMapping("/events/{auditId}")
  public AuditEventDto detail(@PathVariable UUID auditId) {
    return events.findById(auditId).map(AuditEventDto::from)
        .orElseThrow(NotFoundException::new);
  }

  @GetMapping("/projects/{projectId}")
  public List<AuditEventDto> projectTrail(@PathVariable UUID projectId,
                                          @RequestParam(required = false) Integer limit) {
    return query(spec(null, null, null, null, null, projectId, null, null, null), limit);
  }

  @GetMapping("/users/{userId}")
  public List<AuditEventDto> userTrail(@PathVariable UUID userId,
                                       @RequestParam(required = false) Integer limit) {
    return query(spec(null, null, null, null, userId, null, null, null, null), limit);
  }

  /** Security-relevant review: login, access, admin changes (category = security). */
  @GetMapping("/security")
  public List<AuditEventDto> securityTrail(@RequestParam(required = false) String outcome,
                                           @RequestParam(required = false) Integer limit) {
    return query(spec(null, null, "security", outcome, null, null, null, null, null), limit);
  }

  private List<AuditEventDto> query(Specification<AuditEvent> spec, Integer limit) {
    int size = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
    return events.findAll(spec,
            PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "occurredAt")))
        .map(AuditEventDto::from).getContent();
  }

  private static Specification<AuditEvent> spec(String eventType, String serviceName,
                                                String category, String outcome,
                                                UUID actorUserId, UUID projectId,
                                                String correlationId,
                                                OffsetDateTime from, OffsetDateTime to) {
    return (root, q, cb) -> {
      List<Predicate> predicates = new ArrayList<>();
      if (eventType != null) {
        predicates.add(cb.equal(root.get("eventType"), eventType));
      }
      if (serviceName != null) {
        predicates.add(cb.equal(root.get("serviceName"), serviceName));
      }
      if (category != null) {
        predicates.add(cb.equal(root.get("category"), category));
      }
      if (outcome != null) {
        predicates.add(cb.equal(root.get("outcome"), outcome));
      }
      if (actorUserId != null) {
        predicates.add(cb.equal(root.get("actorUserId"), actorUserId));
      }
      if (projectId != null) {
        predicates.add(cb.equal(root.get("projectId"), projectId));
      }
      if (correlationId != null) {
        predicates.add(cb.equal(root.get("correlationId"), correlationId));
      }
      if (from != null) {
        predicates.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
      }
      if (to != null) {
        predicates.add(cb.lessThanOrEqualTo(root.get("occurredAt"), to));
      }
      return cb.and(predicates.toArray(new Predicate[0]));
    };
  }

  private static OffsetDateTime parseInstant(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Instant.parse(value).atOffset(ZoneOffset.UTC);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "from/to must be ISO-8601 instants");
    }
  }

  @ResponseStatus(HttpStatus.NOT_FOUND)
  public static class NotFoundException extends RuntimeException {}
}
