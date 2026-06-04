package com.aquashield.audit;

import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.FeatureActionEntry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.api.gax.core.NoCredentialsProvider;
import com.google.api.gax.grpc.GrpcTransportChannel;
import com.google.api.gax.rpc.FixedTransportChannelProvider;
import com.google.cloud.pubsub.v1.TopicAdminClient;
import com.google.cloud.pubsub.v1.TopicAdminSettings;
import com.google.cloud.pubsub.v1.SubscriptionAdminClient;
import com.google.cloud.pubsub.v1.SubscriptionAdminSettings;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.pubsub.v1.ProjectSubscriptionName;
import com.google.pubsub.v1.PushConfig;
import com.google.pubsub.v1.TopicName;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.PubSubEmulatorContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

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
import static org.awaitility.Awaitility.await;

/**
 * Audit trail end-to-end (spec: main/audit_service.md Test Checklist):
 * strict audit payload ingestion + idempotency + rejection, business-envelope
 * derivation, admin-only query API, and DB-enforced append-only immutability.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class AuditServiceIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  @Container
  static final PubSubEmulatorContainer pubsub = new PubSubEmulatorContainer(
      DockerImageName.parse("gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators"));

  static final String GCP_PROJECT = "aquashield-test";
  static final KeyPair KEYS = generateKeys();
  static final UUID ADMIN = UUID.randomUUID();
  static final UUID MEMBER = UUID.randomUUID();
  static final UUID PROJECT_ID = UUID.randomUUID();
  static ManagedChannel pubsubChannel;

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("spring.cloud.gcp.project-id", () -> GCP_PROJECT);
    registry.add("spring.cloud.gcp.pubsub.emulator-host", pubsub::getEmulatorEndpoint);
    registry.add("aquashield.jwt.public-key-pem", () -> publicPem());
    // IT consumes the dedicated audit topic + ONE representative business topic
    registry.add("aquashield.audit.audit-subscription", () -> "audit.audit.event.recorded.sub");
    registry.add("aquashield.audit.business-subscriptions", () -> "audit.project.updated.sub");
  }

  @BeforeAll
  static void createTopics() throws Exception {
    pubsubChannel = ManagedChannelBuilder.forTarget(pubsub.getEmulatorEndpoint())
        .usePlaintext().build();
    var provider = FixedTransportChannelProvider.create(
        GrpcTransportChannel.create(pubsubChannel));
    try (TopicAdminClient topics = TopicAdminClient.create(TopicAdminSettings.newBuilder()
        .setTransportChannelProvider(provider)
        .setCredentialsProvider(NoCredentialsProvider.create()).build());
         SubscriptionAdminClient subs = SubscriptionAdminClient.create(
             SubscriptionAdminSettings.newBuilder()
                 .setTransportChannelProvider(provider)
                 .setCredentialsProvider(NoCredentialsProvider.create()).build())) {
      for (String topic : List.of("audit.event.recorded", "project.updated")) {
        topics.createTopic(TopicName.of(GCP_PROJECT, topic));
        subs.createSubscription(
            ProjectSubscriptionName.of(GCP_PROJECT, "audit." + topic + ".sub"),
            TopicName.of(GCP_PROJECT, topic), PushConfig.getDefaultInstance(), 30);
      }
    }
  }

  @AfterAll
  static void shutdown() {
    if (pubsubChannel != null) {
      pubsubChannel.shutdownNow();
    }
  }

  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper json;
  @Autowired StringRedisTemplate redisTemplate;
  @Autowired PubSubTemplate pubsubTemplate;
  @Autowired JdbcTemplate jdbc;

  // ---------- helpers ----------

  static String mintToken(UUID userId, String role, long authzVersion) {
    Instant now = Instant.now();
    return Jwts.builder()
        .subject(userId.toString()).id(UUID.randomUUID().toString())
        .issuer("aquashield-local")
        .audience().add("aquashield-api").and()
        .claim("role", role).claim("authzVersion", authzVersion)
        .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(900)))
        .signWith(KEYS.getPrivate(), Jwts.SIG.RS256)
        .compact();
  }

  void putSnapshot(UUID userId, long version, String role) throws Exception {
    Instant now = Instant.now();
    AuthzSnapshot snapshot = new AuthzSnapshot(userId, version, role,
        List.of(FeatureActionEntry.wildcard()), List.of(PROJECT_ID), Map.of(), Map.of(),
        List.of(), now, now.plus(Duration.ofHours(12)));
    redisTemplate.opsForValue().set("authz:snapshot:" + userId + ":" + version,
        json.writeValueAsString(snapshot), Duration.ofHours(12));
  }

  JsonNode get(String path, String bearer) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (bearer != null) {
      headers.setBearerAuth(bearer);
    }
    ResponseEntity<String> resp =
        http.exchange(path, HttpMethod.GET, new HttpEntity<>(null, headers), String.class);
    try {
      JsonNode node = resp.getBody() == null ? json.createObjectNode() : json.readTree(resp.getBody());
      return json.createObjectNode().put("status", resp.getStatusCode().value()).set("body", node);
    } catch (Exception e) {
      return json.createObjectNode().put("status", resp.getStatusCode().value())
          .set("body", json.createObjectNode().put("raw", resp.getBody()));
    }
  }

  ObjectNode auditPayload(UUID auditId, String eventType, String outcome) {
    ObjectNode payload = json.createObjectNode();
    payload.put("auditId", auditId.toString());
    payload.put("eventType", eventType);
    payload.put("category", "security");
    payload.put("actorUserId", MEMBER.toString());
    payload.put("serviceName", "identity-access-service");
    payload.put("resourceType", "user.session");
    payload.put("action", "login");
    payload.put("outcome", outcome);
    payload.put("occurredAt", Instant.now().toString());
    payload.put("correlationId", UUID.randomUUID().toString());
    payload.put("traceId", "trace-" + auditId);
    payload.putObject("metadata").put("email", "user@example.com");
    return payload;
  }

  void publishEnvelope(String topic, String eventType, String eventId, UUID projectId,
                       JsonNode payload) throws Exception {
    ObjectNode envelope = json.createObjectNode();
    envelope.put("eventId", eventId);
    envelope.put("eventType", eventType);
    envelope.put("schemaVersion", "v1");
    envelope.put("occurredAt", Instant.now().toString());
    envelope.put("publishedAt", Instant.now().toString());
    envelope.put("source",
        topic.equals("audit.event.recorded") ? "identity-access-service" : "project-service");
    envelope.put("correlationId", UUID.randomUUID().toString());
    if (projectId != null) {
      envelope.put("projectId", projectId.toString());
    }
    envelope.set("payload", payload);
    pubsubTemplate.publish(topic, json.writeValueAsString(envelope)).get();
  }

  int countRows() {
    return jdbc.queryForObject("SELECT count(*) FROM audit.audit_events", Integer.class);
  }

  static final UUID LOGIN_AUDIT_ID = UUID.randomUUID();
  static final String BUSINESS_EVENT_ID = UUID.randomUUID().toString();

  // ---------- tests ----------

  @Test
  void t01_validAuditEvent_storedOnce_withFullFieldSet() throws Exception {
    publishEnvelope("audit.event.recorded", "audit.event.recorded", UUID.randomUUID().toString(),
        null, auditPayload(LOGIN_AUDIT_ID, "login.failed", "failure"));
    await().atMost(Duration.ofSeconds(15)).ignoreExceptions().untilAsserted(() -> {
      var row = jdbc.queryForMap(
          "SELECT * FROM audit.audit_events WHERE audit_id = ?::uuid", LOGIN_AUDIT_ID.toString());
      assertThat(row.get("event_type")).isEqualTo("login.failed");
      assertThat(row.get("category")).isEqualTo("security");
      assertThat(row.get("service_name")).isEqualTo("identity-access-service");
      assertThat(row.get("action")).isEqualTo("login");
      assertThat(row.get("outcome")).isEqualTo("failure");
      assertThat(row.get("trace_id")).isEqualTo("trace-" + LOGIN_AUDIT_ID);
      assertThat(row.get("actor_user_id").toString()).isEqualTo(MEMBER.toString());
      assertThat(row.get("recorded_at")).isNotNull();
    });
  }

  @Test
  void t02_duplicateAuditId_isIdempotent() throws Exception {
    int before = countRows();
    publishEnvelope("audit.event.recorded", "audit.event.recorded", UUID.randomUUID().toString(),
        null, auditPayload(LOGIN_AUDIT_ID, "login.failed", "failure")); // same auditId as t01
    Thread.sleep(2000); // give the consumer time to (not) write
    assertThat(countRows()).isEqualTo(before);
  }

  @Test
  void t03_missingRequiredField_isRejected_notStored() throws Exception {
    UUID auditId = UUID.randomUUID();
    ObjectNode missingAction = auditPayload(auditId, "login.failed", "failure");
    missingAction.remove("action");
    publishEnvelope("audit.event.recorded", "audit.event.recorded", UUID.randomUUID().toString(),
        null, missingAction);
    Thread.sleep(2000);
    assertThat(jdbc.queryForObject(
        "SELECT count(*) FROM audit.audit_events WHERE audit_id = ?::uuid",
        Integer.class, auditId.toString())).isZero();
  }

  @Test
  void t04_businessEnvelope_derivedIntoAuditRecord() throws Exception {
    ObjectNode payload = json.createObjectNode().put("name", "Pond Farm A");
    publishEnvelope("project.updated", "project.updated", BUSINESS_EVENT_ID, PROJECT_ID, payload);
    await().atMost(Duration.ofSeconds(15)).ignoreExceptions().untilAsserted(() -> {
      var row = jdbc.queryForMap(
          "SELECT * FROM audit.audit_events WHERE audit_id = ?::uuid", BUSINESS_EVENT_ID);
      assertThat(row.get("event_type")).isEqualTo("project.updated");
      assertThat(row.get("resource_type")).isEqualTo("project");
      assertThat(row.get("action")).isEqualTo("updated");
      assertThat(row.get("outcome")).isEqualTo("success");
      assertThat(row.get("category")).isEqualTo("business");
      assertThat(row.get("service_name")).isEqualTo("project-service");
      assertThat(row.get("project_id").toString()).isEqualTo(PROJECT_ID.toString());
      assertThat(row.get("metadata").toString()).contains("Pond Farm A");
    });
  }

  @Test
  void t05_queryApi_isPlatformAdminOnly() throws Exception {
    assertThat(get("/api/audit/events", null).get("status").asInt()).isEqualTo(401);

    putSnapshot(MEMBER, 1, "member");
    String memberToken = mintToken(MEMBER, "member", 1);
    assertThat(get("/api/audit/events", memberToken).get("status").asInt()).isEqualTo(403);

    putSnapshot(ADMIN, 1, "platform_admin");
    String adminToken = mintToken(ADMIN, "platform_admin", 1);
    JsonNode r = get("/api/audit/events?eventType=login.failed", adminToken);
    assertThat(r.get("status").asInt()).isEqualTo(200);
    assertThat(r.get("body").size()).isEqualTo(1);
    assertThat(r.at("/body/0/auditId").asText()).isEqualTo(LOGIN_AUDIT_ID.toString());
    assertThat(r.at("/body/0/metadata/email").asText()).isEqualTo("user@example.com");
  }

  @Test
  void t06_detailAndTrails() {
    String adminToken = mintToken(ADMIN, "platform_admin", 1);

    JsonNode detail = get("/api/audit/events/" + LOGIN_AUDIT_ID, adminToken);
    assertThat(detail.get("status").asInt()).isEqualTo(200);
    assertThat(detail.at("/body/eventType").asText()).isEqualTo("login.failed");

    JsonNode missing = get("/api/audit/events/" + UUID.randomUUID(), adminToken);
    assertThat(missing.get("status").asInt()).isEqualTo(404);
    assertThat(missing.at("/body/detail").asText()).isEqualTo("Not found.");

    JsonNode project = get("/api/audit/projects/" + PROJECT_ID, adminToken);
    assertThat(project.get("status").asInt()).isEqualTo(200);
    assertThat(project.at("/body/0/auditId").asText()).isEqualTo(BUSINESS_EVENT_ID);

    JsonNode user = get("/api/audit/users/" + MEMBER, adminToken);
    assertThat(user.at("/body/0/actorUserId").asText()).isEqualTo(MEMBER.toString());

    JsonNode security = get("/api/audit/security", adminToken);
    assertThat(security.get("status").asInt()).isEqualTo(200);
    assertThat(security.get("body").size()).isEqualTo(1); // business event excluded
    assertThat(security.at("/body/0/category").asText()).isEqualTo("security");
  }

  @Test
  void t07_appendOnly_isEnforcedByTheDatabase() {
    assertThat(countRows()).isGreaterThan(0);
    org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            jdbc.update("UPDATE audit.audit_events SET outcome = 'tampered'"))
        .hasMessageContaining("append-only");
    org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            jdbc.update("DELETE FROM audit.audit_events"))
        .hasMessageContaining("append-only");
  }

  // ---------- key helpers ----------

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
