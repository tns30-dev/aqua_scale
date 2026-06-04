package com.aquashield.project;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * AquaShield Project Service.
 *
 * Owns: projects, profile types, parameter catalogue, project parameter settings
 * (thresholds + key indicators), energy settings. First CONSUMER of the platform auth
 * model: JWT verified locally (Identity's public key) + Redis authz snapshot for
 * project ACL — never calls Identity on the hot path.
 *
 * Spec: cooking_tracker/main/project_service.md, authn_authz.md, redis.md
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableJpaRepositories(considerNestedRepositories = true) // repos live in Repositories.*
public class ProjectServiceApplication {

  public static void main(String[] args) {
    SpringApplication.run(ProjectServiceApplication.class, args);
  }
}
