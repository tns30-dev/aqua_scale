package com.aquashield.ingestion.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface TelemetryWriter {

  record StoredReading(UUID readingId, UUID projectId, UUID pondId, UUID projectSensorId,
                       String port, OffsetDateTime measuredAt, JsonNode values) {}

  void persist(UUID sensorMessageId, UUID deviceId, String deviceCode, long seqNo,
               JsonNode payload, OffsetDateTime measuredAt, List<StoredReading> rows);
}
