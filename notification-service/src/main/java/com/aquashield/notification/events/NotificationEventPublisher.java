package com.aquashield.notification.events;

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
 * Alert lifecycle events (spec: main/eda.md). Best-effort, parity with the monolith's
 * swallowed broadcast errors — alerting must never poison the readings queue.
 */
@Component
public class NotificationEventPublisher {

  public static final String TOPIC_THRESHOLD_VIOLATED = "threshold.violated";
  public static final String TOPIC_ALERT_CREATED = "alert.created";
  public static final String TOPIC_ALERT_RESOLVED = "alert.resolved";
  public static final String TOPIC_NOTIFICATION_REQUESTED = "notification.requested";

  private static final Logger log = LoggerFactory.getLogger(NotificationEventPublisher.class);

  private final PubSubTemplate pubsub;
  private final ObjectMapper mapper;
  private final boolean enabled;
  private final String source;

  public NotificationEventPublisher(PubSubTemplate pubsub, ObjectMapper mapper,
                                    @Value("${aquashield.events.enabled:true}") boolean enabled,
                                    @Value("${aquashield.events.source:notification-service}") String source) {
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
