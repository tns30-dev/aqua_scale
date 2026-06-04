package com.aquashield.sensor.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * PARITY (module_sensor.IoTDevice, DB-authoritative): device_code varchar(64) UNIQUE is
 * the natural resolution key; status in {online,offline,maintenance} default 'offline'
 * (NO transition state machine — parity); is_active is THE ingestion gate (status is
 * not consulted); device_key = plaintext HMAC shared secret; config = opaque JSONB.
 */
@Entity
@Table(name = "iot_devices")
public class IoTDevice {

  public static final Set<String> STATUSES = Set.of("online", "offline", "maintenance");

  @Id
  @GeneratedValue
  @Column(name = "iot_device_id")
  private UUID iotDeviceId;

  @Column(name = "device_code", nullable = false, unique = true, length = 64)
  private String deviceCode;

  @Column(name = "device_name", nullable = false)
  private String deviceName;

  @Column(nullable = false)
  private String status = "offline";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private JsonNode config;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @Column(name = "device_key", columnDefinition = "text")
  private String deviceKey;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "created_by")
  private UUID createdBy;

  @UpdateTimestamp
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  @Column(name = "updated_by")
  private UUID updatedBy;

  public UUID getIotDeviceId() { return iotDeviceId; }
  public String getDeviceCode() { return deviceCode; }
  public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
  public String getDeviceName() { return deviceName; }
  public void setDeviceName(String deviceName) { this.deviceName = deviceName; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public JsonNode getConfig() { return config; }
  public void setConfig(JsonNode config) { this.config = config; }
  public boolean isActive() { return active; }
  public void setActive(boolean active) { this.active = active; }
  public String getDeviceKey() { return deviceKey; }
  public void setDeviceKey(String deviceKey) { this.deviceKey = deviceKey; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
  public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
