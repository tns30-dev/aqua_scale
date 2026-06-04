package com.aquashield.ingestion.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Demo-store entities (Bigtable is the cloud raw-telemetry target). */
public final class Entities {

  private Entities() {}

  @Entity
  @Table(name = "sensor_messages")
  public static class SensorMessage {

    @Id
    @GeneratedValue
    @Column(name = "sensor_message_id")
    private UUID sensorMessageId;

    @Column(name = "iot_device_id", nullable = false)
    private UUID iotDeviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "seq_no", nullable = false)
    private long seqNo;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode payload;

    @CreationTimestamp
    @Column(name = "received_at", updatable = false)
    private OffsetDateTime receivedAt;

    protected SensorMessage() {}

    public SensorMessage(UUID iotDeviceId, String deviceCode, long seqNo, JsonNode payload) {
      this.iotDeviceId = iotDeviceId;
      this.deviceCode = deviceCode;
      this.seqNo = seqNo;
      this.payload = payload;
    }

    public UUID getSensorMessageId() { return sensorMessageId; }
    public UUID getIotDeviceId() { return iotDeviceId; }
    public long getSeqNo() { return seqNo; }
  }

  @Entity
  @Table(name = "sensor_readings")
  public static class SensorReadingRow {

    @Id
    @GeneratedValue
    @Column(name = "reading_id")
    private UUID readingId;

    @Column(name = "sensor_message_id", nullable = false)
    private UUID sensorMessageId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "pond_id", nullable = false)
    private UUID pondId;

    @Column(name = "project_sensor_id", nullable = false)
    private UUID projectSensorId;

    @Column(nullable = false, length = 32)
    private String port;

    @Column(name = "measured_at", nullable = false)
    private OffsetDateTime measuredAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reading_values", nullable = false)
    private JsonNode readingValues;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    protected SensorReadingRow() {}

    public SensorReadingRow(UUID sensorMessageId, UUID projectId, UUID pondId,
                            UUID projectSensorId, String port, OffsetDateTime measuredAt,
                            JsonNode readingValues) {
      this.sensorMessageId = sensorMessageId;
      this.projectId = projectId;
      this.pondId = pondId;
      this.projectSensorId = projectSensorId;
      this.port = port;
      this.measuredAt = measuredAt;
      this.readingValues = readingValues;
    }

    public UUID getReadingId() { return readingId; }
    public UUID getProjectId() { return projectId; }
    public UUID getPondId() { return pondId; }
    public UUID getProjectSensorId() { return projectSensorId; }
    public String getPort() { return port; }
    public OffsetDateTime getMeasuredAt() { return measuredAt; }
    public JsonNode getReadingValues() { return readingValues; }
  }
}
