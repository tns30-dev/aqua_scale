package com.aquashield.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * AquaShield Notification Service — threshold evaluation + alert lifecycle.
 *
 * Consumes reading.ingested, evaluates against project parameter thresholds (Project
 * gRPC GetParameterSettings, Redis-cached, invalidated by project.settings.updated),
 * dedups active alerts, auto-resolves on normalization, and publishes
 * threshold.violated / alert.created / alert.resolved / notification.requested.
 *
 * Spec: cooking_tracker/main/notification_service.md; parity: module_notification +
 * ThresholdService (module_data_ingestion).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableJpaRepositories(considerNestedRepositories = true)
public class NotificationServiceApplication {

  public static void main(String[] args) {
    SpringApplication.run(NotificationServiceApplication.class, args);
  }
}
