package com.aquashield.pond.events;

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
 * Pond domain events (spec: main/pond_service.md Events). NET-NEW (no monolith
 * counterpart). Best-effort: Cloud SQL remains authoritative; consumers (Ingestion's
 * device-map cache invalidation, Audit) tolerate at-least-once with TTL backstops.
 */
@Component
public class PondEventPublisher {

  public static final String TOPIC_POND_CREATED = "pond.created";
  public static final String TOPIC_POND_UPDATED = "pond.updated";
  public static final String TOPIC_CYCLE_STARTED = "cycle.started";
  public static final String TOPIC_CYCLE_COMPLETED = "cycle.completed";

  private static final Logger log = LoggerFactory.getLogger(PondEventPublisher.class);

  private final PubSubTemplate pubsub;
  private final ObjectMapper mapper;
  private final boolean enabled;
  private final String source;

  public PondEventPublisher(PubSubTemplate pubsub, ObjectMapper mapper,
                              @Value("${aquashield.events.enabled:true}") boolean enabled,
                              @Value("${aquashield.events.source:pond-service}") String source) {
    this.pubsub = pubsub;
    this.mapper = mapper;
    this.enabled = enabled;
    this.source = source;
  }

  public void publish(String topic, UUID projectId, JsonNode payload) {
    if (!enabled) {
      return;
    }
    try {
      EventEnvelope envelope = EventEnvelope.of(topic, "v1", Instant.now(), source,
          UUID.randomUUID().toString(),
          projectId == null ? null : projectId.toString(), null, payload);
      pubsub.publish(topic, mapper.writeValueAsString(envelope));
    } catch (Exception e) {
      log.warn("Event publish failed topic={}: {}", topic, e.toString());
    }
  }
}
