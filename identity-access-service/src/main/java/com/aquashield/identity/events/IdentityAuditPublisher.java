package com.aquashield.identity.events;

import com.aquashield.common.events.EventEnvelope;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Security audit payloads on the dedicated audit topic (spec: main/audit_service.md
 * Event Checklist — "login.succeeded / login.failed audit payload | Identity Service").
 *
 * Best-effort by design: the login flow NEVER fails because the bus hiccuped — the
 * authoritative security state lives in Postgres/Redis; the audit trail is evidence.
 * Payload carries the full audit field set; NEVER credentials or token material.
 */
@Component
public class IdentityAuditPublisher {

  public static final String TOPIC = "audit.event.recorded";
  public static final String LOGIN_SUCCEEDED = "login.succeeded";
  public static final String LOGIN_FAILED = "login.failed";

  private static final Logger log = LoggerFactory.getLogger(IdentityAuditPublisher.class);

  private final PubSubTemplate pubsub;
  private final ObjectMapper mapper;
  private final boolean enabled;
  private final String source;

  public IdentityAuditPublisher(PubSubTemplate pubsub, ObjectMapper mapper,
                                @Value("${aquashield.events.enabled:true}") boolean enabled,
                                @Value("${aquashield.events.source:identity-access-service}") String source) {
    this.pubsub = pubsub;
    this.mapper = mapper;
    this.enabled = enabled;
    this.source = source;
  }

  public void loginSucceeded(UUID userId, String email, String clientIp) {
    publish(LOGIN_SUCCEEDED, "success", userId, email, clientIp, null);
  }

  /** reason: invalid_credentials | rate_limited — actor only when the account is known. */
  public void loginFailed(UUID userIdIfKnown, String email, String clientIp, String reason) {
    publish(LOGIN_FAILED, "failure", userIdIfKnown, email, clientIp, reason);
  }

  private void publish(String eventType, String outcome, UUID actorUserId,
                       String email, String clientIp, String reason) {
    if (!enabled) {
      return;
    }
    try {
      ObjectNode payload = mapper.createObjectNode();
      payload.put("auditId", UUID.randomUUID().toString());
      payload.put("eventType", eventType);
      payload.put("category", "security");
      if (actorUserId != null) {
        payload.put("actorUserId", actorUserId.toString());
      }
      payload.put("serviceName", source);
      payload.put("resourceType", "user.session");
      payload.put("action", "login");
      payload.put("outcome", outcome);
      payload.put("occurredAt", Instant.now().toString());
      payload.put("correlationId", UUID.randomUUID().toString());
      ObjectNode metadata = payload.putObject("metadata");
      metadata.put("email", email);
      if (clientIp != null) {
        metadata.put("clientIp", clientIp);
      }
      if (reason != null) {
        metadata.put("reason", reason);
      }
      EventEnvelope envelope = EventEnvelope.of(TOPIC, "v1", Instant.now(), source,
          payload.get("correlationId").asText(), null, null, payload);
      pubsub.publish(TOPIC, mapper.writeValueAsString(envelope));
    } catch (Exception e) {
      log.warn("Audit publish failed type={}: {}", eventType, e.toString());
    }
  }
}
