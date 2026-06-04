package com.aquashield.sensor.events;

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
 * Sensor domain events (spec: main/sensor_service.md Events). NET-NEW (no monolith
 * counterpart). Best-effort: Cloud SQL remains authoritative; consumers (Ingestion's
 * device-map cache invalidation, Audit) tolerate at-least-once with TTL backstops.
 */
@Component
public class SensorEventPublisher {

  public static final String TOPIC_DEVICE_REGISTERED = "device.registered";
  public static final String TOPIC_DEVICE_STATUS_CHANGED = "device.status.changed";
  public static final String TOPIC_MAPPING_ASSIGNED = "project.sensor.assigned";
  public static final String TOPIC_MAPPING_UPDATED = "project.sensor.updated";

  private static final Logger log = LoggerFactory.getLogger(SensorEventPublisher.class);

  private final PubSubTemplate pubsub;
  private final ObjectMapper mapper;
  private final boolean enabled;
  private final String source;

  public SensorEventPublisher(PubSubTemplate pubsub, ObjectMapper mapper,
                              @Value("${aquashield.events.enabled:true}") boolean enabled,
                              @Value("${aquashield.events.source:sensor-service}") String source) {
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
