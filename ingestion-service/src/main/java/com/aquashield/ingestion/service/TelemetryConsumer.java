package com.aquashield.ingestion.service;

import com.aquashield.ingestion.config.IngestionProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.cloud.spring.pubsub.support.BasicAcknowledgeablePubsubMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

/**
 * Pub/Sub subscriber on iot.telemetry.received (spec: main/ingestion_service.md).
 * Ack discipline drives the DLQ design (main/eda.md):
 *   OK / DUPLICATE / REJECTED (permanent) -> ack
 *   TRANSIENT -> nack -> Pub/Sub redelivery -> DLQ after max attempts
 */
@Component
public class TelemetryConsumer implements SmartLifecycle {

  private static final Logger log = LoggerFactory.getLogger(TelemetryConsumer.class);

  private final PubSubTemplate pubsub;
  private final IngestionPipeline pipeline;
  private final IngestionProperties props;
  private final ObjectMapper mapper;
  private com.google.cloud.pubsub.v1.Subscriber subscriber;
  private volatile boolean running;

  public TelemetryConsumer(PubSubTemplate pubsub, IngestionPipeline pipeline,
                           IngestionProperties props, ObjectMapper mapper) {
    this.pubsub = pubsub;
    this.pipeline = pipeline;
    this.props = props;
    this.mapper = mapper;
  }

  @Override
  public void start() {
    subscriber = pubsub.subscribe(props.subscription(), this::handle);
    running = true;
    log.info("Telemetry consumer started on subscription {}", props.subscription());
  }

  void handle(BasicAcknowledgeablePubsubMessage message) {
    JsonNode envelope;
    try {
      envelope = mapper.readTree(message.getPubsubMessage().getData().toStringUtf8());
    } catch (Exception e) {
      log.warn("Unparseable telemetry message — acking (permanent)");
      message.ack();
      return;
    }
    IngestionPipeline.Result result = pipeline.process(envelope);
    switch (result.outcome()) {
      case OK, DUPLICATE, REJECTED -> message.ack();
      case TRANSIENT -> message.nack(); // redelivery -> DLQ after max attempts
    }
  }

  @Override
  public void stop() {
    if (subscriber != null) {
      subscriber.stopAsync();
    }
    running = false;
  }

  @Override
  public boolean isRunning() {
    return running;
  }
}
