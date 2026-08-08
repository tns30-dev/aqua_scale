package com.aquashield.ingestion.service;

import com.aquashield.ingestion.config.IngestionProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.bigtable.data.v2.BigtableDataClient;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(
    prefix = "aquashield.ingestion.bigtable",
    name = "write-enabled",
    havingValue = "true")
public class BigtableTelemetryWriter implements TelemetryWriter {

  private final BigtableDataClient client;
  private final ObjectMapper mapper;
  private final String tableName;

  public BigtableTelemetryWriter(IngestionProperties props, ObjectMapper mapper)
      throws IOException {
    IngestionProperties.Bigtable bigtable = props.bigtable();
    this.client = BigtableDataClient.create(
        required(bigtable.projectId(), "aquashield.ingestion.bigtable.project-id"),
        required(bigtable.instanceId(), "aquashield.ingestion.bigtable.instance-id"));
    this.tableName = required(bigtable.tableName(), "aquashield.ingestion.bigtable.table-name");
    this.mapper = mapper;
  }

  @PreDestroy
  public void close() {
    client.close();
  }

  @Override
  public void persist(UUID sensorMessageId, UUID deviceId, String deviceCode, long seqNo,
                      JsonNode payload, OffsetDateTime measuredAt, List<StoredReading> rows) {
    client.mutateRow(BigtableTelemetryCodec.messageMutation(
        tableName, sensorMessageId, deviceId, deviceCode, seqNo, payload, measuredAt, mapper));
    for (StoredReading row : rows) {
      client.mutateRow(BigtableTelemetryCodec.readingMutation(
          tableName,
          BigtableTelemetryCodec.projectReadingKey(
              row.projectId(), row.measuredAt(), row.pondId(), row.readingId()),
          sensorMessageId, deviceId, deviceCode, seqNo, row, mapper));
      if (row.pondId() != null) {
        client.mutateRow(BigtableTelemetryCodec.readingMutation(
            tableName,
            BigtableTelemetryCodec.pondReadingKey(row.pondId(), row.measuredAt(), row.readingId()),
            sensorMessageId, deviceId, deviceCode, seqNo, row, mapper));
        client.mutateRow(BigtableTelemetryCodec.readingMutation(
            tableName,
            BigtableTelemetryCodec.latestKey(row.projectId(), row.pondId()),
            sensorMessageId, deviceId, deviceCode, seqNo, row, mapper));
      }
    }
  }

  private static String required(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(name + " is required when Bigtable telemetry is enabled");
    }
    return value;
  }
}
