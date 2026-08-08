package com.aquashield.sensor.api.dto;

import com.aquashield.sensor.domain.IoTDevice;
import com.aquashield.sensor.domain.ProjectSensor;
import com.aquashield.sensor.domain.SensorType;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * NET-NEW REST contract (the monolith had NO sensor REST surface — admin-only).
 * Casing: snake_case, matching the monolith's latent SensorTypeSerializer and all
 * payload/db token conventions in this domain.
 */
public final class SensorDtos {

  private SensorDtos() {}

  // ---------- sensor types ----------

  public record SensorTypeDto(
      @JsonProperty("sensor_type_id") UUID sensorTypeId,
      String name,
      @JsonProperty("model_number") String modelNumber,
      @JsonProperty("parameter_ids") List<UUID> parameterIds,
      @JsonProperty("parameter_count") int parameterCount,
      String manufacturer,
      String description,
      @JsonProperty("is_active") boolean isActive) {

    public static SensorTypeDto from(SensorType s) {
      return new SensorTypeDto(s.getSensorTypeId(), s.getName(), s.getModelNumber(),
          s.getParameterIds(), s.getParameterIds() == null ? 0 : s.getParameterIds().size(),
          s.getManufacturer(), s.getDescription(), s.isActive());
    }
  }

  public record CreateSensorTypeRequest(
      @NotBlank String name,
      @JsonProperty("model_number") String modelNumber,
      // PARITY (admin form + DB CHECK): at least one parameter required
      @JsonProperty("parameter_ids") @NotEmpty List<UUID> parameterIds,
      String manufacturer,
      String description) {}

  // ---------- devices ----------

  public record DeviceDto(
      @JsonProperty("iot_device_id") UUID iotDeviceId,
      @JsonProperty("device_code") String deviceCode,
      @JsonProperty("device_name") String deviceName,
      String status,
      JsonNode config,
      @JsonProperty("is_active") boolean isActive,
      @JsonProperty("has_device_key") boolean hasDeviceKey) {

    /** device_key NEVER serialized over REST — gRPC metadata (in-cluster) only. */
    public static DeviceDto from(IoTDevice d) {
      return new DeviceDto(d.getIotDeviceId(), d.getDeviceCode(), d.getDeviceName(),
          d.getStatus(), d.getConfig(), d.isActive(),
          d.getDeviceKey() != null && !d.getDeviceKey().isBlank());
    }
  }

  public record RegisterDeviceRequest(
      @JsonProperty("device_code") @NotBlank @Size(max = 64) String deviceCode,
      @JsonProperty("device_name") @NotBlank String deviceName,
      JsonNode config,
      @JsonProperty("device_key") String deviceKey) {}

  public record UpdateDeviceRequest(
      @JsonProperty("device_name") String deviceName,
      String status,
      JsonNode config,
      @JsonProperty("is_active") Boolean isActive,
      @JsonProperty("device_key") String deviceKey) {}

  // ---------- project sensor mappings ----------

  public record ProjectSensorDto(
      @JsonProperty("project_sensor_id") UUID projectSensorId,
      @JsonProperty("project_id") UUID projectId,
      @JsonProperty("pond_id") UUID pondId,
      @JsonProperty("sensor_type_id") UUID sensorTypeId,
      @JsonProperty("sensor_type_name") String sensorTypeName,
      @JsonProperty("iot_device_id") UUID iotDeviceId,
      @JsonProperty("device_code") String deviceCode,
      String port,
      @JsonProperty("serial_number") String serialNumber,
      String status,
      @JsonProperty("installed_at") LocalDate installedAt,
      @JsonProperty("sensor_location") String sensorLocation) {

    public static ProjectSensorDto from(ProjectSensor p) {
      return new ProjectSensorDto(p.getProjectSensorId(), p.getProjectId(), p.getPondId(),
          p.getSensorType().getSensorTypeId(), p.getSensorType().getName(),
          p.getIotDevice() == null ? null : p.getIotDevice().getIotDeviceId(),
          p.getIotDevice() == null ? null : p.getIotDevice().getDeviceCode(),
          p.getPort(), p.getSerialNumber(), p.getStatus(), p.getInstalledAt(),
          p.getSensorLocation());
    }
  }

  public record CreateMappingRequest(
      @JsonProperty("pond_id") UUID pondId,
      @JsonProperty("sensor_type_id") @NotNull UUID sensorTypeId,
      @JsonProperty("device_code") String deviceCode,
      String port,
      @JsonProperty("serial_number") @NotBlank String serialNumber,
      @JsonProperty("installed_at") LocalDate installedAt,
      @JsonProperty("sensor_location") String sensorLocation) {}

  public record UpdateMappingRequest(
      @JsonProperty("device_code") String deviceCode,
      String port,
      String status,
      @JsonProperty("installed_at") LocalDate installedAt,
      @JsonProperty("sensor_location") String sensorLocation) {}
}
