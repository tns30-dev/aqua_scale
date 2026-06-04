package com.aquashield.ingestion.events;

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
 * Ingestion's output events (spec: main/eda.md core topics). Post-persistence publishing
 * is best-effort, mirroring the monolith's swallowed post-commit broadcast — readings are
 * authoritative in the store; consumers are eventually consistent.
 */
@Component
public class IngestionEventPublisher {

  public static final String TOPIC_VALIDATED = "sensor.message.validated";
  public static final String TOPIC_REJECTED = "sensor.message.rejected";
  public static final String TOPIC_READING_INGESTED = "reading.ingested";
  public static final String TOPIC_READING_QUARANTINED = "reading.quarantined";

  private static final Logger log = LoggerFactory.getLogger(IngestionEventPublisher.class);

  private final PubSubTemplate pubsub;
  private final ObjectMapper mapper;
  private final boolean enabled;
  private final String source;

  public IngestionEventPublisher(PubSubTemplate pubsub, ObjectMapper mapper,
                                 @Value("${aquashield.events.enabled:true}") boolean enabled,
                                 @Value("${aquashield.events.source:ingestion-service}") String source) {
    this.pubsub = pubsub;
    this.mapper = mapper;
    this.enabled = enabled;
    this.source = source;
  }

  public void publish(String topic, String correlationId, String projectId, String pondId,
                      JsonNode payload) {
    if (!enabled) {
      return;
    }
    try {
      EventEnvelope envelope = EventEnvelope.of(topic, "v1", Instant.now(), source,
          correlationId != null ? correlationId : UUID.randomUUID().toString(),
          projectId, pondId, payload);
      pubsub.publish(topic, mapper.writeValueAsString(envelope));
    } catch (Exception e) {
      log.warn("Event publish failed topic={}: {}", topic, e.toString());
    }
  }
}
