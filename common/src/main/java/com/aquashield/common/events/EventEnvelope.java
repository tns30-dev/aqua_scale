package com.aquashield.common.events;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/**
 * THE canonical Pub/Sub event envelope (main/pub_sub_contract_docs.md). Every published
 * event uses this shape; payload schemas live in shared-api/events/*.v1.json.
 */
public record EventEnvelope(
    String eventId,
    String eventType,
    String schemaVersion,
    Instant occurredAt,
    Instant publishedAt,
    String source,
    String correlationId,
    String causationId,   // nullable: only when caused by another event
    String projectId,     // nullable: only when project-scoped
    String pondId,        // nullable: only when pond-scoped
    JsonNode payload) {

  /** New root envelope (no causation), stamping publish time now. */
  public static EventEnvelope of(String eventType, String schemaVersion, Instant occurredAt,
                                 String source, String correlationId,
                                 String projectId, String pondId, JsonNode payload) {
    return new EventEnvelope(UUID.randomUUID().toString(), eventType, schemaVersion,
        occurredAt, Instant.now(), source, correlationId, null, projectId, pondId, payload);
  }
}
