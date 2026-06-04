package com.aquashield.sensor.domain;

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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * PARITY (module_sensor.SensorType): parameter_ids is a DENORMALIZED uuid[] of
 * ParameterType ids (catalogue owned by Project Service — no junction table, no FK).
 * DB CHECK requires at least one parameter. Catalogue ordering: name.
 */
@Entity
@Table(name = "sensor_types")
public class SensorType {

  @Id
  @GeneratedValue
  @Column(name = "sensor_type_id")
  private UUID sensorTypeId;

  @Column(nullable = false)
  private String name;

  @Column(name = "model_number", unique = true)
  private String modelNumber;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(name = "parameter_ids", nullable = false, columnDefinition = "uuid[]")
  private List<UUID> parameterIds = new ArrayList<>();

  @Column
  private String manufacturer;

  @Column(columnDefinition = "text")
  private String description;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @CreationTimestamp
  @Column(name = "created_at", updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  public UUID getSensorTypeId() { return sensorTypeId; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getModelNumber() { return modelNumber; }
  public void setModelNumber(String modelNumber) { this.modelNumber = modelNumber; }
  public List<UUID> getParameterIds() { return parameterIds; }
  public void setParameterIds(List<UUID> parameterIds) { this.parameterIds = parameterIds; }
  public String getManufacturer() { return manufacturer; }
  public void setManufacturer(String manufacturer) { this.manufacturer = manufacturer; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public boolean isActive() { return active; }
  public void setActive(boolean active) { this.active = active; }
}
