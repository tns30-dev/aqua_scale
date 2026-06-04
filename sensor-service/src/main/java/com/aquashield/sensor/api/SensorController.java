package com.aquashield.sensor.api;

import com.aquashield.sensor.api.dto.SensorDtos.CreateMappingRequest;
import com.aquashield.sensor.api.dto.SensorDtos.CreateSensorTypeRequest;
import com.aquashield.sensor.api.dto.SensorDtos.DeviceDto;
import com.aquashield.sensor.api.dto.SensorDtos.ProjectSensorDto;
import com.aquashield.sensor.api.dto.SensorDtos.RegisterDeviceRequest;
import com.aquashield.sensor.api.dto.SensorDtos.SensorTypeDto;
import com.aquashield.sensor.api.dto.SensorDtos.UpdateDeviceRequest;
import com.aquashield.sensor.api.dto.SensorDtos.UpdateMappingRequest;
import com.aquashield.sensor.config.SnapshotAuthFilter.SnapshotPrincipal;
import com.aquashield.sensor.service.SensorRegistryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * NET-NEW REST (monolith was Django-admin only). Authz model: hardware/device registry
 * = platform-admin (it was staff-only admin in the monolith); project sensor mapping
 * reads = project member (snapshot ACL, non-member 404), writes = platform admin.
 */
@RestController
public class SensorController {

  private final SensorRegistryService registry;

  public SensorController(SensorRegistryService registry) {
    this.registry = registry;
  }

  // ---------- sensor types ----------

  @GetMapping("/api/sensor-types")
  public List<SensorTypeDto> sensorTypes() {
    return registry.listSensorTypes();
  }

  @PostMapping("/api/sensor-types")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  public SensorTypeDto createSensorType(@Valid @RequestBody CreateSensorTypeRequest body) {
    return registry.createSensorType(body);
  }

  // ---------- devices (admin domain) ----------

  @GetMapping("/api/iot-devices")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public List<DeviceDto> devices() {
    return registry.listDevices();
  }

  @PostMapping("/api/iot-devices")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  public DeviceDto registerDevice(@Valid @RequestBody RegisterDeviceRequest body,
                                  @AuthenticationPrincipal SnapshotPrincipal principal) {
    return registry.registerDevice(body, principal.userId());
  }

  @PatchMapping("/api/iot-devices/{deviceId}")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public DeviceDto updateDevice(@PathVariable UUID deviceId,
                                @RequestBody UpdateDeviceRequest body,
                                @AuthenticationPrincipal SnapshotPrincipal principal) {
    return registry.updateDevice(deviceId, body, principal.userId());
  }

  // ---------- project sensor mappings ----------

  @GetMapping("/api/projects/{projectId}/sensors")
  public List<ProjectSensorDto> projectSensors(@PathVariable UUID projectId,
                                               @AuthenticationPrincipal SnapshotPrincipal principal) {
    if (!principal.hasProjectAccess(projectId) && !principal.isPlatformAdmin()) {
      throw new SensorRegistryService.NotFound(); // membership 404 parity style
    }
    return registry.listMappings(projectId);
  }

  @PostMapping("/api/projects/{projectId}/sensors")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  public ProjectSensorDto createMapping(@PathVariable UUID projectId,
                                        @Valid @RequestBody CreateMappingRequest body,
                                        @AuthenticationPrincipal SnapshotPrincipal principal) {
    return registry.createMapping(projectId, body, principal.userId());
  }

  @PatchMapping("/api/project-sensors/{projectSensorId}")
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public ProjectSensorDto updateMapping(@PathVariable UUID projectSensorId,
                                        @RequestBody UpdateMappingRequest body,
                                        @AuthenticationPrincipal SnapshotPrincipal principal) {
    return registry.updateMapping(projectSensorId, body, principal.userId());
  }
}
