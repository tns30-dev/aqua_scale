package com.aquashield.identity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * AquaShield Identity and Access Service.
 *
 * Owns: authentication (JWT access + rotating refresh tokens), users, role types,
 * feature permissions, project access, and the Redis authorization snapshot that all
 * other services consume for hot-path authorization.
 *
 * Spec: cooking_tracker/main/identity_and_access_service.md, authn_authz.md, redis.md
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class IdentityAccessApplication {

  public static void main(String[] args) {
    SpringApplication.run(IdentityAccessApplication.class, args);
  }
}
