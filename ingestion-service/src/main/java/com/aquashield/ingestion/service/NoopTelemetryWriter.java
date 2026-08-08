package com.aquashield.ingestion.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(
    prefix = "aquashield.ingestion.bigtable",
    name = "write-enabled",
    havingValue = "false",
    matchIfMissing = true)
public class NoopTelemetryWriter implements TelemetryWriter {

  @Override
  public void persist(UUID sensorMessageId, UUID deviceId, String deviceCode, long seqNo,
                      JsonNode payload, OffsetDateTime measuredAt, List<StoredReading> rows) {
    // Cloud SQL remains the local/default demo store unless Bigtable writing is enabled.
  }
}
