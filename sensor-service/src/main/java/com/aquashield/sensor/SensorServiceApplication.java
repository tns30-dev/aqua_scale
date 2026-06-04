package com.aquashield.sensor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * AquaShield Sensor Service.
 *
 * Owns: sensor type catalogue, IoT device registry (device_code + HMAC device keys),
 * project sensor mappings (device/port -> project/pond). Serves Ingestion's hot path:
 * gRPC ResolveDevicePort + GetDeviceValidationMetadata.
 *
 * Spec: cooking_tracker/main/sensor_service.md, iot.md, redis.md
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableJpaRepositories(considerNestedRepositories = true)
public class SensorServiceApplication {

  public static void main(String[] args) {
    SpringApplication.run(SensorServiceApplication.class, args);
  }
}
