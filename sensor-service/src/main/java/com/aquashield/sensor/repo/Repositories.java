package com.aquashield.sensor.repo;

import com.aquashield.sensor.domain.IoTDevice;
import com.aquashield.sensor.domain.ProjectSensor;
import com.aquashield.sensor.domain.SensorType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public final class Repositories {

  private Repositories() {}

  public interface SensorTypeRepository extends JpaRepository<SensorType, UUID> {
    /** PARITY: ordering = name */
    List<SensorType> findAllByOrderByNameAsc();
  }

  public interface IoTDeviceRepository extends JpaRepository<IoTDevice, UUID> {
    Optional<IoTDevice> findByDeviceCode(String deviceCode);

    /** PARITY: THE ingestion gate — device_code + is_active only (status NOT consulted). */
    Optional<IoTDevice> findByDeviceCodeAndActiveTrue(String deviceCode);

    boolean existsByDeviceCode(String deviceCode);

    List<IoTDevice> findAllByOrderByDeviceCodeAsc();
  }

  public interface ProjectSensorRepository extends JpaRepository<ProjectSensor, UUID> {
    /** PARITY: ordering = serial_number */
    List<ProjectSensor> findByProjectIdOrderBySerialNumberAsc(UUID projectId);

    /** PARITY (load_project_sensor_map): only ACTIVE mappings are visible to ingestion. */
    List<ProjectSensor> findByIotDeviceIotDeviceIdAndStatus(UUID iotDeviceId, String status);

    boolean existsBySerialNumber(String serialNumber);

    /** PARITY: binding (device, port) uniqueness regardless of status. */
    boolean existsByIotDeviceIotDeviceIdAndPort(UUID iotDeviceId, String port);
  }
}
