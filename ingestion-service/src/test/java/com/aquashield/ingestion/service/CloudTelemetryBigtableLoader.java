package com.aquashield.ingestion.service;

import com.google.api.gax.batching.Batcher;
import com.google.cloud.bigtable.data.v2.BigtableDataClient;
import com.google.cloud.bigtable.data.v2.models.RowMutationEntry;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * One-off evidence loader: stream local Postgres telemetry into Cloud Bigtable.
 *
 * Kept under test sources so it is not shipped in the service image.
 */
public final class CloudTelemetryBigtableLoader {

  private CloudTelemetryBigtableLoader() {}

  public static void main(String[] args) throws Exception {
    String gcpProject = env("GCP_PROJECT_ID", "aquashield-ms-dev-20260808");
    String instanceId = env("BIGTABLE_INSTANCE_ID", "aquashield-dev-telemetry");
    String tableName = env("BIGTABLE_TABLE_NAME", "telemetry_readings");
    int fetchSize = Integer.parseInt(env("FETCH_SIZE", "5000"));
    long limit = Long.parseLong(env("LOAD_LIMIT", "4000000"));

    String jdbcUrl = "jdbc:postgresql://%s:%s/%s".formatted(
        env("LOCAL_DB_HOST", "127.0.0.1"),
        env("LOCAL_DB_PORT", "5433"),
        env("LOCAL_DB_NAME", "aquashield"));
    String user = env("LOCAL_DB_USER", "aquashield");
    String password = env("LOCAL_DB_PASSWORD", "aquashield_local");

    try (Connection db = DriverManager.getConnection(jdbcUrl, user, password);
         BigtableDataClient bigtable = BigtableDataClient.create(gcpProject, instanceId)) {
      Batcher<RowMutationEntry, Void> batcher = bigtable.newBulkMutationBatcher(tableName);
      db.setAutoCommit(false);
      try (PreparedStatement stmt = db.prepareStatement(sql())) {
        stmt.setFetchSize(fetchSize);
        stmt.setLong(1, limit);
        long rows = 0;
        long entries = 0;
        try (ResultSet rs = stmt.executeQuery()) {
          while (rs.next()) {
            TelemetryRow row = readRow(rs);
            long cellTs = row.measuredAt.toInstant().toEpochMilli() * 1000;
            batcher.add(messageEntry(row, cellTs));
            batcher.add(readingEntry(
                BigtableTelemetryCodec.projectReadingKey(
                    row.projectId, row.measuredAt, row.pondId, row.readingId),
                row,
                cellTs));
            entries += 2;
            if (row.pondId != null) {
              batcher.add(readingEntry(
                  BigtableTelemetryCodec.pondReadingKey(row.pondId, row.measuredAt, row.readingId),
                  row,
                  cellTs));
              batcher.add(readingEntry(
                  BigtableTelemetryCodec.latestKey(row.projectId, row.pondId),
                  row,
                  cellTs));
              entries += 2;
            }
            rows++;
            if (rows % 100_000 == 0) {
              batcher.sendOutstanding();
              System.out.printf("loaded %,d readings / %,d Bigtable row mutations%n", rows, entries);
            }
          }
        }
        batcher.close();
        System.out.printf("complete: %,d readings / %,d Bigtable row mutations%n", rows, entries);
      } catch (Exception e) {
        batcher.cancelOutstanding();
        throw e;
      }
    }
  }

  private static String sql() {
    return """
        select
          r.reading_id,
          r.sensor_message_id,
          r.project_id,
          r.pond_id,
          r.project_sensor_id,
          r.port,
          r.measured_at,
          r.reading_values::text as reading_values,
          m.iot_device_id,
          m.device_code,
          m.seq_no,
          m.payload::text as payload
        from ingestion.sensor_readings r
        join ingestion.sensor_messages m on m.sensor_message_id = r.sensor_message_id
        order by r.project_id, r.pond_id, r.measured_at, r.reading_id
        limit ?
        """;
  }

  private static TelemetryRow readRow(ResultSet rs) throws Exception {
    return new TelemetryRow(
        UUID.fromString(rs.getString("reading_id")),
        UUID.fromString(rs.getString("sensor_message_id")),
        UUID.fromString(rs.getString("project_id")),
        optionalUuid(rs.getString("pond_id")),
        UUID.fromString(rs.getString("project_sensor_id")),
        rs.getString("port"),
        timestamp(rs, "measured_at"),
        rs.getString("reading_values"),
        UUID.fromString(rs.getString("iot_device_id")),
        rs.getString("device_code"),
        rs.getLong("seq_no"),
        rs.getString("payload"));
  }

  private static RowMutationEntry messageEntry(TelemetryRow row, long cellTs) {
    return RowMutationEntry.create(BigtableTelemetryCodec.messageKey(row.iotDeviceId, row.seqNo))
        .setCell(BigtableTelemetryCodec.FAMILY_META, "sensor_message_id", cellTs,
            row.sensorMessageId.toString())
        .setCell(BigtableTelemetryCodec.FAMILY_META, "iot_device_id", cellTs,
            row.iotDeviceId.toString())
        .setCell(BigtableTelemetryCodec.FAMILY_META, "device_code", cellTs, row.deviceCode)
        .setCell(BigtableTelemetryCodec.FAMILY_META, "seq_no", cellTs, Long.toString(row.seqNo))
        .setCell(BigtableTelemetryCodec.FAMILY_META, "measured_at", cellTs,
            row.measuredAt.toInstant().toString())
        .setCell(BigtableTelemetryCodec.FAMILY_RAW, "payload", cellTs, row.payload);
  }

  private static RowMutationEntry readingEntry(String rowKey, TelemetryRow row, long cellTs) {
    RowMutationEntry entry = RowMutationEntry.create(rowKey)
        .setCell(BigtableTelemetryCodec.FAMILY_META, "reading_id", cellTs, row.readingId.toString())
        .setCell(BigtableTelemetryCodec.FAMILY_META, "sensor_message_id", cellTs,
            row.sensorMessageId.toString())
        .setCell(BigtableTelemetryCodec.FAMILY_META, "iot_device_id", cellTs,
            row.iotDeviceId.toString())
        .setCell(BigtableTelemetryCodec.FAMILY_META, "device_code", cellTs, row.deviceCode)
        .setCell(BigtableTelemetryCodec.FAMILY_META, "seq_no", cellTs, Long.toString(row.seqNo))
        .setCell(BigtableTelemetryCodec.FAMILY_META, "project_id", cellTs, row.projectId.toString())
        .setCell(BigtableTelemetryCodec.FAMILY_META, "project_sensor_id", cellTs,
            row.projectSensorId.toString())
        .setCell(BigtableTelemetryCodec.FAMILY_META, "port", cellTs, row.port)
        .setCell(BigtableTelemetryCodec.FAMILY_META, "measured_at", cellTs,
            row.measuredAt.toInstant().toString())
        .setCell(BigtableTelemetryCodec.FAMILY_PARSED, "values", cellTs, row.readingValues);
    if (row.pondId != null) {
      entry.setCell(BigtableTelemetryCodec.FAMILY_META, "pond_id", cellTs, row.pondId.toString());
    }
    return entry;
  }

  private static OffsetDateTime timestamp(ResultSet rs, String column) throws Exception {
    Timestamp timestamp = rs.getTimestamp(column);
    return timestamp.toInstant().atOffset(ZoneOffset.UTC);
  }

  private static UUID optionalUuid(String value) {
    return value == null || value.isBlank() ? null : UUID.fromString(value);
  }

  private static String env(String name, String fallback) {
    String value = System.getenv(name);
    return value == null || value.isBlank() ? fallback : value;
  }

  private record TelemetryRow(
      UUID readingId,
      UUID sensorMessageId,
      UUID projectId,
      UUID pondId,
      UUID projectSensorId,
      String port,
      OffsetDateTime measuredAt,
      String readingValues,
      UUID iotDeviceId,
      String deviceCode,
      long seqNo,
      String payload) {}
}
