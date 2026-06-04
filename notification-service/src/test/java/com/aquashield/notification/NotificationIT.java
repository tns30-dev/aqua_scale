package com.aquashield.notification;

import com.aquashield.api.project.v1.GetParameterSettingsRequest;
import com.aquashield.api.project.v1.GetParameterSettingsResponse;
import com.aquashield.api.project.v1.ParameterSetting;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.FeatureActionEntry;
import com.aquashield.notification.repo.AlertLogRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.api.gax.core.NoCredentialsProvider;
import com.google.api.gax.grpc.GrpcTransportChannel;
import com.google.api.gax.rpc.FixedTransportChannelProvider;
import com.google.cloud.pubsub.v1.SubscriptionAdminClient;
import com.google.cloud.pubsub.v1.SubscriptionAdminSettings;
import com.google.cloud.pubsub.v1.TopicAdminClient;
import com.google.cloud.pubsub.v1.TopicAdminSettings;
import com.google.cloud.pubsub.v1.stub.GrpcSubscriberStub;
import com.google.cloud.pubsub.v1.stub.SubscriberStub;
import com.google.cloud.pubsub.v1.stub.SubscriberStubSettings;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.pubsub.v1.ProjectSubscriptionName;
import com.google.pubsub.v1.PullRequest;
import com.google.pubsub.v1.PushConfig;
import com.google.pubsub.v1.TopicName;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Server;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.StreamObserver;
import io.jsonwebtoken.Jwts;
import org.awaitility.Awaitility;
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
import org.testcontainers.containers.PubSubEmulatorContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Alert engine + lifecycle IT — every monolith ThresholdService oracle, against a real
 * Pub/Sub emulator + Postgres + Redis + a fake in-process Project gRPC threshold source.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class NotificationIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  @Container
  static final PubSubEmulatorContainer pubsub = new PubSubEmulatorContainer(
      DockerImageName.parse("gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators"));

  static final String GCP_PROJECT = "aquashield-it";
  static final String DEPS = "notification-it-deps";
  static final KeyPair KEYS = generateKeys();
  static final UUID PROJECT = UUID.randomUUID();
  static final UUID POND = UUID.randomUUID();
  static final UUID MEMBER = UUID.randomUUID();

  static Server fakeDeps;
  static ManagedChannel adminChannel;
  static SubscriberStub subscriber;

  /** fake threshold source: temperature[20,30], ph[6.5,8.5], salinity (no sides) */
  static class FakeProject extends ProjectServiceGrpc.ProjectServiceImplBase {
    @Override
    public void getParameterSettings(GetParameterSettingsRequest req,
                                     StreamObserver<GetParameterSettingsResponse> obs) {
      obs.onNext(GetParameterSettingsResponse.newBuilder()
          .setProjectId(req.getProjectId())
          .addSettings(ParameterSetting.newBuilder().setParameterCode("temperature")
              .setMinValue(20).setMaxValue(30).setHasMin(true).setHasMax(true))
          .addSettings(ParameterSetting.newBuilder().setParameterCode("ph")
              .setMinValue(6.5).setMaxValue(8.5).setHasMin(true).setHasMax(true))
          .addSettings(ParameterSetting.newBuilder().setParameterCode("salinity")
              .setHasMin(false).setHasMax(false))
          .build());
      obs.onCompleted();
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) throws Exception {
    fakeDeps = InProcessServerBuilder.forName(DEPS).addService(new FakeProject()).build().start();
    setupPubsub();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("spring.cloud.gcp.project-id", () -> GCP_PROJECT);
    registry.add("spring.cloud.gcp.pubsub.emulator-host", pubsub::getEmulatorEndpoint);
    registry.add("aquashield.jwt.public-key-pem", NotificationIT::publicPem);
    registry.add("aquashield.grpc.project.in-process-name", () -> DEPS);
  }

  static void setupPubsub() throws Exception {
    adminChannel = ManagedChannelBuilder.forTarget(pubsub.getEmulatorEndpoint())
        .usePlaintext().build();
    var provider = FixedTransportChannelProvider.create(GrpcTransportChannel.create(adminChannel));
    try (TopicAdminClient topics = TopicAdminClient.create(TopicAdminSettings.newBuilder()
        .setTransportChannelProvider(provider)
        .setCredentialsProvider(NoCredentialsProvider.create()).build());
         SubscriptionAdminClient subs = SubscriptionAdminClient.create(
             SubscriptionAdminSettings.newBuilder()
                 .setTransportChannelProvider(provider)
                 .setCredentialsProvider(NoCredentialsProvider.create()).build())) {
      for (String t : List.of("reading.ingested", "project.settings.updated",
          "threshold.violated", "alert.created", "alert.resolved", "notification.requested")) {
        topics.createTopic(TopicName.of(GCP_PROJECT, t));
      }
      subs.createSubscription(
          ProjectSubscriptionName.of(GCP_PROJECT, "notification.reading.ingested.sub"),
          TopicName.of(GCP_PROJECT, "reading.ingested"), PushConfig.getDefaultInstance(), 10);
      subs.createSubscription(
          ProjectSubscriptionName.of(GCP_PROJECT, "notification.project.settings.updated.sub"),
          TopicName.of(GCP_PROJECT, "project.settings.updated"), PushConfig.getDefaultInstance(), 10);
      subs.createSubscription(ProjectSubscriptionName.of(GCP_PROJECT, "it.created.sub"),
          TopicName.of(GCP_PROJECT, "alert.created"), PushConfig.getDefaultInstance(), 10);
      subs.createSubscription(ProjectSubscriptionName.of(GCP_PROJECT, "it.resolved.sub"),
          TopicName.of(GCP_PROJECT, "alert.resolved"), PushConfig.getDefaultInstance(), 10);
    }
    subscriber = GrpcSubscriberStub.create(SubscriberStubSettings.newBuilder()
        .setTransportChannelProvider(provider)
        .setCredentialsProvider(NoCredentialsProvider.create()).build());
  }

  @AfterAll
  static void shutdown() throws Exception {
    if (subscriber != null) {
      subscriber.close();
    }
    if (adminChannel != null) {
      adminChannel.shutdownNow();
    }
    if (fakeDeps != null) {
      fakeDeps.shutdownNow();
    }
  }

  @Autowired PubSubTemplate template;
  @Autowired ObjectMapper json;
  @Autowired StringRedisTemplate redisTemplate;
  @Autowired AlertLogRepository alerts;
  @Autowired TestRestTemplate http;

  // ---------- helpers ----------

  void publishReading(Map<String, Object> values) throws Exception {
    ObjectNode envelope = json.createObjectNode();
    envelope.put("eventId", UUID.randomUUID().toString());
    envelope.put("eventType", "reading.ingested");
    envelope.put("correlationId", UUID.randomUUID().toString());
    envelope.put("projectId", PROJECT.toString());
    envelope.put("pondId", POND.toString());
    ObjectNode payload = envelope.putObject("payload");
    payload.put("projectSensorId", UUID.randomUUID().toString());
    payload.put("port", "A1");
    payload.put("measuredAt", Instant.now().toString());
    ObjectNode v = payload.putObject("values");
    values.forEach((k, val) -> {
      if (val instanceof Integer i) {
        v.put(k, i);
      } else {
        v.put(k, ((Number) val).doubleValue());
      }
    });
    template.publish("reading.ingested", json.writeValueAsString(envelope)).get();
  }

  List<JsonNode> drain(String sub) {
    List<JsonNode> out = new ArrayList<>();
    var pull = subscriber.pullCallable().call(PullRequest.newBuilder()
        .setSubscription(ProjectSubscriptionName.of(GCP_PROJECT, sub).toString())
        .setMaxMessages(20).build());
    pull.getReceivedMessagesList().forEach(m -> {
      try {
        out.add(json.readTree(m.getMessage().getData().toStringUtf8()));
      } catch (Exception ignored) {
        // skip
      }
    });
    if (!pull.getReceivedMessagesList().isEmpty()) {
      subscriber.acknowledgeCallable().call(com.google.pubsub.v1.AcknowledgeRequest.newBuilder()
          .setSubscription(ProjectSubscriptionName.of(GCP_PROJECT, sub).toString())
          .addAllAckIds(pull.getReceivedMessagesList().stream()
              .map(com.google.pubsub.v1.ReceivedMessage::getAckId).toList())
          .build());
    }
    return out;
  }

  long activeCount() {
    return alerts.findAll().stream().filter(a -> !a.isAcknowledged() && !a.isResolved()).count();
  }

  static String mint(UUID userId, String role, long version) {
    Instant now = Instant.now();
    return Jwts.builder().subject(userId.toString()).id(UUID.randomUUID().toString())
        .issuer("aquashield-local").audience().add("aquashield-api").and()
        .claim("role", role).claim("authzVersion", version)
        .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(900)))
        .signWith(KEYS.getPrivate(), Jwts.SIG.RS256).compact();
  }

  void putSnapshot(UUID userId, long version, List<UUID> projectIds) throws Exception {
    Instant now = Instant.now();
    AuthzSnapshot snapshot = new AuthzSnapshot(userId, version, "user",
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

  // ---------- tests ----------

  // Oracles #2 (max breach -> critical, exact message), event payload shape
  @Test
  void t01_maxBreach_createsCriticalAlert_withExactMessage() throws Exception {
    publishReading(Map.of("temperature", 31));
    Awaitility.await().atMost(Duration.ofSeconds(20))
        .untilAsserted(() -> assertThat(alerts.count()).isEqualTo(1));
    var a = alerts.findAll().get(0);
    assertThat(a.getSeverity()).isEqualTo("critical");
    assertThat(a.getLogType()).isEqualTo("alert");           // parity mapping
    assertThat(a.getParameter()).isEqualTo("temperature");
    assertThat(a.getMessage()).isEqualTo("temperature exceeded maximum: 31 > 30.0");

    List<JsonNode> created = new ArrayList<>();
    Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
      created.addAll(drain("it.created.sub"));
      assertThat(created).isNotEmpty();
    });
    JsonNode e = created.get(0);
    assertThat(e.get("pondId").asText()).isEqualTo(POND.toString());
    assertThat(e.at("/payload/current_value").asInt()).isEqualTo(31);
    assertThat(e.at("/payload/threshold").asDouble()).isEqualTo(30.0);
    assertThat(e.at("/payload/log_type").asText()).isEqualTo("alert");
  }

  // Oracle #6 — repeated breach dedup (same pond+parameter active)
  @Test
  void t02_repeatedBreach_deduplicated() throws Exception {
    publishReading(Map.of("temperature", 35));
    Thread.sleep(3000);
    assertThat(alerts.count()).isEqualTo(1); // unchanged
  }

  // Oracles #4/#5 (boundary equality OK) + #8/#9/#10 (NULL sides never breach)
  @Test
  void t03_boundaries_andNullSides_neverAlert() throws Exception {
    // boundary == max for ph (8.5) and salinity with no thresholds at all
    publishReading(Map.of("ph", 8.5, "salinity", 99999));
    Thread.sleep(3000);
    assertThat(alerts.count()).isEqualTo(1); // still only the temperature alert
  }

  // Oracle #7 — normalize -> auto-resolve + alert.resolved (new-arch event)
  @Test
  void t04_normalize_autoResolves() throws Exception {
    drain("it.resolved.sub");
    publishReading(Map.of("temperature", 25));
    Awaitility.await().atMost(Duration.ofSeconds(20))
        .untilAsserted(() -> assertThat(activeCount()).isZero());
    var a = alerts.findAll().get(0);
    assertThat(a.isResolved()).isTrue();
    assertThat(a.isAcknowledged()).isFalse(); // parity: only resolved is set

    List<JsonNode> resolved = new ArrayList<>();
    Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
      resolved.addAll(drain("it.resolved.sub"));
      assertThat(resolved.stream().anyMatch(e ->
          e.at("/payload/parameter").asText().equals("temperature"))).isTrue();
    });
  }

  // Oracles #3 (min breach -> warning) + #11 (multi-param) + #15 (no escalation)
  @Test
  void t05_minBreach_multiParam_noEscalation() throws Exception {
    publishReading(Map.of("ph", 5, "temperature", 31));
    Awaitility.await().atMost(Duration.ofSeconds(20))
        .untilAsserted(() -> assertThat(activeCount()).isEqualTo(2));
    var ph = alerts.findAll().stream()
        .filter(a -> "ph".equals(a.getParameter()) && a.isActive()).findFirst().orElseThrow();
    assertThat(ph.getSeverity()).isEqualTo("warning");
    assertThat(ph.getLogType()).isEqualTo("warning");
    assertThat(ph.getMessage()).isEqualTo("ph below minimum: 5 < 6.5");

    // no escalation: active warning for ph + now a MAX breach -> dedup, no new row
    publishReading(Map.of("ph", 9.9));
    Thread.sleep(3000);
    assertThat(alerts.findAll().stream().filter(a -> "ph".equals(a.getParameter())).count())
        .isEqualTo(1);
  }

  // Oracles #14/#16/#17 — REST list shape, acknowledge semantics, ack-then-rebreech
  @Test
  void t06_rest_list_acknowledge_andRebreech() throws Exception {
    putSnapshot(MEMBER, 1, List.of(PROJECT));
    String token = mint(MEMBER, "user", 1);

    JsonNode list = call("/api/alerts?projectId=" + PROJECT, HttpMethod.GET, null, token);
    assertThat(list.get("status").asInt()).isEqualTo(200);
    JsonNode items = list.at("/body/alerts");
    assertThat(items.size()).isEqualTo(2); // active only (temperature + ph)
    assertThat(items.get(0).has("alertId")).isTrue();   // camelCase parity shape
    assertThat(items.get(0).has("pondId")).isTrue();
    assertThat(items.get(0).has("acknowledged")).isTrue();

    // acknowledge the ph alert (oracle 16: exact response, actor from JWT)
    String phAlertId = null;
    for (JsonNode item : items) {
      if (item.get("message").asText().startsWith("ph")) {
        phAlertId = item.get("alertId").asText();
      }
    }
    JsonNode ack = call("/api/alerts/" + phAlertId + "/acknowledge", HttpMethod.POST,
        Map.of("acknowledgedBy", "ignored-by-server"), token);
    assertThat(ack.get("status").asInt()).isEqualTo(200);
    assertThat(ack.at("/body/message").asText()).isEqualTo("Alert acknowledged");
    assertThat(ack.at("/body/alertId").asText()).isEqualTo(phAlertId);

    // oracle 14: acknowledged row is invisible to dedup -> re-breach creates a NEW alert
    publishReading(Map.of("ph", 5.1));
    Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
        assertThat(alerts.findAll().stream().filter(a -> "ph".equals(a.getParameter())).count())
            .isEqualTo(2));

    // outsider sees nothing
    UUID outsider = UUID.randomUUID();
    putSnapshot(outsider, 1, List.of());
    JsonNode empty = call("/api/alerts?projectId=" + PROJECT, HttpMethod.GET, null,
        mint(outsider, "user", 1));
    assertThat(empty.at("/body/alerts").size()).isZero();
  }

  // settings.updated event invalidates the Redis threshold cache (redis.md pair)
  @Test
  void t07_settingsUpdated_invalidatesThresholdCache() throws Exception {
    String key = "notification:threshold:" + PROJECT;
    Awaitility.await().atMost(Duration.ofSeconds(5))
        .untilAsserted(() -> assertThat(redisTemplate.hasKey(key)).isTrue()); // warmed by t01+

    ObjectNode envelope = json.createObjectNode();
    envelope.put("eventId", UUID.randomUUID().toString());
    envelope.put("eventType", "project.settings.updated");
    envelope.put("projectId", PROJECT.toString());
    envelope.set("payload", json.createObjectNode());
    template.publish("project.settings.updated", json.writeValueAsString(envelope)).get();

    Awaitility.await().atMost(Duration.ofSeconds(20))
        .untilAsserted(() -> assertThat(redisTemplate.hasKey(key)).isFalse());
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
