package com.aquashield.realtime.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.cloud.spring.pubsub.support.BasicAcknowledgeablePubsubMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Bridges domain events to browser frames (spec: main/websocket.md Event Types).
 * Frame shapes preserve the monolith broadcast contracts (notification parity spec §3):
 *   reading.ingested  -> {"type":"sensor.reading", pond_id, project_id, values, measured_at}
 *   alert.created     -> {"type":"alert", "alert":{...broadcast dict...}, project_id, pond_id}
 *   alert.resolved    -> {"type":"alert_resolved", project_id, pond_id, parameter} (new-arch)
 * Push failures never matter to the source systems — frames are fire-and-forget.
 */
@Component
public class EventBridge implements SmartLifecycle {

  private static final Logger log = LoggerFactory.getLogger(EventBridge.class);

  private final PubSubTemplate pubsub;
  private final RedisFanout fanout;
  private final ObjectMapper mapper;
  private final String readingsSub;
  private final String alertCreatedSub;
  private final String alertResolvedSub;
  private final List<com.google.cloud.pubsub.v1.Subscriber> subscribers = new ArrayList<>();
  private volatile boolean running;

  public EventBridge(PubSubTemplate pubsub, RedisFanout fanout, ObjectMapper mapper,
                     @Value("${aquashield.realtime.readings-subscription}") String readingsSub,
                     @Value("${aquashield.realtime.alert-created-subscription}") String alertCreatedSub,
                     @Value("${aquashield.realtime.alert-resolved-subscription}") String alertResolvedSub) {
    this.pubsub = pubsub;
    this.fanout = fanout;
    this.mapper = mapper;
    this.readingsSub = readingsSub;
    this.alertCreatedSub = alertCreatedSub;
    this.alertResolvedSub = alertResolvedSub;
  }

  @Override
  public void start() {
    subscribers.add(pubsub.subscribe(readingsSub, m -> handle(m, this::readingFrame)));
    subscribers.add(pubsub.subscribe(alertCreatedSub, m -> handle(m, this::alertFrame)));
    subscribers.add(pubsub.subscribe(alertResolvedSub, m -> handle(m, this::alertResolvedFrame)));
    running = true;
    log.info("Event bridge consuming: {}, {}, {}", readingsSub, alertCreatedSub, alertResolvedSub);
  }

  private interface FrameBuilder {
    String build(JsonNode envelope) throws Exception;
  }

  private void handle(BasicAcknowledgeablePubsubMessage message, FrameBuilder builder) {
    try {
      JsonNode envelope = mapper.readTree(message.getPubsubMessage().getData().toStringUtf8());
      String projectId = envelope.path("projectId").asText(null);
      if (projectId != null) {
        fanout.publish(UUID.fromString(projectId), builder.build(envelope));
      }
    } catch (Exception e) {
      log.warn("Frame bridge dropped event: {}", e.toString());
    }
    message.ack(); // push is best-effort; never redeliver UI frames
  }

  private String readingFrame(JsonNode envelope) throws Exception {
    JsonNode payload = envelope.get("payload");
    ObjectNode frame = mapper.createObjectNode();
    frame.put("type", "sensor.reading"); // parity frame type
    frame.put("project_id", envelope.path("projectId").asText());
    frame.put("pond_id", envelope.path("pondId").asText());
    frame.put("measured_at", payload.path("measuredAt").asText());
    frame.set("values", payload.path("values"));
    return mapper.writeValueAsString(frame);
  }

  private String alertFrame(JsonNode envelope) throws Exception {
    ObjectNode frame = mapper.createObjectNode();
    frame.put("type", "alert"); // parity: ProjectConsumer.alert_message shape
    frame.set("alert", envelope.get("payload"));
    frame.put("project_id", envelope.path("projectId").asText());
    frame.put("pond_id", envelope.path("pondId").asText());
    return mapper.writeValueAsString(frame);
  }

  private String alertResolvedFrame(JsonNode envelope) throws Exception {
    ObjectNode frame = mapper.createObjectNode();
    frame.put("type", "alert_resolved"); // new-arch frame (no monolith analog)
    frame.put("project_id", envelope.path("projectId").asText());
    frame.put("pond_id", envelope.path("pondId").asText());
    frame.put("parameter", envelope.at("/payload/parameter").asText());
    return mapper.writeValueAsString(frame);
  }

  @Override
  public void stop() {
    subscribers.forEach(com.google.cloud.pubsub.v1.Subscriber::stopAsync);
    running = false;
  }

  @Override
  public boolean isRunning() {
    return running;
  }
}
