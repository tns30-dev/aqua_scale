package com.aquashield.sensor.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * PARITY (module_sensor.ProjectSensor): the ingestion routing key — (device, port) maps
 * to AT MOST ONE ProjectSensor regardless of status (partial unique index); port is
 * required when a device is attached; only status='active' mappings are visible to
 * ingestion; sensor_location stored as "(lng,lat)" text — LONGITUDE FIRST.
 * project_id/pond_id are cross-service references (plain UUIDs).
 */
@Entity
@Table(name = "project_sensors")
public class ProjectSensor {

  public static final Set<String> STATUSES = Set.of("active", "inactive", "maintenance");

  @Id
  @GeneratedValue
  @Column(name = "project_sensor_id")
  private UUID projectSensorId;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @Column(name = "pond_id", nullable = false)
  private UUID pondId;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "sensor_type_id")
  private SensorType sensorType;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "iot_device_id")
  private IoTDevice iotDevice;

  @Column(length = 32)
  private String port;

  @Column(length = 128)
  private String serial;

  @Column(name = "serial_number", nullable = false, unique = true)
  private String serialNumber;

  @Column(nullable = false)
  private String status = "active";

  @Column(name = "installed_at")
  private LocalDate installedAt;

  @Column(name = "sensor_location", columnDefinition = "text")
  private String sensorLocation;

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

  public UUID getProjectSensorId() { return projectSensorId; }
  public UUID getProjectId() { return projectId; }
  public void setProjectId(UUID projectId) { this.projectId = projectId; }
  public UUID getPondId() { return pondId; }
  public void setPondId(UUID pondId) { this.pondId = pondId; }
  public SensorType getSensorType() { return sensorType; }
  public void setSensorType(SensorType sensorType) { this.sensorType = sensorType; }
  public IoTDevice getIotDevice() { return iotDevice; }
  public void setIotDevice(IoTDevice iotDevice) { this.iotDevice = iotDevice; }
  public String getPort() { return port; }
  public void setPort(String port) { this.port = port; }
  public String getSerial() { return serial; }
  public void setSerial(String serial) { this.serial = serial; }
  public String getSerialNumber() { return serialNumber; }
  public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public LocalDate getInstalledAt() { return installedAt; }
  public void setInstalledAt(LocalDate installedAt) { this.installedAt = installedAt; }
  public String getSensorLocation() { return sensorLocation; }
  public void setSensorLocation(String sensorLocation) { this.sensorLocation = sensorLocation; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
  public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
