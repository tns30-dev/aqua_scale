package com.aquashield.sensor;

import com.aquashield.api.sensor.v1.GetDeviceValidationMetadataRequest;
import com.aquashield.api.sensor.v1.ResolveDevicePortRequest;
import com.aquashield.api.sensor.v1.ResolveDeviceRequest;
import com.aquashield.api.sensor.v1.SensorServiceGrpc;
import com.aquashield.api.sensor.v1.UpdateDeviceStatusRequest;
import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.FeatureActionEntry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.grpc.ManagedChannel;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterAll;
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

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Registry + mapping rules + the ingestion-hot-path gRPC contract, parity-oracle driven.
 * Events are enabled=false here (covered by project-service's emulator IT) to keep this
 * suite fast; event publishing is best-effort by design.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class SensorApiIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  static final String IN_PROCESS = "sensor-grpc-it";
  static final KeyPair KEYS = generateKeys();
  static final UUID ADMIN = UUID.randomUUID();
  static final UUID MEMBER = UUID.randomUUID();
  static final UUID PROJECT = UUID.randomUUID();
  static final UUID POND = UUID.randomUUID();
  static ManagedChannel channel;

  static String sensorTypeId;
  static String deviceId;
  static String mappingId;
  static final UUID PARAM_TEMP = UUID.randomUUID();
  static final UUID PARAM_PH = UUID.randomUUID();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("aquashield.jwt.public-key-pem", SensorApiIT::publicPem);
    registry.add("aquashield.events.enabled", () -> false);
    registry.add("spring.cloud.gcp.pubsub.emulator-host", () -> "localhost:1");  // unused
    registry.add("grpc.server.port", () -> -1);
    registry.add("grpc.server.in-process-name", () -> IN_PROCESS);
  }

  @AfterAll
  static void shutdown() {
    if (channel != null) {
      channel.shutdownNow();
    }
  }

  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper json;
  @Autowired StringRedisTemplate redisTemplate;

  static String mint(UUID userId, String role, long version) {
    Instant now = Instant.now();
    return Jwts.builder()
        .subject(userId.toString()).id(UUID.randomUUID().toString())
        .issuer("aquashield-local").audience().add("aquashield-api").and()
        .claim("role", role).claim("authzVersion", version)
        .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(900)))
        .signWith(KEYS.getPrivate(), Jwts.SIG.RS256).compact();
  }

  void putSnapshot(UUID userId, long version, String role, List<UUID> projectIds) throws Exception {
    Instant now = Instant.now();
    AuthzSnapshot snapshot = new AuthzSnapshot(userId, version, role,
        List.of(FeatureActionEntry.wildcard()), projectIds, Map.of(), Map.of(), List.of(),
        now, now.plus(Duration.ofHours(12)));
    redisTemplate.opsForValue().set("authz:snapshot:" + userId + ":" + version,
        json.writeValueAsString(snapshot), Duration.ofHours(12));
  }

  JsonNode call(String path, HttpMethod method, Object body, String bearer) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (bearer != null) {
      headers.setBearerAuth(bearer);
    }
    ResponseEntity<String> resp =
        http.exchange(path, method, new HttpEntity<>(body, headers), String.class);
    try {
      JsonNode node = resp.getBody() == null ? json.createObjectNode() : json.readTree(resp.getBody());
      return json.createObjectNode().put("status", resp.getStatusCode().value()).set("body", node);
    } catch (Exception e) {
      return json.createObjectNode().put("status", resp.getStatusCode().value())
          .set("body", json.createObjectNode().put("raw", resp.getBody()));
    }
  }

  SensorServiceGrpc.SensorServiceBlockingStub stub() {
    if (channel == null) {
      channel = InProcessChannelBuilder.forName(IN_PROCESS).usePlaintext().build();
    }
    return SensorServiceGrpc.newBlockingStub(channel);
  }

  String admin() {
    return mint(ADMIN, "platform_admin", 1);
  }

  // ---------- tests ----------

  @Test
  void t01_authBaseline() throws Exception {
    assertThat(call("/api/sensor-types", HttpMethod.GET, null, null).get("status").asInt())
        .isEqualTo(401);
    putSnapshot(ADMIN, 1, "platform_admin", List.of());
    putSnapshot(MEMBER, 1, "user", List.of(PROJECT));
    // member is not platform admin -> registry writes forbidden
    assertThat(call("/api/iot-devices", HttpMethod.POST,
        Map.of("device_code", "X", "device_name", "X"), mint(MEMBER, "user", 1))
        .get("status").asInt()).isEqualTo(403);
  }

  // Oracle #17 — sensor type requires >=1 parameter
  @Test
  void t02_sensorType_createAndValidation() {
    JsonNode bad = call("/api/sensor-types", HttpMethod.POST,
        Map.of("name", "Empty Probe", "parameter_ids", List.of()), admin());
    assertThat(bad.get("status").asInt()).isEqualTo(400);

    JsonNode ok = call("/api/sensor-types", HttpMethod.POST,
        Map.of("name", "AquaProbe X", "model_number", "APX-1",
            "parameter_ids", List.of(PARAM_TEMP.toString(), PARAM_PH.toString())), admin());
    assertThat(ok.get("status").asInt()).isEqualTo(201);
    assertThat(ok.at("/body/parameter_count").asInt()).isEqualTo(2);
    sensorTypeId = ok.at("/body/sensor_type_id").asText();
  }

  @Test
  void t03_device_register_keyNeverSerialized() {
    JsonNode r = call("/api/iot-devices", HttpMethod.POST,
        Map.of("device_code", "DEV-001", "device_name", "Pond Gateway",
            "device_key", "super-secret-device-key"), admin());
    assertThat(r.get("status").asInt()).isEqualTo(201);
    assertThat(r.at("/body/status").asText()).isEqualTo("offline"); // PARITY: DB default
    assertThat(r.at("/body/has_device_key").asBoolean()).isTrue();
    assertThat(r.get("body").has("device_key")).isFalse(); // secret never over REST
    deviceId = r.at("/body/iot_device_id").asText();

    // duplicate device_code -> 400
    assertThat(call("/api/iot-devices", HttpMethod.POST,
        Map.of("device_code", "DEV-001", "device_name", "Dup"), admin())
        .get("status").asInt()).isEqualTo(400);
  }

  // Oracles #18/#19 — port rules
  @Test
  void t04_mapping_portRules() {
    // port required when device attached
    JsonNode noPort = call("/api/projects/" + PROJECT + "/sensors", HttpMethod.POST,
        Map.of("pond_id", POND.toString(), "sensor_type_id", sensorTypeId,
            "device_code", "DEV-001", "serial_number", "SN-1"), admin());
    assertThat(noPort.get("status").asInt()).isEqualTo(400);
    assertThat(noPort.at("/body/detail").asText())
        .isEqualTo("Port is required when an IoT device is assigned.");

    JsonNode ok = call("/api/projects/" + PROJECT + "/sensors", HttpMethod.POST,
        Map.of("pond_id", POND.toString(), "sensor_type_id", sensorTypeId,
            "device_code", "DEV-001", "port", "A1", "serial_number", "SN-1"), admin());
    assertThat(ok.get("status").asInt()).isEqualTo(201);
    mappingId = ok.at("/body/project_sensor_id").asText();

    // (device, port) clash — ANY status (the binding DB index, stricter than admin form)
    JsonNode clash = call("/api/projects/" + PROJECT + "/sensors", HttpMethod.POST,
        Map.of("pond_id", POND.toString(), "sensor_type_id", sensorTypeId,
            "device_code", "DEV-001", "port", "A1", "serial_number", "SN-2"), admin());
    assertThat(clash.get("status").asInt()).isEqualTo(400);
  }

  @Test
  void t05_memberRead_outsider404() throws Exception {
    JsonNode r = call("/api/projects/" + PROJECT + "/sensors", HttpMethod.GET, null,
        mint(MEMBER, "user", 1));
    assertThat(r.get("status").asInt()).isEqualTo(200);
    assertThat(r.at("/body/0/serial_number").asText()).isEqualTo("SN-1");
    assertThat(r.at("/body/0/device_code").asText()).isEqualTo("DEV-001");

    UUID outsider = UUID.randomUUID();
    putSnapshot(outsider, 1, "user", List.of());
    assertThat(call("/api/projects/" + PROJECT + "/sensors", HttpMethod.GET, null,
        mint(outsider, "user", 1)).get("status").asInt()).isEqualTo(404);
  }

  // Oracles #1/#2/#3 — ResolveDevice gates
  @Test
  void t06_grpc_resolveDevice_gates() {
    var device = stub().resolveDevice(
        ResolveDeviceRequest.newBuilder().setDeviceCode("DEV-001").build());
    assertThat(device.getDeviceId()).isEqualTo(deviceId);

    // unknown -> NOT_FOUND with the EXACT monolith message
    assertThatThrownBy(() -> stub().resolveDevice(
        ResolveDeviceRequest.newBuilder().setDeviceCode("DEV-X").build()))
        .isInstanceOfSatisfying(StatusRuntimeException.class, e -> {
          assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.NOT_FOUND);
          assertThat(e.getStatus().getDescription())
              .isEqualTo("Unknown or Inactive IoT device - 'DEV-X'.");
        });

    // inactive -> INDISTINGUISHABLE from unknown (parity)
    call("/api/iot-devices/" + deviceId, HttpMethod.PATCH, Map.of("is_active", false), admin());
    assertThatThrownBy(() -> stub().resolveDevice(
        ResolveDeviceRequest.newBuilder().setDeviceCode("DEV-001").build()))
        .isInstanceOfSatisfying(StatusRuntimeException.class, e ->
            assertThat(e.getStatus().getDescription())
                .isEqualTo("Unknown or Inactive IoT device - 'DEV-001'."));
    call("/api/iot-devices/" + deviceId, HttpMethod.PATCH, Map.of("is_active", true), admin());
  }

  // Oracles #4/#5 — port resolution, active-only visibility, cache invalidation
  @Test
  void t07_grpc_resolveDevicePort_andCacheInvalidation() {
    var found = stub().resolveDevicePort(ResolveDevicePortRequest.newBuilder()
        .setDeviceCode("DEV-001").setPort("A1").build());
    assertThat(found.getFound()).isTrue();
    assertThat(found.getProjectId()).isEqualTo(PROJECT.toString());
    assertThat(found.getPondId()).isEqualTo(POND.toString());
    assertThat(found.getParameterTypeIdsList())
        .containsExactlyInAnyOrder(PARAM_TEMP.toString(), PARAM_PH.toString());

    // resolution result is now cached
    assertThat(redisTemplate.hasKey("sensor:device-map:DEV-001")).isTrue();

    // unknown port -> found=false (caller raises the hard error, parity §2.2)
    assertThat(stub().resolveDevicePort(ResolveDevicePortRequest.newBuilder()
        .setDeviceCode("DEV-001").setPort("Z9").build()).getFound()).isFalse();

    // deactivate mapping -> cache invalidated -> port disappears (oracle #5)
    call("/api/project-sensors/" + mappingId, HttpMethod.PATCH,
        Map.of("status", "inactive"), admin());
    assertThat(redisTemplate.hasKey("sensor:device-map:DEV-001")).isFalse();
    assertThat(stub().resolveDevicePort(ResolveDevicePortRequest.newBuilder()
        .setDeviceCode("DEV-001").setPort("A1").build()).getFound()).isFalse();

    // reactivate -> visible again
    call("/api/project-sensors/" + mappingId, HttpMethod.PATCH,
        Map.of("status", "active"), admin());
    assertThat(stub().resolveDevicePort(ResolveDevicePortRequest.newBuilder()
        .setDeviceCode("DEV-001").setPort("A1").build()).getFound()).isTrue();
  }

  @Test
  void t08_grpc_validationMetadata_andStatusUpdate() {
    var meta = stub().getDeviceValidationMetadata(
        GetDeviceValidationMetadataRequest.newBuilder().setDeviceCode("DEV-001").build());
    assertThat(meta.getKnown()).isTrue();
    assertThat(meta.getActive()).isTrue();
    assertThat(meta.getDeviceKey()).isEqualTo("super-secret-device-key"); // HMAC secret (in-cluster)

    var updated = stub().updateDeviceStatus(UpdateDeviceStatusRequest.newBuilder()
        .setDeviceCode("DEV-001").setStatus("online").build());
    assertThat(updated.getStatus()).isEqualTo("online");

    assertThatThrownBy(() -> stub().updateDeviceStatus(UpdateDeviceStatusRequest.newBuilder()
        .setDeviceCode("DEV-001").setStatus("flying").build()))
        .isInstanceOfSatisfying(StatusRuntimeException.class, e ->
            assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.INVALID_ARGUMENT));
  }

  private static KeyPair generateKeys() {
    try {
      KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
      gen.initialize(2048);
      return gen.generateKeyPair();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static String publicPem() {
    String b64 = Base64.getMimeEncoder(64, "\n".getBytes())
        .encodeToString(KEYS.getPublic().getEncoded());
    return "-----BEGIN PUBLIC KEY-----\n" + b64 + "\n-----END PUBLIC KEY-----";
  }
}
