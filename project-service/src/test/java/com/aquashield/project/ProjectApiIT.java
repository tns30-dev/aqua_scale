package com.aquashield.project;

import com.aquashield.api.ingestion.v1.EnergyHourlyReading;
import com.aquashield.api.ingestion.v1.GetEnergyHourlyReadingsRequest;
import com.aquashield.api.ingestion.v1.GetEnergyHourlyReadingsResponse;
import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.GetReadingsResponse;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.ReadingRow;
import com.aquashield.api.project.v1.ChartConfigEntry;
import com.aquashield.api.project.v1.GetChartConfigRequest;
import com.aquashield.api.project.v1.GetParameterSettingsRequest;
import com.aquashield.api.project.v1.GetProfileTypeRequest;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.api.project.v1.ValidateProjectAccessRequest;
import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.FeatureActionEntry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.google.pubsub.v1.ProjectSubscriptionName;
import com.google.pubsub.v1.PullRequest;
import com.google.pubsub.v1.PushConfig;
import com.google.pubsub.v1.TopicName;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.inprocess.InProcessChannelBuilder;
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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FIRST RESOURCE-SERVICE integration test — proves the designed platform auth model
 * end-to-end (main/authn_authz.md): local JWT verification with Identity's public key +
 * fail-closed Redis snapshot authorization, PLUS parity casing, caches, Pub/Sub events
 * and the gRPC contract.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class ProjectApiIT {

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
  static final String IN_PROCESS = "project-grpc-it";
  static final KeyPair KEYS = generateKeys();
  static ManagedChannel grpcChannel;
  static ManagedChannel pubsubChannel;
  static SubscriberStub subscriberStub;

  static final UUID ADMIN = UUID.randomUUID();
  static final UUID MEMBER = UUID.randomUUID();
  static final UUID OUTSIDER = UUID.randomUUID();

  /** fake Ingestion read seam (energy dashboard): rows keyed by project_id. */
  static final java.util.Map<String, java.util.List<ReadingRow>> READINGS =
      new java.util.concurrent.ConcurrentHashMap<>();
  static io.grpc.Server fakeIngestion;

  static class FakeIngestion extends IngestionReadServiceGrpc.IngestionReadServiceImplBase {
    @Override
    public void getReadings(GetReadingsRequest req,
                            io.grpc.stub.StreamObserver<GetReadingsResponse> obs) {
      // window-filter like the real seam (the energy service queries two periods)
      Instant from = Instant.parse(req.getStart());
      Instant to = Instant.parse(req.getEnd());
      GetReadingsResponse.Builder resp = GetReadingsResponse.newBuilder();
      for (ReadingRow row : READINGS.getOrDefault(req.getProjectId(), java.util.List.of())) {
        Instant at = Instant.parse(row.getMeasuredAt());
        if (!at.isBefore(from) && !at.isAfter(to)) {
          resp.addRows(row);
        }
      }
      obs.onNext(resp.build());
      obs.onCompleted();
    }

    @Override
    public void getEnergyHourlyReadings(GetEnergyHourlyReadingsRequest req,
                                        io.grpc.stub.StreamObserver<GetEnergyHourlyReadingsResponse> obs) {
      Instant from = Instant.parse(req.getStart());
      Instant to = Instant.parse(req.getEnd());
      ZoneId zone = req.getTimezone().isBlank()
          ? ZoneId.of("Asia/Singapore")
          : ZoneId.of(req.getTimezone());
      Map<Instant, Double> hourly = new TreeMap<>();
      for (ReadingRow row : READINGS.getOrDefault(req.getProjectId(), java.util.List.of())) {
        Instant at = Instant.parse(row.getMeasuredAt());
        Double kwh = row.getValuesMap().get("electricity");
        if (kwh == null || at.isBefore(from) || at.isAfter(to)) {
          continue;
        }
        LocalDateTime localHour = ZonedDateTime.ofInstant(at, zone).toLocalDateTime()
            .withMinute(0).withSecond(0).withNano(0);
        Instant bucket = localHour.atZone(zone).toInstant();
        hourly.merge(bucket, kwh, Double::sum);
      }
      GetEnergyHourlyReadingsResponse.Builder resp = GetEnergyHourlyReadingsResponse.newBuilder()
          .setProjectId(req.getProjectId());
      hourly.forEach((hour, total) -> resp.addRows(EnergyHourlyReading.newBuilder()
          .setHourStart(hour.toString())
          .setKwh(total)));
      obs.onNext(resp.build());
      obs.onCompleted();
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) throws Exception {
    fakeIngestion = io.grpc.inprocess.InProcessServerBuilder.forName("project-it-ingestion")
        .addService(new FakeIngestion()).build().start();
    registry.add("aquashield.grpc.ingestion.in-process-name", () -> "project-it-ingestion");
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("spring.cloud.gcp.project-id", () -> GCP_PROJECT);
    registry.add("spring.cloud.gcp.pubsub.emulator-host", pubsub::getEmulatorEndpoint);
    registry.add("aquashield.jwt.public-key-pem", () -> publicPem());
    registry.add("grpc.server.port", () -> -1);
    registry.add("grpc.server.in-process-name", () -> IN_PROCESS);
  }

  @BeforeAll
  static void createTopics() throws Exception {
    pubsubChannel = ManagedChannelBuilder.forTarget(pubsub.getEmulatorEndpoint())
        .usePlaintext().build();
    var channelProvider = FixedTransportChannelProvider.create(
        GrpcTransportChannel.create(pubsubChannel));
    try (TopicAdminClient topics = TopicAdminClient.create(TopicAdminSettings.newBuilder()
        .setTransportChannelProvider(channelProvider)
        .setCredentialsProvider(NoCredentialsProvider.create()).build());
         SubscriptionAdminClient subs = SubscriptionAdminClient.create(
             SubscriptionAdminSettings.newBuilder()
                 .setTransportChannelProvider(channelProvider)
                 .setCredentialsProvider(NoCredentialsProvider.create()).build())) {
      for (String t : List.of("project.created", "project.updated", "project.settings.updated")) {
        topics.createTopic(TopicName.of(GCP_PROJECT, t));
      }
      subs.createSubscription(
          ProjectSubscriptionName.of(GCP_PROJECT, "it.project.settings.updated.sub"),
          TopicName.of(GCP_PROJECT, "project.settings.updated"),
          PushConfig.getDefaultInstance(), 30);
    }
    subscriberStub = GrpcSubscriberStub.create(SubscriberStubSettings.newBuilder()
        .setTransportChannelProvider(channelProvider)
        .setCredentialsProvider(NoCredentialsProvider.create()).build());
  }

  @AfterAll
  static void shutdown() {
    if (grpcChannel != null) {
      grpcChannel.shutdownNow();
    }
    if (fakeIngestion != null) {
      fakeIngestion.shutdownNow();
    }
    if (subscriberStub != null) {
      subscriberStub.close();
    }
    if (pubsubChannel != null) {
      pubsubChannel.shutdownNow();
    }
  }

  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper json;
  @Autowired StringRedisTemplate redisTemplate;
  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

  // ---------- auth helpers (simulating Identity's outputs) ----------

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

  void putSnapshot(UUID userId, long version, String role, List<UUID> projectIds) throws Exception {
    Instant now = Instant.now();
    AuthzSnapshot snapshot = new AuthzSnapshot(userId, version, role,
        List.of(FeatureActionEntry.wildcard()), projectIds, Map.of(), Map.of(), List.of(),
        now, now.plus(Duration.ofHours(12)));
    redisTemplate.opsForValue().set("authz:snapshot:" + userId + ":" + version,
        json.writeValueAsString(snapshot), Duration.ofHours(12));
    redisTemplate.opsForValue().set("authz:version:" + userId, String.valueOf(version));
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

  static UUID createdProjectId; // shared across ordered tests

  // ---------- tests ----------

  @Test
  void t01_noToken_is401() {
    assertThat(call("/api/projects", HttpMethod.GET, null, null).get("status").asInt())
        .isEqualTo(401);
  }

  @Test
  void t02_validToken_butNoSnapshot_failsClosed401() {
    // THE designed fail-closed behavior: JWT is valid but the snapshot is missing
    String token = mintToken(UUID.randomUUID(), "user", 7);
    assertThat(call("/api/projects", HttpMethod.GET, null, token).get("status").asInt())
        .isEqualTo(401);
  }

  @Test
  void t03_profileTypes_parityShape() throws Exception {
    putSnapshot(MEMBER, 1, "user", List.of());
    String token = mintToken(MEMBER, "user", 1);
    JsonNode r = call("/api/profile-types", HttpMethod.GET, null, token);
    assertThat(r.get("status").asInt()).isEqualTo(200);
    JsonNode b = r.get("body");
    assertThat(b.isArray()).isTrue(); // PARITY: flat array, no pagination wrapper
    // PARITY: ordered by code
    assertThat(b.get(0).get("code").asText()).isEqualTo("crab_hatchery");
    assertThat(b.get(3).get("code").asText()).isEqualTo("treatment");
    // PARITY: snake_case top-level keys; camelCase INSIDE stage_config
    JsonNode shrimp = b.get(2);
    assertThat(shrimp.get("code").asText()).isEqualTo("shrimp");
    assertThat(shrimp.has("profile_type_id")).isTrue();
    assertThat(shrimp.at("/stage_config/0/startDay").asInt()).isEqualTo(1);
    assertThat(shrimp.at("/key_parameter_indicators/0").asText()).isEqualTo("temperature");
    assertThat(shrimp.at("/theme/primary").asText()).isEqualTo("#888888");
    // catalogue cached in Redis
    assertThat(redisTemplate.hasKey("project:catalogue:profile-types")).isTrue();
  }

  @Test
  void t04_adminCreatesProject_memberSeesIt_outsiderGets404() throws Exception {
    putSnapshot(ADMIN, 1, "platform_admin", List.of());
    String admin = mintToken(ADMIN, "platform_admin", 1);
    JsonNode profiles = call("/api/profile-types", HttpMethod.GET, null, admin).get("body");
    String profileTypeId = profiles.get(2).get("profile_type_id").asText(); // shrimp

    JsonNode created = call("/api/projects", HttpMethod.POST,
        Map.of("name", "Demo Farm", "profileTypeId", profileTypeId), admin);
    assertThat(created.get("status").asInt()).isEqualTo(201);
    createdProjectId = UUID.fromString(created.at("/body/project_id").asText());
    assertThat(created.at("/body/profile_type/code").asText()).isEqualTo("shrimp");

    // member with project in snapshot: list + detail OK
    putSnapshot(MEMBER, 2, "user", List.of(createdProjectId));
    String member = mintToken(MEMBER, "user", 2);
    JsonNode list = call("/api/projects", HttpMethod.GET, null, member);
    assertThat(list.at("/body/0/project_id").asText()).isEqualTo(createdProjectId.toString());
    assertThat(call("/api/projects/" + createdProjectId, HttpMethod.GET, null, member)
        .get("status").asInt()).isEqualTo(200);

    // outsider (valid snapshot, no membership): PARITY 404 {"detail":"Not found."}
    putSnapshot(OUTSIDER, 1, "user", List.of());
    String outsider = mintToken(OUTSIDER, "user", 1);
    JsonNode denied = call("/api/projects/" + createdProjectId, HttpMethod.GET, null, outsider);
    assertThat(denied.get("status").asInt()).isEqualTo(404);
    assertThat(denied.at("/body/detail").asText()).isEqualTo("Not found.");
  }

  @Test
  void t05_allEndpoint_adminOnly_camelCase() {
    String member = mintToken(MEMBER, "user", 2);
    assertThat(call("/api/projects/all", HttpMethod.GET, null, member).get("status").asInt())
        .isEqualTo(403);
    String admin = mintToken(ADMIN, "platform_admin", 1);
    JsonNode r = call("/api/projects/all", HttpMethod.GET, null, admin);
    assertThat(r.get("status").asInt()).isEqualTo(200);
    // PARITY: camelCase flat item
    assertThat(r.at("/body/0").has("projectId")).isTrue();
    assertThat(r.at("/body/0/profileType").asText()).isEqualTo("shrimp");
  }

  @Test
  void t06_parameterSettings_putUpsert_invalidatesCache_publishesEvent() throws Exception {
    String member = mintToken(MEMBER, "user", 2);
    // pre-populate the settings cache key to prove invalidation
    redisTemplate.opsForValue().set("project:parameters:" + createdProjectId, "stale");

    JsonNode put = call("/api/projects/" + createdProjectId + "/parameter-settings",
        HttpMethod.PUT,
        List.of(Map.of("parameter_code", "ph", "min_threshold", 6.5, "max_threshold", 9.0,
            "is_key_parameter", true)),
        member);
    assertThat(put.get("status").asInt()).isEqualTo(200);
    assertThat(put.at("/body/0/parameter_code").asText()).isEqualTo("ph");
    assertThat(put.at("/body/0/is_key_parameter").asBoolean()).isTrue();

    // cache invalidated (main/redis.md invalidation pair)
    assertThat(redisTemplate.hasKey("project:parameters:" + createdProjectId)).isFalse();

    // event published with the canonical envelope
    var pull = subscriberStub.pullCallable().call(PullRequest.newBuilder()
        .setSubscription(
            ProjectSubscriptionName.of(GCP_PROJECT, "it.project.settings.updated.sub").toString())
        .setMaxMessages(5).build());
    assertThat(pull.getReceivedMessagesCount()).isGreaterThanOrEqualTo(1);
    JsonNode envelope = json.readTree(
        pull.getReceivedMessages(0).getMessage().getData().toStringUtf8());
    assertThat(envelope.get("eventType").asText()).isEqualTo("project.settings.updated");
    assertThat(envelope.get("projectId").asText()).isEqualTo(createdProjectId.toString());
    assertThat(envelope.get("eventId").asText()).isNotBlank();
    assertThat(envelope.get("schemaVersion").asText()).isEqualTo("v1");
  }

  @Test
  void t07_energySettings_mergeUpsert() {
    String member = mintToken(MEMBER, "user", 2);
    String base = "/api/projects/" + createdProjectId + "/energy/settings";

    // PARITY: defaults with exists:false before any row
    JsonNode defaults = call(base, HttpMethod.GET, null, member);
    assertThat(defaults.at("/body/exists").asBoolean()).isFalse();
    assertThat(defaults.at("/body/tariffPerUnit").asDouble()).isZero();
    assertThat(defaults.at("/body/currency").asText()).isEqualTo("USD");

    // create with currency EUR
    call(base, HttpMethod.PUT, Map.of("tariffPerUnit", 0.12, "currency", "EUR"), member);
    // PARITY oracle: second PUT with tariff ONLY must keep currency EUR (merge)
    JsonNode merged = call(base, HttpMethod.PUT, Map.of("tariffPerUnit", 0.5), member);
    assertThat(merged.at("/body/tariffPerUnit").asDouble()).isEqualTo(0.5);
    assertThat(merged.at("/body/currency").asText()).isEqualTo("EUR");
    assertThat(merged.at("/body/exists").asBoolean()).isTrue();
  }

  @Test
  void t08_energyDashboard_validation_andZeroDataShape() {
    String member = mintToken(MEMBER, "user", 2);
    String base = "/api/projects/" + createdProjectId + "/energy/dashboard";
    assertThat(call(base + "?groupBy=bogus", HttpMethod.GET, null, member).get("status").asInt())
        .isEqualTo(400);
    JsonNode r = call(base, HttpMethod.GET, null, member);
    assertThat(r.get("status").asInt()).isEqualTo(200);
    assertThat(r.at("/body/kpis/totalKwh").asDouble()).isZero();
    assertThat(r.at("/body/kpis/currencySymbol").asText()).isEqualTo("€"); // settings from t07
    assertThat(r.at("/body/kpis/peakHourLabel").asText()).isEqualTo("—");
  }

  @Test
  void t08b_energyDashboard_realReadings_oracle() throws Exception {
    String member = mintToken(MEMBER, "user", 2);
    String base = "/api/projects/" + createdProjectId + "/energy/dashboard";

    // settings: tariff 0.25 USD, hourly threshold 2.0 (t07 left 0.5 EUR — overwrite)
    JsonNode put = call("/api/projects/" + createdProjectId + "/energy/settings",
        HttpMethod.PUT, Map.of("tariffPerUnit", 0.25, "currency", "USD",
            "highHourlyThreshold", 2.0), member);
    assertThat(put.get("status").asInt()).isEqualTo(200);

    // Oracle B.6 (CPython-verified): UTC instants -> Asia/Singapore local hours.
    // current day 2026-06-03: 06:00Z+06:20Z -> 14:00 sum 2.5; 08:00Z -> 16:00 0.5
    // previous day 2026-06-02: 02:00Z -> 10:00 1.0
    READINGS.put(createdProjectId.toString(), List.of(
        ReadingRow.newBuilder().setMeasuredAt("2026-06-02T02:00:00Z")
            .putValues("electricity", 1.0).build(),
        ReadingRow.newBuilder().setMeasuredAt("2026-06-03T06:00:00Z")
            .putValues("electricity", 1.5).build(),
        ReadingRow.newBuilder().setMeasuredAt("2026-06-03T06:20:00Z")
            .putValues("electricity", 1.0).build(),
        ReadingRow.newBuilder().setMeasuredAt("2026-06-03T08:00:00Z")
            .putValues("electricity", 0.5).build()));
    try {
      JsonNode r = call(base + "?groupBy=day&startDate=2026-06-03&endDate=2026-06-03",
          HttpMethod.GET, null, member);
      assertThat(r.get("status").asInt()).isEqualTo(200);
      JsonNode b = r.get("body");

      JsonNode kpis = b.get("kpis");
      assertThat(kpis.get("totalKwh").asDouble()).isEqualTo(3.0);
      assertThat(kpis.get("estimatedCost").asDouble()).isEqualTo(0.75);
      assertThat(kpis.get("tariffPerKwh").asDouble()).isEqualTo(0.25);
      assertThat(kpis.get("currencySymbol").asText()).isEqualTo("$");
      assertThat(kpis.get("avgKwhPerDay").asDouble()).isEqualTo(3.0);
      assertThat(kpis.get("avgKwhPerHour").asDouble()).isEqualTo(0.12); // 0.125 -> even
      assertThat(kpis.get("peakHourKwh").asDouble()).isEqualTo(2.5);
      assertThat(kpis.get("peakHourLabel").asText()).isEqualTo("14:00"); // local +08
      assertThat(kpis.get("changeVsPreviousPct").asDouble()).isEqualTo(200.0);
      assertThat(kpis.get("costChange").asDouble()).isEqualTo(0.5);
      assertThat(kpis.get("compareLabel").asText()).isEqualTo("previous 1 day");

      assertThat(b.get("trend")).hasSize(1);
      assertThat(b.at("/trend/0/label").asText()).isEqualTo("Jun 03");
      assertThat(b.at("/trend/0/current").asDouble()).isEqualTo(3.0);
      assertThat(b.at("/trend/0/previous").asDouble()).isEqualTo(1.0);

      assertThat(b.at("/heatmap/dateLabels/0").asText()).isEqualTo("Jun 03");
      assertThat(b.at("/heatmap/matrix/14/0").asDouble()).isEqualTo(2.5);
      assertThat(b.at("/heatmap/matrix/16/0").asDouble()).isEqualTo(0.5);
      assertThat(b.at("/heatmap/matrix/13/0").isNull()).isTrue(); // empty cell = null
      assertThat(b.at("/heatmap/maxValue").asDouble()).isEqualTo(2.5);

      assertThat(b.get("alerts")).hasSize(1);
      assertThat(b.at("/alerts/0/title").asText()).isEqualTo("High hourly consumption");
      assertThat(b.at("/alerts/0/when").asText()).isEqualTo("Jun 03, 14:00");
      assertThat(b.at("/alerts/0/value").asText()).isEqualTo("2.5 kWh");

      JsonNode dq = b.get("dataQuality");
      assertThat(dq.get("expectedRecords").asLong()).isEqualTo(24);
      assertThat(dq.get("availableRecords").asInt()).isEqualTo(2);
      assertThat(dq.get("completenessPct").asDouble()).isEqualTo(8.3);
      assertThat(dq.get("missingPct").asDouble()).isEqualTo(91.7);
      assertThat(dq.get("lastReceived").asText()).isEqualTo("Jun 03, 16:00");

      JsonNode total = b.at("/summary/0");
      assertThat(total.get("current").asText()).isEqualTo("3.00 kWh");
      assertThat(total.get("previous").asText()).isEqualTo("1.00 kWh");
      assertThat(total.get("change").asText()).isEqualTo("200.0% higher");
      assertThat(total.get("improved").asBoolean()).isFalse();
      JsonNode cost = b.at("/summary/3");
      assertThat(cost.get("current").asText()).isEqualTo("$0.75");
      assertThat(cost.get("previous").asText()).isEqualTo("$0.25");

      assertThat(b.at("/byPeriod/title").asText()).isEqualTo("Consumption by Day");
      assertThat(b.at("/byPeriod/rows/0/kwh").asDouble()).isEqualTo(3.0);
      assertThat(b.at("/compareInfo/currentRange").asText()).isEqualTo("Jun 03 – Jun 03, 2026");
      assertThat(b.at("/compareInfo/previousRange").asText()).isEqualTo("Jun 02 – Jun 02, 2026");
    } finally {
      READINGS.clear();
    }
  }

  @Test
  void t09_grpcContract() {
    grpcChannel = InProcessChannelBuilder.forName(IN_PROCESS).usePlaintext().build();
    var stub = ProjectServiceGrpc.newBlockingStub(grpcChannel);

    // PARITY: settings keyed by parameter_code with nullable-side flags
    var settings = stub.getParameterSettings(GetParameterSettingsRequest.newBuilder()
        .setProjectId(createdProjectId.toString()).build());
    assertThat(settings.getSettingsCount()).isEqualTo(1);
    var ph = settings.getSettings(0);
    assertThat(ph.getParameterCode()).isEqualTo("ph");
    assertThat(ph.getHasMin()).isTrue();
    assertThat(ph.getMinValue()).isEqualTo(6.5);
    assertThat(ph.getMaxValue()).isEqualTo(9.0);
    assertThat(ph.getKeyParameter()).isTrue();

    var access = stub.validateProjectAccess(ValidateProjectAccessRequest.newBuilder()
        .setProjectId(createdProjectId.toString()).build());
    assertThat(access.getExists()).isTrue();
    assertThat(access.getProfileTypeCode()).isEqualTo("shrimp");

    var profile = stub.getProfileType(GetProfileTypeRequest.newBuilder()
        .setProfileTypeId(
            stub.getProject(com.aquashield.api.project.v1.GetProjectRequest.newBuilder()
                .setProjectId(createdProjectId.toString()).build()).getProfileTypeId())
        .build());
    assertThat(profile.getCode()).isEqualTo("shrimp");
    assertThat(profile.getStageConfigJson()).contains("startDay"); // camelCase passthrough
    assertThat(profile.getKeyParameterCodesList()).contains("temperature");
  }

  @Test
  void t10_grpcChartConfig_enabledRowsOnly_yParametersResolvedToCodes() {
    if (grpcChannel == null) {
      grpcChannel = InProcessChannelBuilder.forName(IN_PROCESS).usePlaintext().build();
    }
    var stub = ProjectServiceGrpc.newBlockingStub(grpcChannel);

    // enabled multi-param chart with y_parameters -> [temperature, ph]
    jdbc.update("""
        INSERT INTO project.project_visualisations
          (project_id, visualisation_type_id, enabled, y_parameters, title)
        SELECT ?::uuid, visualisation_type_id, true,
               ARRAY(SELECT parameter_id FROM project.parameter_types
                     WHERE parameter_code IN ('temperature','ph')),
               'Multi-Parameter Trends'
        FROM project.visualisation_types WHERE name = 'Multi-Parameter Trends'
        """, createdProjectId.toString());
    // enabled stub chart with NULL y_parameters
    jdbc.update("""
        INSERT INTO project.project_visualisations (project_id, visualisation_type_id, enabled)
        SELECT ?::uuid, visualisation_type_id, true
        FROM project.visualisation_types WHERE name = 'Disease Risk Assessment'
        """, createdProjectId.toString());
    // DISABLED chart -> must not appear (engine filters enabled=True)
    jdbc.update("""
        INSERT INTO project.project_visualisations (project_id, visualisation_type_id, enabled)
        SELECT ?::uuid, visualisation_type_id, false
        FROM project.visualisation_types WHERE name = 'Water Quality Index'
        """, createdProjectId.toString());

    var config = stub.getChartConfig(GetChartConfigRequest.newBuilder()
        .setProjectId(createdProjectId.toString()).build());
    assertThat(config.getChartsCount()).isEqualTo(2);
    assertThat(config.getChartsList().stream().map(ChartConfigEntry::getVisualisationName))
        .containsExactlyInAnyOrder("Multi-Parameter Trends", "Disease Risk Assessment");
    var multi = config.getChartsList().stream()
        .filter(c -> c.getVisualisationName().equals("Multi-Parameter Trends"))
        .findFirst().orElseThrow();
    assertThat(multi.getYParameterCodesList())
        .containsExactlyInAnyOrder("temperature", "ph");
    assertThat(multi.getChartType()).isEqualTo("line");
    var disease = config.getChartsList().stream()
        .filter(c -> c.getVisualisationName().equals("Disease Risk Assessment"))
        .findFirst().orElseThrow();
    assertThat(disease.getYParameterCodesList()).isEmpty();
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
