package com.aquashield.project.events;

import com.aquashield.common.events.EventEnvelope;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Publishes project domain events (spec: main/project_service.md Events table) using the
 * canonical envelope. NET-NEW capability — the monolith had no events. Publishing is
 * best-effort here (settings are still authoritative in Cloud SQL); consumers use the
 * events for cache invalidation/audit, with TTLs as the backstop.
 */
@Component
public class ProjectEventPublisher {

  public static final String TOPIC_CREATED = "project.created";
  public static final String TOPIC_UPDATED = "project.updated";
  public static final String TOPIC_SETTINGS_UPDATED = "project.settings.updated";

  private static final Logger log = LoggerFactory.getLogger(ProjectEventPublisher.class);

  private final PubSubTemplate pubsub;
  private final ObjectMapper mapper;
  private final boolean enabled;
  private final String source;

  public ProjectEventPublisher(PubSubTemplate pubsub, ObjectMapper mapper,
                               @Value("${aquashield.events.enabled:true}") boolean enabled,
                               @Value("${aquashield.events.source:project-service}") String source) {
    this.pubsub = pubsub;
    this.mapper = mapper;
    this.enabled = enabled;
    this.source = source;
  }

  public void publish(String topic, UUID projectId, JsonNode payload, String correlationId) {
    if (!enabled) {
      return;
    }
    try {
      EventEnvelope envelope = EventEnvelope.of(topic, "v1", Instant.now(), source,
          correlationId != null ? correlationId : UUID.randomUUID().toString(),
          projectId == null ? null : projectId.toString(), null, payload);
      pubsub.publish(topic, mapper.writeValueAsString(envelope));
    } catch (Exception e) {
      // best-effort: never fail the business write because the bus hiccuped
      log.warn("Event publish failed topic={} project={}: {}", topic, projectId, e.toString());
    }
  }
}
