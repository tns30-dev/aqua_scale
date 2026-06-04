package com.aquashield.sensor.grpc;

import com.aquashield.api.sensor.v1.Device;
import com.aquashield.api.sensor.v1.DevicePortMapping;
import com.aquashield.api.sensor.v1.DeviceValidationMetadata;
import com.aquashield.api.sensor.v1.GetDeviceValidationMetadataRequest;
import com.aquashield.api.sensor.v1.GetProjectSensorRequest;
import com.aquashield.api.sensor.v1.ProjectSensor;
import com.aquashield.api.sensor.v1.ResolveDeviceRequest;
import com.aquashield.api.sensor.v1.ResolveDevicePortRequest;
import com.aquashield.api.sensor.v1.SensorServiceGrpc;
import com.aquashield.api.sensor.v1.UpdateDeviceStatusRequest;
import com.aquashield.sensor.domain.IoTDevice;
import com.aquashield.sensor.events.SensorEventPublisher;
import com.aquashield.sensor.repo.Repositories.IoTDeviceRepository;
import com.aquashield.sensor.repo.Repositories.ProjectSensorRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.UUID;

/**
 * Ingestion's HOT PATH (spec: main/sensor_service.md gRPC checklist; parity:
 * IngestionService device/port resolution):
 *  - ResolveDevice: device_code + is_active gate; unknown and inactive are
 *    INDISTINGUISHABLE (same NOT_FOUND, parity with the monolith's single error).
 *  - ResolveDevicePort: only status='active' mappings are visible.
 *  - GetDeviceValidationMetadata: HMAC device_key (in-cluster only — mesh mTLS).
 * ResolveDevicePort responses are Redis-cached (sensor:device-map:{code}, TTL) and
 * invalidated by the registry on mapping/device/credential writes.
 */
@Service
public class SensorGrpcService extends SensorServiceGrpc.SensorServiceImplBase {

  /** PARITY: exact monolith error text for unknown-or-inactive devices. */
  static String unknownDeviceMessage(String code) {
    return "Unknown or Inactive IoT device - '" + code + "'.";
  }

  private final IoTDeviceRepository devices;
  private final ProjectSensorRepository mappings;
  private final SensorEventPublisher events;
  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;
  private final Duration deviceMapTtl;

  public SensorGrpcService(IoTDeviceRepository devices, ProjectSensorRepository mappings,
                           SensorEventPublisher events, StringRedisTemplate redis,
                           ObjectMapper mapper,
                           @Value("${aquashield.cache.device-map-ttl:PT10M}") Duration deviceMapTtl) {
    this.devices = devices;
    this.mappings = mappings;
    this.events = events;
    this.redis = redis;
    this.mapper = mapper;
    this.deviceMapTtl = deviceMapTtl;
  }

  @Override
  @Transactional(readOnly = true)
  public void resolveDevice(ResolveDeviceRequest request, StreamObserver<Device> observer) {
    IoTDevice d = devices.findByDeviceCodeAndActiveTrue(request.getDeviceCode()).orElse(null);
    if (d == null) {
      observer.onError(Status.NOT_FOUND
          .withDescription(unknownDeviceMessage(request.getDeviceCode())).asRuntimeException());
      return;
    }
    observer.onNext(Device.newBuilder()
        .setDeviceId(d.getIotDeviceId().toString())
        .setDeviceCode(d.getDeviceCode())
        .setName(d.getDeviceName())
        .setStatus(d.getStatus())
        .build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void resolveDevicePort(ResolveDevicePortRequest request,
                                StreamObserver<DevicePortMapping> observer) {
    // device gate first (parity ordering: ResolveDevice happens before port lookup)
    IoTDevice d = devices.findByDeviceCodeAndActiveTrue(request.getDeviceCode()).orElse(null);
    if (d == null) {
      observer.onError(Status.NOT_FOUND
          .withDescription(unknownDeviceMessage(request.getDeviceCode())).asRuntimeException());
      return;
    }
    // whole port-map per device cached under ONE key (parity: load_project_sensor_map
    // loads the full map once) -> single-key invalidation on registry writes
    String cacheKey = "sensor:device-map:" + d.getDeviceCode();
    java.util.Map<String, String> portMap = readCachedMap(cacheKey);
    if (portMap == null) {
      portMap = new java.util.HashMap<>();
      // PARITY: only ACTIVE mappings are visible to resolution
      for (var ps : mappings.findByIotDeviceIotDeviceIdAndStatus(d.getIotDeviceId(), "active")) {
        if (ps.getPort() == null) {
          continue;
        }
        DevicePortMapping.Builder entry = DevicePortMapping.newBuilder()
            .setFound(true)
            .setProjectSensorId(ps.getProjectSensorId().toString())
            .setProjectId(ps.getProjectId().toString())
            .setPondId(ps.getPondId().toString())
            .setSensorTypeId(ps.getSensorType().getSensorTypeId().toString())
            .setSensorTypeName(ps.getSensorType().getName())
            .setActive(true);
        // PARITY (get_allowed_parameter_names): inactive sensor_type -> EMPTY param set
        if (ps.getSensorType().isActive() && ps.getSensorType().getParameterIds() != null) {
          ps.getSensorType().getParameterIds()
              .forEach(id -> entry.addParameterTypeIds(id.toString()));
        }
        portMap.put(ps.getPort(),
            java.util.Base64.getEncoder().encodeToString(entry.build().toByteArray()));
      }
      writeCachedMap(cacheKey, portMap);
    }
    String encoded = portMap.get(request.getPort());
    if (encoded == null) {
      observer.onNext(DevicePortMapping.newBuilder().setFound(false).build());
      observer.onCompleted();
      return;
    }
    try {
      observer.onNext(DevicePortMapping.parseFrom(java.util.Base64.getDecoder().decode(encoded)));
    } catch (Exception e) {
      observer.onError(Status.INTERNAL.withDescription("Corrupt mapping cache").asRuntimeException());
      return;
    }
    observer.onCompleted();
  }

  private java.util.Map<String, String> readCachedMap(String key) {
    String json = safeGet(key);
    if (json == null) {
      return null;
    }
    try {
      return mapper.readValue(json,
          mapper.getTypeFactory().constructMapType(java.util.HashMap.class, String.class, String.class));
    } catch (Exception e) {
      return null; // unreadable cache -> rebuild from source
    }
  }

  private void writeCachedMap(String key, java.util.Map<String, String> map) {
    try {
      redis.opsForValue().set(key, mapper.writeValueAsString(map), deviceMapTtl);
    } catch (Exception ignored) {
      // best-effort cache
    }
  }

  @Override
  @Transactional(readOnly = true)
  public void getDeviceValidationMetadata(GetDeviceValidationMetadataRequest request,
                                          StreamObserver<DeviceValidationMetadata> observer) {
    IoTDevice d = devices.findByDeviceCode(request.getDeviceCode()).orElse(null);
    DeviceValidationMetadata.Builder resp = DeviceValidationMetadata.newBuilder().setKnown(false);
    if (d != null) {
      resp.setKnown(true)
          .setDeviceId(d.getIotDeviceId().toString())
          .setStatus(d.getStatus())
          .setActive(d.isActive())
          .setDeviceKey(d.getDeviceKey() == null ? "" : d.getDeviceKey());
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getProjectSensor(GetProjectSensorRequest request,
                               StreamObserver<ProjectSensor> observer) {
    try {
      var ps = mappings.findById(UUID.fromString(request.getProjectSensorId())).orElse(null);
      if (ps == null) {
        observer.onError(Status.NOT_FOUND.withDescription("ProjectSensor not found").asRuntimeException());
        return;
      }
      observer.onNext(ProjectSensor.newBuilder()
          .setProjectSensorId(ps.getProjectSensorId().toString())
          .setProjectId(ps.getProjectId().toString())
          .setPondId(ps.getPondId().toString())
          .setDeviceId(ps.getIotDevice() == null ? "" : ps.getIotDevice().getIotDeviceId().toString())
          .setSensorTypeId(ps.getSensorType().getSensorTypeId().toString())
          .setPort(ps.getPort() == null ? "" : ps.getPort())
          .setActive("active".equals(ps.getStatus()))
          .build());
      observer.onCompleted();
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT.withDescription("Invalid id").asRuntimeException());
    }
  }

  @Override
  @Transactional
  public void updateDeviceStatus(UpdateDeviceStatusRequest request,
                                 StreamObserver<Device> observer) {
    IoTDevice d = devices.findByDeviceCode(request.getDeviceCode()).orElse(null);
    if (d == null) {
      observer.onError(Status.NOT_FOUND
          .withDescription(unknownDeviceMessage(request.getDeviceCode())).asRuntimeException());
      return;
    }
    if (!IoTDevice.STATUSES.contains(request.getStatus())) {
      observer.onError(Status.INVALID_ARGUMENT.withDescription("Invalid status").asRuntimeException());
      return;
    }
    d.setStatus(request.getStatus());
    devices.save(d);
    events.publish(SensorEventPublisher.TOPIC_DEVICE_STATUS_CHANGED, null,
        mapper.createObjectNode().put("deviceCode", d.getDeviceCode()).put("status", d.getStatus()));
    observer.onNext(Device.newBuilder()
        .setDeviceId(d.getIotDeviceId().toString())
        .setDeviceCode(d.getDeviceCode())
        .setName(d.getDeviceName())
        .setStatus(d.getStatus())
        .build());
    observer.onCompleted();
  }

  private String safeGet(String key) {
    try {
      return redis.opsForValue().get(key);
    } catch (Exception e) {
      return null;
    }
  }

}
