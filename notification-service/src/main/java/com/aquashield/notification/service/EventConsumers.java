package com.aquashield.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.cloud.spring.pubsub.support.BasicAcknowledgeablePubsubMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Two subscriptions (spec: main/notification_service.md + redis.md invalidation pair):
 *  - reading.ingested  -> threshold evaluation (the alert engine input)
 *  - project.settings.updated -> threshold cache invalidation
 *
 * PARITY (gotcha #9): evaluation errors are swallowed (ack + log) — alerting must never
 * poison the readings pipeline. Only infrastructure failures nack for redelivery/DLQ.
 */
@Component
public class EventConsumers implements SmartLifecycle {

  private static final Logger log = LoggerFactory.getLogger(EventConsumers.class);

  private final PubSubTemplate pubsub;
  private final AlertEngine engine;
  private final ThresholdCache thresholds;
  private final ObjectMapper mapper;
  private final String readingsSubscription;
  private final String settingsSubscription;
  private com.google.cloud.pubsub.v1.Subscriber readingsSubscriber;
  private com.google.cloud.pubsub.v1.Subscriber settingsSubscriber;
  private volatile boolean running;

  public EventConsumers(PubSubTemplate pubsub, AlertEngine engine, ThresholdCache thresholds,
                        ObjectMapper mapper,
                        @Value("${aquashield.notification.readings-subscription}") String readingsSubscription,
                        @Value("${aquashield.notification.settings-subscription}") String settingsSubscription) {
    this.pubsub = pubsub;
    this.engine = engine;
    this.thresholds = thresholds;
    this.mapper = mapper;
    this.readingsSubscription = readingsSubscription;
    this.settingsSubscription = settingsSubscription;
  }

  @Override
  public void start() {
    readingsSubscriber = pubsub.subscribe(readingsSubscription, this::onReading);
    settingsSubscriber = pubsub.subscribe(settingsSubscription, this::onSettingsUpdated);
    running = true;
    log.info("Consumers started: {} + {}", readingsSubscription, settingsSubscription);
  }

  void onReading(BasicAcknowledgeablePubsubMessage message) {
    try {
      JsonNode envelope = mapper.readTree(message.getPubsubMessage().getData().toStringUtf8());
      UUID projectId = UUID.fromString(envelope.get("projectId").asText());
      UUID pondId = UUID.fromString(envelope.get("pondId").asText());
      JsonNode payload = envelope.get("payload");
      OffsetDateTime measuredAt = OffsetDateTime.parse(payload.get("measuredAt").asText());
      engine.evaluate(projectId, pondId, payload.get("values"), measuredAt,
          envelope.path("correlationId").asText(null));
      message.ack();
    } catch (org.springframework.dao.DataAccessResourceFailureException
             | org.springframework.transaction.CannotCreateTransactionException e) {
      log.warn("Transient DB failure evaluating reading — nack for retry: {}", e.toString());
      message.nack();
    } catch (io.grpc.StatusRuntimeException e) {
      if (e.getStatus().getCode() == io.grpc.Status.Code.UNAVAILABLE
          || e.getStatus().getCode() == io.grpc.Status.Code.DEADLINE_EXCEEDED) {
        log.warn("Transient gRPC failure — nack for retry: {}", e.getStatus());
        message.nack();
      } else {
        log.error("Threshold check failed (swallowed, parity): {}", e.getStatus());
        message.ack();
      }
    } catch (Exception e) {
      // PARITY: engine failures never block the pipeline
      log.error("Threshold check failed (swallowed, parity)", e);
      message.ack();
    }
  }

  void onSettingsUpdated(BasicAcknowledgeablePubsubMessage message) {
    try {
      JsonNode envelope = mapper.readTree(message.getPubsubMessage().getData().toStringUtf8());
      String projectId = envelope.path("projectId").asText(null);
      if (projectId != null) {
        thresholds.invalidate(UUID.fromString(projectId));
        log.info("Threshold cache invalidated project={}", projectId);
      }
    } catch (Exception e) {
      log.warn("Settings-updated handling failed (TTL is the backstop): {}", e.toString());
    }
    message.ack();
  }

  @Override
  public void stop() {
    if (readingsSubscriber != null) {
      readingsSubscriber.stopAsync();
    }
    if (settingsSubscriber != null) {
      settingsSubscriber.stopAsync();
    }
    running = false;
  }

  @Override
  public boolean isRunning() {
    return running;
  }
}
