package com.aquashield.sensor.service;

import com.aquashield.sensor.api.dto.SensorDtos.CreateMappingRequest;
import com.aquashield.sensor.api.dto.SensorDtos.CreateSensorTypeRequest;
import com.aquashield.sensor.api.dto.SensorDtos.DeviceDto;
import com.aquashield.sensor.api.dto.SensorDtos.ProjectSensorDto;
import com.aquashield.sensor.api.dto.SensorDtos.RegisterDeviceRequest;
import com.aquashield.sensor.api.dto.SensorDtos.SensorTypeDto;
import com.aquashield.sensor.api.dto.SensorDtos.UpdateDeviceRequest;
import com.aquashield.sensor.api.dto.SensorDtos.UpdateMappingRequest;
import com.aquashield.sensor.domain.IoTDevice;
import com.aquashield.sensor.domain.ProjectSensor;
import com.aquashield.sensor.domain.SensorType;
import com.aquashield.sensor.events.SensorEventPublisher;
import com.aquashield.sensor.repo.Repositories.IoTDeviceRepository;
import com.aquashield.sensor.repo.Repositories.ProjectSensorRepository;
import com.aquashield.sensor.repo.Repositories.SensorTypeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Registry + mapping rules (spec: main/sensor_service.md; rules from the monolith's
 * admin forms — the only validation layer that existed).
 */
@Service
public class SensorRegistryService {

  private final SensorTypeRepository sensorTypes;
  private final IoTDeviceRepository devices;
  private final ProjectSensorRepository mappings;
  private final SensorEventPublisher events;
  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;

  public SensorRegistryService(SensorTypeRepository sensorTypes, IoTDeviceRepository devices,
                               ProjectSensorRepository mappings, SensorEventPublisher events,
                               StringRedisTemplate redis, ObjectMapper mapper) {
    this.sensorTypes = sensorTypes;
    this.devices = devices;
    this.mappings = mappings;
    this.events = events;
    this.redis = redis;
    this.mapper = mapper;
  }

  // ---------- sensor types ----------

  @Transactional(readOnly = true)
  public List<SensorTypeDto> listSensorTypes() {
    return sensorTypes.findAllByOrderByNameAsc().stream().map(SensorTypeDto::from).toList();
  }

  @Transactional
  public SensorTypeDto createSensorType(CreateSensorTypeRequest req) {
    // PARITY (forms.py clean_parameter_ids + DB CHECK): >= 1 parameter
    if (req.parameterIds() == null || req.parameterIds().isEmpty()) {
      throw new BadRequest("Select at least one parameter.");
    }
    SensorType s = new SensorType();
    s.setName(req.name());
    s.setModelNumber(req.modelNumber());
    s.setParameterIds(req.parameterIds());
    s.setManufacturer(req.manufacturer());
    s.setDescription(req.description());
    return SensorTypeDto.from(sensorTypes.save(s));
  }

  // ---------- devices ----------

  @Transactional(readOnly = true)
  public List<DeviceDto> listDevices() {
    return devices.findAllByOrderByDeviceCodeAsc().stream().map(DeviceDto::from).toList();
  }

  @Transactional
  public DeviceDto registerDevice(RegisterDeviceRequest req, UUID actingUserId) {
    if (devices.existsByDeviceCode(req.deviceCode())) {
      throw new BadRequest("A device with this device_code already exists.");
    }
    IoTDevice d = new IoTDevice();
    d.setDeviceCode(req.deviceCode());
    d.setDeviceName(req.deviceName());
    d.setConfig(req.config() != null ? req.config() : mapper.createObjectNode());
    d.setDeviceKey(req.deviceKey());
    d.setCreatedBy(actingUserId);
    d.setUpdatedBy(actingUserId);
    d = devices.save(d);
    events.publish(SensorEventPublisher.TOPIC_DEVICE_REGISTERED, null,
        mapper.createObjectNode().put("deviceCode", d.getDeviceCode()));
    return DeviceDto.from(d);
  }

  @Transactional
  public DeviceDto updateDevice(UUID deviceId, UpdateDeviceRequest req, UUID actingUserId) {
    IoTDevice d = devices.findById(deviceId).orElseThrow(NotFound::new);
    boolean statusChanged = false;
    if (req.deviceName() != null && !req.deviceName().isBlank()) {
      d.setDeviceName(req.deviceName());
    }
    if (req.status() != null) {
      if (!IoTDevice.STATUSES.contains(req.status())) {
        throw new BadRequest("Invalid status. Must be one of: online, offline, maintenance");
      }
      statusChanged = !req.status().equals(d.getStatus());
      d.setStatus(req.status());
    }
    if (req.config() != null) {
      d.setConfig(req.config());
    }
    if (req.isActive() != null) {
      d.setActive(req.isActive());
    }
    if (req.deviceKey() != null) {
      d.setDeviceKey(req.deviceKey());
      invalidateDeviceMap(d.getDeviceCode()); // credential rotation -> resolution cache out
    }
    d.setUpdatedBy(actingUserId);
    if (req.isActive() != null) {
      invalidateDeviceMap(d.getDeviceCode()); // active gate affects resolution
    }
    if (statusChanged) {
      events.publish(SensorEventPublisher.TOPIC_DEVICE_STATUS_CHANGED, null,
          mapper.createObjectNode().put("deviceCode", d.getDeviceCode()).put("status", d.getStatus()));
    }
    return DeviceDto.from(d);
  }

  // ---------- project sensor mappings ----------

  @Transactional(readOnly = true)
  public List<ProjectSensorDto> listMappings(UUID projectId) {
    return mappings.findByProjectIdOrderBySerialNumberAsc(projectId).stream()
        .map(ProjectSensorDto::from).toList();
  }

  @Transactional
  public ProjectSensorDto createMapping(UUID projectId, CreateMappingRequest req, UUID actingUserId) {
    SensorType sensorType = sensorTypes.findById(req.sensorTypeId())
        .orElseThrow(() -> new BadRequest("Unknown sensor_type_id"));
    if (mappings.existsBySerialNumber(req.serialNumber())) {
      throw new BadRequest("A sensor with this serial_number already exists.");
    }
    ProjectSensor p = new ProjectSensor();
    p.setProjectId(projectId);
    p.setPondId(req.pondId());
    p.setSensorType(sensorType);
    p.setSerialNumber(req.serialNumber());
    p.setInstalledAt(req.installedAt());
    p.setSensorLocation(req.sensorLocation());
    p.setCreatedBy(actingUserId);
    p.setUpdatedBy(actingUserId);
    attachDevice(p, req.deviceCode(), req.port());
    p = mappings.save(p);
    if (p.getIotDevice() != null) {
      invalidateDeviceMap(p.getIotDevice().getDeviceCode());
    }
    events.publish(SensorEventPublisher.TOPIC_MAPPING_ASSIGNED, projectId,
        mapper.createObjectNode().put("projectSensorId", p.getProjectSensorId().toString()));
    return ProjectSensorDto.from(p);
  }

  @Transactional
  public ProjectSensorDto updateMapping(UUID projectSensorId, UpdateMappingRequest req,
                                        UUID actingUserId) {
    ProjectSensor p = mappings.findById(projectSensorId).orElseThrow(NotFound::new);
    String oldDeviceCode = p.getIotDevice() == null ? null : p.getIotDevice().getDeviceCode();
    if (req.deviceCode() != null || req.port() != null) {
      String code = req.deviceCode() != null ? req.deviceCode() : oldDeviceCode;
      String port = req.port() != null ? req.port() : p.getPort();
      attachDevice(p, code, port);
    }
    if (req.status() != null) {
      if (!ProjectSensor.STATUSES.contains(req.status())) {
        throw new BadRequest("Invalid status. Must be one of: active, inactive, maintenance");
      }
      p.setStatus(req.status());
    }
    if (req.installedAt() != null) {
      p.setInstalledAt(req.installedAt());
    }
    if (req.sensorLocation() != null) {
      p.setSensorLocation(req.sensorLocation());
    }
    p.setUpdatedBy(actingUserId);
    if (oldDeviceCode != null) {
      invalidateDeviceMap(oldDeviceCode);
    }
    if (p.getIotDevice() != null) {
      invalidateDeviceMap(p.getIotDevice().getDeviceCode());
    }
    events.publish(SensorEventPublisher.TOPIC_MAPPING_UPDATED, p.getProjectId(),
        mapper.createObjectNode().put("projectSensorId", p.getProjectSensorId().toString()));
    return ProjectSensorDto.from(p);
  }

  /** PARITY rules: port required when device attached; (device,port) unique ANY status. */
  private void attachDevice(ProjectSensor p, String deviceCode, String port) {
    if (deviceCode == null || deviceCode.isBlank()) {
      p.setIotDevice(null);
      p.setPort(port);
      return;
    }
    IoTDevice device = devices.findByDeviceCode(deviceCode)
        .orElseThrow(() -> new BadRequest("Unknown device_code: " + deviceCode));
    if (port == null || port.isBlank()) {
      throw new BadRequest("Port is required when an IoT device is assigned.");
    }
    boolean samePortAlready = p.getIotDevice() != null
        && p.getIotDevice().getIotDeviceId().equals(device.getIotDeviceId())
        && port.equals(p.getPort());
    if (!samePortAlready
        && mappings.existsByIotDeviceIotDeviceIdAndPort(device.getIotDeviceId(), port)) {
      throw new BadRequest(
          "Port '" + port + "' on this device is already used by another sensor.");
    }
    p.setIotDevice(device);
    p.setPort(port);
  }

  /** redis.md key: sensor:device-map:{deviceId} — we key by device_code (the natural key). */
  public void invalidateDeviceMap(String deviceCode) {
    redis.delete("sensor:device-map:" + deviceCode);
  }

  public static class NotFound extends RuntimeException {}

  public static class BadRequest extends RuntimeException {
    public BadRequest(String message) {
      super(message);
    }
  }
}
