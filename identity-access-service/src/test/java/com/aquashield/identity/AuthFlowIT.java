package com.aquashield.identity;

import com.aquashield.identity.repo.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end auth flows against real Postgres + Redis (Testcontainers).
 * Covers the parity oracles #18-#26 (adapted to the bearer-token divergence) plus the
 * NEW security capabilities: refresh rotation + reuse detection, jti revocation,
 * authz snapshot lifecycle (main/authn_authz.md evidence checklist).
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class AuthFlowIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  static final String ADMIN_EMAIL = "admin@aquashield.local";
  static final String ADMIN_PASSWORD = "AdminBoot123!";

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("BOOTSTRAP_ADMIN_EMAIL", () -> ADMIN_EMAIL);
    registry.add("BOOTSTRAP_ADMIN_PASSWORD", () -> ADMIN_PASSWORD);
    registry.add("aquashield.auth.login-rate-limit", () -> 1000); // not under test here
  }

  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper json;
  @Autowired StringRedisTemplate redisTemplate;
  @Autowired UserRepository users;

  // ---------- helpers ----------

  private JsonNode post(String path, Object body, String bearer) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (bearer != null) {
      headers.setBearerAuth(bearer);
    }
    ResponseEntity<String> resp =
        http.exchange(path, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
    return wrap(resp);
  }

  private JsonNode call(String path, HttpMethod method, Object body, String bearer) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (bearer != null) {
      headers.setBearerAuth(bearer);
    }
    return wrap(http.exchange(path, method, new HttpEntity<>(body, headers), String.class));
  }

  private JsonNode wrap(ResponseEntity<String> resp) {
    try {
      JsonNode node = resp.getBody() == null
          ? json.createObjectNode()
          : (JsonNode) json.readTree(resp.getBody());
      return json.createObjectNode().put("status", resp.getStatusCode().value()).set("body", node);
    } catch (Exception e) {
      return json.createObjectNode().put("status", resp.getStatusCode().value())
          .set("body", json.createObjectNode().put("raw", resp.getBody()));
    }
  }

  private JsonNode loginAdmin() {
    return post("/api/auth/login", Map.of("email", ADMIN_EMAIL, "password", ADMIN_PASSWORD), null);
  }

  // ---------- tests (method-name ordered) ----------

  @Test
  void t01_login_success_returnsParityEnvelope() {
    JsonNode r = loginAdmin();
    assertThat(r.get("status").asInt()).isEqualTo(200);
    JsonNode b = r.get("body");
    assertThat(b.get("token").asText()).isNotBlank();
    assertThat(b.get("refreshToken").asText()).isNotBlank();
    // PARITY: username = computed full name; role string; projects top-level array
    assertThat(b.at("/user/username").asText()).isEqualTo("Platform Admin");
    assertThat(b.at("/user/role").asText()).isEqualTo("platform_admin");
    assertThat(b.get("projects").isArray()).isTrue();
    // PARITY: wildcard sentinel keeps snake_case inner keys on the wire
    assertThat(b.at("/user/featureActionAssigned/0/feature_access").asText()).isEqualTo("*");
    assertThat(b.at("/user/featureActionAssigned/0/action_controls/0").asText()).isEqualTo("*");
  }

  @Test
  void t02_login_failures_returnGeneric401() {
    JsonNode wrongPw = post("/api/auth/login",
        Map.of("email", ADMIN_EMAIL, "password", "nope-nope"), null);
    assertThat(wrongPw.get("status").asInt()).isEqualTo(401);
    assertThat(wrongPw.at("/body/detail").asText())
        .isEqualTo("No active account found with the given credentials");

    JsonNode unknown = post("/api/auth/login",
        Map.of("email", "ghost@aquashield.local", "password", "whatever1"), null);
    assertThat(unknown.get("status").asInt()).isEqualTo(401);
  }

  @Test
  void t03_authzSnapshot_writtenToRedis_withTtl() {
    JsonNode login = loginAdmin();
    UUID adminId = UUID.fromString(login.at("/body/user/userId").asText());
    String version = redisTemplate.opsForValue().get("authz:version:" + adminId);
    assertThat(version).isNotNull();
    String snapKey = "authz:snapshot:" + adminId + ":" + version;
    assertThat(redisTemplate.hasKey(snapKey)).isTrue();
    assertThat(redisTemplate.getExpire(snapKey)).isPositive(); // TTL mandatory
  }

  @Test
  void t04_onboard_defaultsHydrated_andProjectGrants() {
    String admin = loginAdmin().at("/body/token").asText();
    UUID projectId = UUID.randomUUID();
    JsonNode r = post("/api/users", Map.of(
        "email", "Farmer.One@aquashield.local",
        "password", "Password1",
        "firstName", "Farmer",
        "lastName", "One",
        "role", "farm_manager",
        "projectIds", Set.of(projectId.toString())), admin);
    assertThat(r.get("status").asInt()).isEqualTo(201);
    JsonNode b = r.get("body");
    // PARITY: email lowercased; defaults hydrated when featureActionAssigned omitted
    assertThat(b.get("email").asText()).isEqualTo("farmer.one@aquashield.local");
    assertThat(b.get("featureActionAssigned")).isNotEmpty();
    assertThat(b.get("featureActionAssigned").toString()).contains("overview");
    assertThat(b.get("featureActionAssigned").toString()).doesNotContain("user_management");

    // login as the new user: projects contains the granted id; username computed
    JsonNode login = post("/api/auth/login",
        Map.of("email", "farmer.one@aquashield.local", "password", "Password1"), null);
    assertThat(login.get("status").asInt()).isEqualTo(200);
    assertThat(login.at("/body/user/username").asText()).isEqualTo("Farmer One");
    assertThat(login.at("/body/projects/0/projectId").asText()).isEqualTo(projectId.toString());
  }

  @Test
  void t05_onboard_duplicateEmail_caseInsensitive_400() {
    String admin = loginAdmin().at("/body/token").asText();
    JsonNode r = post("/api/users", Map.of(
        "email", "FARMER.ONE@aquashield.local",   // same as t04, different case
        "password", "Password1",
        "firstName", "Dup", "lastName", "User"), admin);
    assertThat(r.get("status").asInt()).isEqualTo(400);
    assertThat(r.at("/body/detail").asText()).isEqualTo("A user with this email already exists.");
  }

  @Test
  void t06_nonAdmin_isForbiddenFromUserManagement() {
    JsonNode login = post("/api/auth/login",
        Map.of("email", "farmer.one@aquashield.local", "password", "Password1"), null);
    String token = login.at("/body/token").asText();
    JsonNode r = call("/api/users", HttpMethod.GET, null, token);
    assertThat(r.get("status").asInt()).isEqualTo(403);
  }

  @Test
  void t07_refresh_rotates_andReuseRevokesFamily() {
    JsonNode login = loginAdmin();
    String refresh1 = login.at("/body/refreshToken").asText();

    JsonNode rot1 = post("/api/auth/refresh", Map.of("refreshToken", refresh1), null);
    assertThat(rot1.get("status").asInt()).isEqualTo(200);
    String refresh2 = rot1.at("/body/refreshToken").asText();
    assertThat(refresh2).isNotEqualTo(refresh1);

    // REUSE the rotated token -> reuse detected -> 401 and whole family revoked
    JsonNode reuse = post("/api/auth/refresh", Map.of("refreshToken", refresh1), null);
    assertThat(reuse.get("status").asInt()).isEqualTo(401);

    // even the newest token of the family is now dead
    JsonNode afterRevoke = post("/api/auth/refresh", Map.of("refreshToken", refresh2), null);
    assertThat(afterRevoke.get("status").asInt()).isEqualTo(401);
  }

  @Test
  void t08_logout_revokesJti_andRefreshFamily() {
    JsonNode login = loginAdmin();
    String token = login.at("/body/token").asText();
    String refresh = login.at("/body/refreshToken").asText();

    JsonNode me = call("/api/auth/me", HttpMethod.GET, null, token);
    assertThat(me.get("status").asInt()).isEqualTo(200);

    JsonNode logout = post("/api/auth/logout", Map.of("refreshToken", refresh), token);
    assertThat(logout.get("status").asInt()).isEqualTo(200);
    assertThat(logout.at("/body/message").asText()).isEqualTo("Logged out successfully");

    // access token dead BEFORE natural expiry (the monolith could not do this)
    JsonNode meAfter = call("/api/auth/me", HttpMethod.GET, null, token);
    assertThat(meAfter.get("status").asInt()).isEqualTo(401);

    // refresh family dead too
    JsonNode refreshAfter = post("/api/auth/refresh", Map.of("refreshToken", refresh), null);
    assertThat(refreshAfter.get("status").asInt()).isEqualTo(401);
  }

  @Test
  void t09_accessUpdate_invalidatesSnapshotVersion() {
    String admin = loginAdmin().at("/body/token").asText();
    JsonNode login = post("/api/auth/login",
        Map.of("email", "farmer.one@aquashield.local", "password", "Password1"), null);
    UUID userId = UUID.fromString(login.at("/body/user/userId").asText());
    long versionBefore = Long.parseLong(redisTemplate.opsForValue().get("authz:version:" + userId));

    JsonNode r = call("/api/users/" + userId + "/access", HttpMethod.PUT,
        Map.of("projectIds", Set.of()), admin);
    assertThat(r.get("status").asInt()).isEqualTo(200);
    assertThat(r.at("/body/projectIds")).isEmpty();

    long versionAfter = Long.parseLong(redisTemplate.opsForValue().get("authz:version:" + userId));
    assertThat(versionAfter).isGreaterThan(versionBefore);
    // old snapshot is gone -> consumers fail closed on stale JWTs
    assertThat(redisTemplate.hasKey("authz:snapshot:" + userId + ":" + versionBefore)).isFalse();
  }

  @Test
  void t10_selfUpdate_changesNameOnly() {
    JsonNode login = post("/api/auth/login",
        Map.of("email", "farmer.one@aquashield.local", "password", "Password1"), null);
    String token = login.at("/body/token").asText();
    JsonNode r = call("/api/auth/me", HttpMethod.PATCH,
        Map.of("firstName", "Renamed"), token);
    assertThat(r.get("status").asInt()).isEqualTo(200);
    assertThat(r.at("/body/user/username").asText()).isEqualTo("Renamed One");
  }

  @Test
  void t11_disabledUser_getsGeneric401() {
    var user = users.findByEmailIgnoreCase("farmer.one@aquashield.local").orElseThrow();
    user.setActive(false);
    users.save(user);
    JsonNode r = post("/api/auth/login",
        Map.of("email", "farmer.one@aquashield.local", "password", "Password1"), null);
    assertThat(r.get("status").asInt()).isEqualTo(401);
    assertThat(r.at("/body/detail").asText())
        .isEqualTo("No active account found with the given credentials");
  }
}
