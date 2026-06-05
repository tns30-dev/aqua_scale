package com.aquashield.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NEW capability evidence (main/redis.md "Rate-limit demo"): excess login attempts get
 * 429. Separate context: a deliberately low limit would poison the other ITs otherwise.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LoginRateLimitIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("aquashield.events.enabled", () -> false); // no Pub/Sub in this IT
    registry.add("spring.cloud.gcp.project-id", () -> "aquashield-test");
    registry.add("spring.cloud.gcp.pubsub.emulator-host", () -> "localhost:1"); // unused
    registry.add("grpc.server.port", () -> -1);              // no TCP gRPC in this IT
    registry.add("grpc.server.in-process-name", () -> "LoginRateLimitIT");
    registry.add("aquashield.auth.login-rate-limit", () -> 5);
  }

  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper json;

  @Test
  void excessLoginAttempts_areRateLimited() throws Exception {
    int lastStatus = 0;
    for (int i = 0; i < 6; i++) {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      ResponseEntity<String> resp = http.postForEntity("/api/auth/login",
          new HttpEntity<>(Map.of("email", "bruteforce@aquashield.local",
              "password", "wrong" + i), headers),
          String.class);
      lastStatus = resp.getStatusCode().value();
      if (i < 5) {
        assertThat(lastStatus).isEqualTo(401); // attempts within the window: normal failure
      }
      if (i == 5) {
        assertThat(lastStatus).isEqualTo(429);
        JsonNode body = json.readTree(resp.getBody());
        assertThat(body.get("detail").asText()).contains("Too many login attempts");
      }
    }
  }
}
