package com.aquashield.pond;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * AquaShield Pond Service.
 *
 * Owns: ponds, growth cycles, daily health timeline, stage metrics, treatments, pond
 * comparison. Profile/stage configuration is fetched from Project Service gRPC
 * (GetProfileType stage_config passthrough); reading-derived analytics are flagged
 * cross-service-dependent.
 *
 * Spec: cooking_tracker/main/pond_service.md
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableJpaRepositories(considerNestedRepositories = true)
public class PondServiceApplication {

  public static void main(String[] args) {
    SpringApplication.run(PondServiceApplication.class, args);
  }
}
