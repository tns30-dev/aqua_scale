package com.aquashield.audit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.pubsub.v1.Subscriber;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.cloud.spring.pubsub.support.BasicAcknowledgeablePubsubMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Audit ingress (catalogue: scripts/pubsub-bootstrap.sh — the audit service holds subs
 * on the dedicated audit topic AND the business event stream):
 *  - audit-subscription: audit.event.recorded — strict audit payloads (login.* etc.)
 *  - business-subscriptions: comma-separated list (project.*, device.*, alert.*, ...) —
 *    envelopes derived into audit records.
 *
 * Ack discipline (main/eda.md): RECORDED/DUPLICATE/REJECTED -> ack (terminal);
 * transient infrastructure failure -> nack -> redelivery/DLQ after 5 attempts.
 */
@Component
public class EventConsumers implements SmartLifecycle {

  private static final Logger log = LoggerFactory.getLogger(EventConsumers.class);

  private final PubSubTemplate pubsub;
  private final AuditRecorder recorder;
  private final ObjectMapper mapper;
  private final String auditSubscription;
  private final List<String> businessSubscriptions;
  private final List<Subscriber> subscribers = new ArrayList<>();
  private volatile boolean running;

  public EventConsumers(PubSubTemplate pubsub, AuditRecorder recorder, ObjectMapper mapper,
                        @Value("${aquashield.audit.audit-subscription}") String auditSubscription,
                        @Value("${aquashield.audit.business-subscriptions:}") String businessSubscriptions) {
    this.pubsub = pubsub;
    this.recorder = recorder;
    this.mapper = mapper;
    this.auditSubscription = auditSubscription;
    this.businessSubscriptions = businessSubscriptions.isBlank()
        ? List.of()
        : List.of(businessSubscriptions.split("\\s*,\\s*"));
  }

  @Override
  public void start() {
    subscribers.add(pubsub.subscribe(auditSubscription,
        message -> handle(message, true)));
    for (String subscription : businessSubscriptions) {
      subscribers.add(pubsub.subscribe(subscription,
          message -> handle(message, false)));
    }
    running = true;
    log.info("Audit consumers started: {} + {} business subs",
        auditSubscription, businessSubscriptions.size());
  }

  void handle(BasicAcknowledgeablePubsubMessage message, boolean strictAuditPayload) {
    try {
      JsonNode envelope = mapper.readTree(message.getPubsubMessage().getData().toStringUtf8());
      AuditRecorder.Result result = strictAuditPayload
          ? recorder.record(envelope)
          : recorder.recordBusinessEvent(envelope);
      if (result == AuditRecorder.Result.DUPLICATE) {
        log.debug("Duplicate audit event acked");
      }
      message.ack(); // RECORDED / DUPLICATE / REJECTED are all terminal
    } catch (org.springframework.dao.DataAccessResourceFailureException
             | org.springframework.transaction.CannotCreateTransactionException e) {
      log.warn("Transient DB failure recording audit event — nack for retry: {}", e.toString());
      message.nack();
    } catch (Exception e) {
      // malformed beyond parsing — terminal; the audit of the audit is the log
      log.error("Unrecoverable audit message (acked)", e);
      message.ack();
    }
  }

  @Override
  public void stop() {
    for (Subscriber subscriber : subscribers) {
      subscriber.stopAsync();
    }
    running = false;
  }

  @Override
  public boolean isRunning() {
    return running;
  }
}
