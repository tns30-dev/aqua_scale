package com.aquashield.ingestion.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.bigtable.data.v2.models.Row;
import com.google.cloud.bigtable.data.v2.models.RowCell;
import com.google.cloud.bigtable.data.v2.models.RowMutation;
import com.google.cloud.bigtable.data.v2.models.TableId;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

final class BigtableTelemetryCodec {

  static final String FAMILY_RAW = "raw";
  static final String FAMILY_PARSED = "parsed";
  static final String FAMILY_META = "meta";
  static final String POND_PREFIX = "reading#pond#";
  static final String PROJECT_PREFIX = "reading#project#";
  static final String LATEST_PREFIX = "latest#";
  static final String MESSAGE_PREFIX = "message#";

  private BigtableTelemetryCodec() {}

  static String pondPrefix(UUID pondId) {
    return POND_PREFIX + pondId + "#";
  }

  static String projectPrefix(UUID projectId) {
    return PROJECT_PREFIX + projectId + "#";
  }

  static String latestPrefix(UUID projectId) {
    return LATEST_PREFIX + projectId + "#";
  }

  static String latestKey(UUID projectId, UUID pondId) {
    return latestPrefix(projectId) + pondId;
  }

  static String pondReadingKey(UUID pondId, OffsetDateTime measuredAt, UUID readingId) {
    return pondPrefix(pondId) + millisKey(measuredAt) + "#" + readingId;
  }

  static String projectReadingKey(UUID projectId, OffsetDateTime measuredAt, UUID pondId,
                                  UUID readingId) {
    String pondPart = pondId == null ? "project" : pondId.toString();
    return projectPrefix(projectId) + millisKey(measuredAt) + "#" + pondPart + "#" + readingId;
  }

  static String messageKey(UUID deviceId, long seqNo) {
    return MESSAGE_PREFIX + deviceId + "#" + String.format("%020d", seqNo);
  }

  static RowMutation messageMutation(String tableName, UUID sensorMessageId, UUID deviceId,
                                     String deviceCode, long seqNo, JsonNode payload,
                                     OffsetDateTime measuredAt, ObjectMapper mapper) {
    try {
      return RowMutation.create(TableId.of(tableName), messageKey(deviceId, seqNo))
          .setCell(FAMILY_META, "sensor_message_id", sensorMessageId.toString())
          .setCell(FAMILY_META, "iot_device_id", deviceId.toString())
          .setCell(FAMILY_META, "device_code", deviceCode)
          .setCell(FAMILY_META, "seq_no", Long.toString(seqNo))
          .setCell(FAMILY_META, "measured_at", measuredAt.toInstant().toString())
          .setCell(FAMILY_RAW, "payload", mapper.writeValueAsString(payload));
    } catch (Exception e) {
      throw new IllegalArgumentException("Unable to encode Bigtable message mutation", e);
    }
  }

  static RowMutation readingMutation(String tableName, String rowKey, UUID sensorMessageId,
                                     UUID deviceId, String deviceCode, long seqNo,
                                     TelemetryWriter.StoredReading row,
                                     ObjectMapper mapper) {
    try {
      RowMutation mutation = RowMutation.create(TableId.of(tableName), rowKey)
          .setCell(FAMILY_META, "reading_id", row.readingId().toString())
          .setCell(FAMILY_META, "sensor_message_id", sensorMessageId.toString())
          .setCell(FAMILY_META, "iot_device_id", deviceId.toString())
          .setCell(FAMILY_META, "device_code", deviceCode)
          .setCell(FAMILY_META, "seq_no", Long.toString(seqNo))
          .setCell(FAMILY_META, "project_id", row.projectId().toString())
          .setCell(FAMILY_META, "project_sensor_id", row.projectSensorId().toString())
          .setCell(FAMILY_META, "port", row.port())
          .setCell(FAMILY_META, "measured_at", row.measuredAt().toInstant().toString())
          .setCell(FAMILY_PARSED, "values", mapper.writeValueAsString(row.values()));
      if (row.pondId() != null) {
        mutation.setCell(FAMILY_META, "pond_id", row.pondId().toString());
      }
      return mutation;
    } catch (Exception e) {
      throw new IllegalArgumentException("Unable to encode Bigtable reading mutation", e);
    }
  }

  static TelemetryReadStore.Reading toReading(Row row, ObjectMapper mapper) {
    Map<String, String> meta = new LinkedHashMap<>();
    String valuesJson = null;
    for (RowCell cell : row.getCells()) {
      String qualifier = cell.getQualifier().toStringUtf8();
      String value = cell.getValue().toStringUtf8();
      if (FAMILY_META.equals(cell.getFamily())) {
        meta.putIfAbsent(qualifier, value);
      } else if (FAMILY_PARSED.equals(cell.getFamily()) && "values".equals(qualifier)) {
        if (valuesJson == null) {
          valuesJson = value;
        }
      }
    }
    if (valuesJson == null || !meta.containsKey("project_id")
        || !meta.containsKey("project_sensor_id") || !meta.containsKey("measured_at")) {
      return null;
    }
    try {
      UUID pondId = meta.containsKey("pond_id") ? UUID.fromString(meta.get("pond_id")) : null;
      return new TelemetryReadStore.Reading(
          UUID.fromString(meta.get("project_id")),
          pondId,
          UUID.fromString(meta.get("project_sensor_id")),
          meta.getOrDefault("port", ""),
          OffsetDateTime.ofInstant(Instant.parse(meta.get("measured_at")), ZoneOffset.UTC),
          mapper.readTree(valuesJson));
    } catch (Exception e) {
      return null;
    }
  }

  private static String millisKey(OffsetDateTime measuredAt) {
    return String.format("%013d", measuredAt.toInstant().toEpochMilli());
  }
}
