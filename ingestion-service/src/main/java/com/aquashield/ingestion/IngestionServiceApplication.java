package com.aquashield.ingestion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * AquaShield Ingestion Service — the event-driven heart.
 *
 * Consumes normalized telemetry from Pub/Sub (iot.telemetry.received, published by the
 * AWS Lambda bridge), then runs the parity-ordered pipeline: payload validation -> HMAC
 * (PayloadHmac + Sensor gRPC device key) -> device/port resolution (Sensor gRPC, active
 * gates) -> strict parameter pivot (codes via Project gRPC catalogue) -> idempotent
 * persistence (UNIQUE device+seq) -> reading.ingested events for Notification/Realtime.
 *
 * No REST surface, no JWT — an in-cluster consumer protected by NetworkPolicy/mesh.
 * Spec: cooking_tracker/main/ingestion_service.md, eda.md; parity: module_data_ingestion.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableJpaRepositories(considerNestedRepositories = true)
public class IngestionServiceApplication {

  public static void main(String[] args) {
    SpringApplication.run(IngestionServiceApplication.class, args);
  }
}
