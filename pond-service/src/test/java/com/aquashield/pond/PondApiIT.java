package com.aquashield.pond;

import com.aquashield.api.ingestion.v1.GetReadingWindowsRequest;
import com.aquashield.api.ingestion.v1.GetReadingWindowsResponse;
import com.aquashield.api.ingestion.v1.GetPondParameterBucketAveragesRequest;
import com.aquashield.api.ingestion.v1.GetPondParameterBucketAveragesResponse;
import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.GetReadingsResponse;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.PondParameterBucketAverage;
import com.aquashield.api.ingestion.v1.ReadingRow;
import com.aquashield.api.ingestion.v1.ReadingWindow;
import com.aquashield.api.pond.v1.GetCurrentCycleRequest;
import com.aquashield.api.pond.v1.GetPondRequest;
import com.aquashield.api.pond.v1.GetPondSummaryRequest;
import com.aquashield.api.pond.v1.PondServiceGrpc;
import com.aquashield.api.pond.v1.ValidatePondInProjectRequest;
import com.aquashield.api.project.v1.GetProfileTypeRequest;
import com.aquashield.api.project.v1.GetProjectRequest;
import com.aquashield.api.project.v1.ProfileType;
import com.aquashield.api.project.v1.Project;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.FeatureActionEntry;
import com.aquashield.pond.domain.Entities.CycleDailyHealth;
import com.aquashield.pond.domain.Entities.CycleStageMetric;
import com.aquashield.pond.repo.Repos.CycleDailyHealthRepository;
import com.aquashield.pond.repo.Repos.CycleStageMetricRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.grpc.ManagedChannel;
import io.grpc.Server;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.StreamObserver;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DataIntegrityViolationException;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pond domain IT: parity REST shapes/casing, comparison contract, gRPC, DB oracles. */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class PondApiIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  static final String DEPS = "pond-it-deps";
  static final String IN_PROCESS = "pond-grpc-it";
  static final KeyPair KEYS = generateKeys();
  static final UUID ADMIN = UUID.randomUUID();
  static final UUID MEMBER = UUID.randomUUID();
  static final UUID PROJECT = UUID.randomUUID();
  static final UUID PROFILE = UUID.randomUUID();
  static Server fakeDeps;
  static ManagedChannel grpcChannel;

  static String pondId;
  static String cycleId;

  /** fake Project: name + shrimp profile with 3 stages (camelCase startDay/endDay). */
  static class FakeProject extends ProjectServiceGrpc.ProjectServiceImplBase {
    @Override
    public void getProject(GetProjectRequest req, StreamObserver<Project> obs) {
      obs.onNext(Project.newBuilder().setProjectId(req.getProjectId())
          .setName("Demo Farm").setProfileTypeId(PROFILE.toString())
          .setProfileTypeCode("shrimp").build());
      obs.onCompleted();
    }

    @Override
    public void getProfileType(GetProfileTypeRequest req, StreamObserver<ProfileType> obs) {
      obs.onNext(ProfileType.newBuilder().setProfileTypeId(PROFILE.toString())
          .setCode("shrimp").setName("shrimp")
          .setStageConfigJson("[{\"name\":\"Post-Larvae Stocking\",\"startDay\":1,\"endDay\":30},"
              + "{\"name\":\"Growth Phase\",\"startDay\":31,\"endDay\":60}]")
          .build());
      obs.onCompleted();
    }
  }

  /** fake Ingestion read seam: rows registered per pond by the comparison oracle test. */
  static final Map<String, List<ReadingRow>> READINGS = new java.util.concurrent.ConcurrentHashMap<>();

  static class FakeIngestion extends IngestionReadServiceGrpc.IngestionReadServiceImplBase {
    record AggregateKey(String parameter, LocalDateTime bucket) {}

    @Override
    public void getReadings(GetReadingsRequest req, StreamObserver<GetReadingsResponse> obs) {
      obs.onNext(GetReadingsResponse.newBuilder()
          .setPondId(req.getPondId())
          .addAllRows(READINGS.getOrDefault(req.getPondId(), List.of()))
          .build());
      obs.onCompleted();
    }

    @Override
    public void getReadingWindows(GetReadingWindowsRequest req,
                                  StreamObserver<GetReadingWindowsResponse> obs) {
      GetReadingWindowsResponse.Builder resp = GetReadingWindowsResponse.newBuilder();
      for (String id : req.getPondIdsList()) {
        List<ReadingRow> rows = READINGS.get(id);
        if (rows != null && !rows.isEmpty()) {
          resp.addWindows(ReadingWindow.newBuilder().setPondId(id)
              .setFirstAt(rows.get(0).getMeasuredAt())
              .setLastAt(rows.get(rows.size() - 1).getMeasuredAt()));
        }
      }
      obs.onNext(resp.build());
      obs.onCompleted();
    }

    @Override
    public void getPondParameterBucketAverages(GetPondParameterBucketAveragesRequest req,
                                               StreamObserver<GetPondParameterBucketAveragesResponse> obs) {
      Instant from = Instant.parse(req.getStart());
      Instant to = Instant.parse(req.getEnd());
      ZoneId zone = req.getTimezone().isBlank()
          ? ZoneId.of("Asia/Singapore")
          : ZoneId.of(req.getTimezone());
      Set<String> params = new LinkedHashSet<>(req.getParametersList());
      Map<AggregateKey, double[]> totals = new HashMap<>();
      for (ReadingRow row : READINGS.getOrDefault(req.getPondId(), List.of())) {
        Instant at = Instant.parse(row.getMeasuredAt());
        if (at.isBefore(from) || at.isAfter(to)) {
          continue;
        }
        LocalDateTime bucket = aggregateBucket(
            ZonedDateTime.ofInstant(at, zone).toLocalDateTime(), req.getGrouping());
        for (String param : params) {
          Double value = row.getValuesMap().get(param);
          if (value == null) {
            continue;
          }
          double[] stat = totals.computeIfAbsent(new AggregateKey(param, bucket), ignored -> new double[2]);
          stat[0] += value;
          stat[1] += 1;
        }
      }
      GetPondParameterBucketAveragesResponse.Builder resp =
          GetPondParameterBucketAveragesResponse.newBuilder().setPondId(req.getPondId());
      totals.entrySet().stream()
          .sorted(Comparator
              .comparing((Map.Entry<AggregateKey, double[]> entry) -> entry.getKey().parameter())
              .thenComparing(entry -> entry.getKey().bucket()))
          .forEach(entry -> {
            double[] stat = entry.getValue();
            resp.addRows(PondParameterBucketAverage.newBuilder()
                .setPondId(req.getPondId())
                .setParameter(entry.getKey().parameter())
                .setBucketStart(entry.getKey().bucket().atZone(zone).toInstant().toString())
                .setAverage(stat[0] / stat[1])
                .setSampleCount((long) stat[1]));
          });
      obs.onNext(resp.build());
      obs.onCompleted();
    }

    private static LocalDateTime aggregateBucket(LocalDateTime local, String grouping) {
      return switch (grouping) {
        case "hourly" -> local.withMinute(0).withSecond(0).withNano(0);
        case "weekly" -> local.toLocalDate()
            .minusDays(local.getDayOfWeek().getValue() - 1L).atStartOfDay();
        case "monthly" -> local.toLocalDate().withDayOfMonth(1).atStartOfDay();
        default -> local.toLocalDate().atStartOfDay();
      };
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) throws Exception {
    fakeDeps = InProcessServerBuilder.forName(DEPS)
        .addService(new FakeProject())
        .addService(new FakeIngestion())
        .build().start();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("aquashield.jwt.public-key-pem", PondApiIT::publicPem);
    registry.add("aquashield.grpc.project.in-process-name", () -> DEPS);
    registry.add("aquashield.grpc.ingestion.in-process-name", () -> DEPS);
    registry.add("aquashield.events.enabled", () -> false);
    registry.add("spring.cloud.gcp.pubsub.emulator-host", () -> "localhost:1"); // unused
    registry.add("grpc.server.port", () -> -1);
    registry.add("grpc.server.in-process-name", () -> IN_PROCESS);
  }

  @AfterAll
  static void shutdown() {
    if (grpcChannel != null) {
      grpcChannel.shutdownNow();
    }
    if (fakeDeps != null) {
      fakeDeps.shutdownNow();
    }
  }

  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper json;
  @Autowired StringRedisTemplate redisTemplate;
  @Autowired CycleDailyHealthRepository healthRepo;
  @Autowired CycleStageMetricRepository metricRepo;

  static String mint(UUID userId, String role, long version) {
    Instant now = Instant.now();
    return Jwts.builder().subject(userId.toString()).id(UUID.randomUUID().toString())
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

  PondServiceGrpc.PondServiceBlockingStub stub() {
    if (grpcChannel == null) {
      grpcChannel = InProcessChannelBuilder.forName(IN_PROCESS).usePlaintext().build();
    }
    return PondServiceGrpc.newBlockingStub(grpcChannel);
  }

  // ---------- tests ----------

  @Test
  void t01_createPond_andParityListShape() throws Exception {
    putSnapshot(ADMIN, 1, "platform_admin", List.of());
    putSnapshot(MEMBER, 1, "user", List.of(PROJECT));
    String admin = mint(ADMIN, "platform_admin", 1);

    JsonNode created = call("/api/projects/" + PROJECT + "/ponds", HttpMethod.POST,
        Map.of("name", "Pond Alpha",
            "metadata", Map.of("company_name", "AquaCo", "gps_location", "16.8,96.1"),
            "photo_url", "https://img/pond-a.jpg"),
        admin);
    assertThat(created.get("status").asInt()).isEqualTo(201);
    pondId = created.at("/body/pond_id").asText();
    // PARITY defaults + DDL-truth photo_url exposure
    assertThat(created.at("/body/status").asText()).isEqualTo("active");
    assertThat(created.at("/body/is_active").asBoolean()).isTrue();
    assertThat(created.at("/body/photo_url").asText()).isEqualTo("https://img/pond-a.jpg");
    assertThat(created.at("/body/project_name").asText()).isEqualTo("Demo Farm");   // via gRPC
    assertThat(created.at("/body/profile_type").asText()).isEqualTo("shrimp");

    // bad status rejected (improvement over the unconstrained monolith column)
    assertThat(call("/api/projects/" + PROJECT + "/ponds", HttpMethod.POST,
        Map.of("name", "Bad", "status", "flying"), admin).get("status").asInt()).isEqualTo(400);

    // PARITY: member list -> {"ponds":[snake]}, name-ordered
    JsonNode list = call("/api/ponds?projectId=" + PROJECT, HttpMethod.GET, null,
        mint(MEMBER, "user", 1));
    assertThat(list.get("status").asInt()).isEqualTo(200);
    assertThat(list.at("/body/ponds/0/pond_id").asText()).isEqualTo(pondId);
    assertThat(list.at("/body/ponds/0").has("metadata")).isTrue();

    // outsider -> 404 parity
    UUID outsider = UUID.randomUUID();
    putSnapshot(outsider, 1, "user", List.of());
    assertThat(call("/api/ponds?projectId=" + PROJECT, HttpMethod.GET, null,
        mint(outsider, "user", 1)).get("status").asInt()).isEqualTo(404);
  }

  @Test
  void t02_cycleLifecycle_andDrfEnvelope() throws Exception {
    String admin = mint(ADMIN, "platform_admin", 1);
    JsonNode started = call("/api/ponds/" + pondId + "/cycles", HttpMethod.POST,
        Map.of("start_date", LocalDate.now().minusDays(35).toString()), admin);
    assertThat(started.get("status").asInt()).isEqualTo(201);
    cycleId = started.at("/body/cycle_id").asText();
    assertThat(started.at("/body/status").asText()).isEqualTo("ongoing");
    assertThat(started.at("/body/current_day").asInt()).isEqualTo(36); // 1-based oracle
    assertThat(started.at("/body/is_ongoing").asBoolean()).isTrue();

    // PARITY: /api/cycles?pond= with the DRF pagination envelope
    JsonNode cyclesList = call("/api/cycles?pond=" + pondId, HttpMethod.GET, null,
        mint(MEMBER, "user", 1));
    assertThat(cyclesList.at("/body/count").asInt()).isEqualTo(1);
    assertThat(cyclesList.at("/body/results/0/cycle_id").asText()).isEqualTo(cycleId);
    assertThat(cyclesList.at("/body/results/0/pond_name").asText()).isEqualTo("Pond Alpha");
  }

  // DB oracles 4/5: (cycle, day) unique + day range CHECK 1..200
  @Test
  void t03_dailyHealth_dbConstraints() {
    UUID cid = UUID.fromString(cycleId);
    healthRepo.save(new CycleDailyHealth(cid, 36, LocalDate.now(), "good", 0));
    assertThatThrownBy(() ->
        healthRepo.saveAndFlush(new CycleDailyHealth(cid, 36, LocalDate.now(), "fair", 1)))
        .isInstanceOf(DataIntegrityViolationException.class); // uq_cycle_daily_health
    assertThatThrownBy(() ->
        healthRepo.saveAndFlush(new CycleDailyHealth(cid, 201, LocalDate.now(), "good", 0)))
        .isInstanceOf(DataIntegrityViolationException.class); // day_number CHECK <= 200
  }

  @Test
  void t04_cycleDetails_camelCaseComposition() throws Exception {
    metricRepo.save(new CycleStageMetric(UUID.fromString(cycleId), "Growth Phase",
        json.readTree("{\"dissolved_oxygen\":{\"avg\":6.1,\"min\":5.0,\"max\":7.2}}")));

    JsonNode details = call("/api/cycles/" + cycleId + "/details", HttpMethod.GET, null,
        mint(MEMBER, "user", 1));
    assertThat(details.get("status").asInt()).isEqualTo(200);
    JsonNode b = details.get("body");
    // PARITY camelCase composition
    assertThat(b.at("/cycle/pondName").asText()).isEqualTo("Pond Alpha");
    assertThat(b.at("/cycle/displayName").asText()).startsWith("Cycle ").endsWith("- Ongoing");
    // PARITY: JSONB avg flattened to "current"
    assertThat(b.at("/stageMetrics/Growth Phase/dissolved_oxygen/current").asDouble())
        .isEqualTo(6.1);
    // PARITY: stageName resolved from profile stages (day 36 -> Growth Phase)
    assertThat(b.at("/dailyHealth/0/dayNumber").asInt()).isEqualTo(36);
    assertThat(b.at("/dailyHealth/0/stageName").asText()).isEqualTo("Growth Phase");
  }

  @Test
  void t05_comparison_validation_andContract() throws Exception {
    String member = mint(MEMBER, "user", 1);
    String admin = mint(ADMIN, "platform_admin", 1);
    String base = "/api/projects/" + PROJECT + "/pond-comparison";

    // second pond for comparison
    JsonNode pondB = call("/api/projects/" + PROJECT + "/ponds", HttpMethod.POST,
        Map.of("name", "Pond Beta"), admin);
    String pondBId = pondB.at("/body/pond_id").asText();

    // options payload (camelCase; XSVC reading flags null/false)
    JsonNode options = call(base + "/ponds", HttpMethod.GET, null, member);
    assertThat(options.at("/body/ponds/0/companyName").asText()).isEqualTo("AquaCo");
    assertThat(options.at("/body/ponds/0/hasSensorData").asBoolean()).isFalse();

    // PARITY validation messages
    assertThat(call(base + "?pondAId=" + pondId, HttpMethod.GET, null, member)
        .at("/body/detail").asText()).isEqualTo("pondBId is required");
    assertThat(call(base + "?pondAId=" + pondId + "&pondBId=" + pondId
        + "&startDate=2026-06-01&endDate=2026-06-05", HttpMethod.GET, null, member)
        .at("/body/detail").asText()).isEqualTo("pondAId and pondBId must differ");
    assertThat(call(base + "?pondAId=" + pondId + "&pondBId=" + pondBId
        + "&startDate=2026-06-05&endDate=2026-06-01", HttpMethod.GET, null, member)
        .at("/body/detail").asText()).isEqualTo("endDate must be on or after startDate");
    assertThat(call(base + "?pondAId=" + pondId + "&pondBId=" + UUID.randomUUID()
        + "&startDate=2026-06-01&endDate=2026-06-05", HttpMethod.GET, null, member)
        .at("/body/detail").asText()).isEqualTo("Pond not found in this project");

    // contract invariants: 4 metrics fixed order, grouping resolved (never 'auto'),
    // grid fully zero-filled
    JsonNode cmp = call(base + "?pondAId=" + pondId + "&pondBId=" + pondBId
        + "&startDate=2026-06-01&endDate=2026-06-05&grouping=auto", HttpMethod.GET, null, member);
    assertThat(cmp.get("status").asInt()).isEqualTo(200);
    JsonNode b = cmp.get("body");
    assertThat(b.at("/dateRange/grouping").asText()).isEqualTo("daily");
    assertThat(b.get("metrics")).hasSize(4);
    assertThat(b.at("/metrics/0/parameter").asText()).isEqualTo("ammonia");
    assertThat(b.at("/metrics/3/parameter").asText()).isEqualTo("ph");
    assertThat(b.at("/charts/0/data")).hasSize(5); // Jun 1..5 daily buckets all present
    assertThat(b.at("/charts/0/data/0/seriesA").asDouble()).isZero();
    assertThat(b.at("/pondA/name").asText()).isEqualTo("Pond Alpha");
  }

  @Test
  void t05b_comparison_realReadings_oracle() {
    String member = mint(MEMBER, "user", 1);
    String admin = mint(ADMIN, "platform_admin", 1);
    String base = "/api/projects/" + PROJECT + "/pond-comparison";
    JsonNode pondC = call("/api/projects/" + PROJECT + "/ponds", HttpMethod.POST,
        Map.of("name", "Pond Gamma"), admin);
    String pondCId = pondC.at("/body/pond_id").asText();

    // Worked oracle (CPython-verified): UTC instants -> Asia/Singapore local 14:00/14:30.
    // turbidity is ABSENT (null) from pondId's second reading.
    READINGS.put(pondId, List.of(
        ReadingRow.newBuilder().setMeasuredAt("2026-06-03T06:00:00Z").setPondId(pondId)
            .putValues("ammonium", 0.10).putValues("dissolved_oxygen", 5.0)
            .putValues("turbidity", 12.0).putValues("electricity", 1.5).build(),
        ReadingRow.newBuilder().setMeasuredAt("2026-06-03T06:30:00Z").setPondId(pondId)
            .putValues("ammonium", 0.20).putValues("dissolved_oxygen", 6.0)
            .putValues("electricity", 2.5).build()));
    READINGS.put(pondCId, List.of(
        ReadingRow.newBuilder().setMeasuredAt("2026-06-03T06:00:00Z").setPondId(pondCId)
            .putValues("ammonium", 0.40).putValues("dissolved_oxygen", 4.0)
            .putValues("turbidity", 10.0).putValues("electricity", 3.0).build()));
    try {
      JsonNode cmp = call(base + "?pondAId=" + pondId + "&pondBId=" + pondCId
          + "&startDate=2026-06-03&endDate=2026-06-03"
          + "&parameters=ammonium,dissolved_oxygen,turbidity", HttpMethod.GET, null, member);
      assertThat(cmp.get("status").asInt()).isEqualTo(200);
      JsonNode b = cmp.get("body");
      assertThat(b.at("/dateRange/grouping").asText()).isEqualTo("hourly"); // span 1

      // metrics — card averages over the whole range (CPython-checked values)
      JsonNode ammonium = findParameter(b.get("metrics"), "ammonium");
      assertThat(ammonium.get("pondAValue").asDouble()).isEqualTo(0.15);
      assertThat(ammonium.get("pondBValue").asDouble()).isEqualTo(0.4);
      assertThat(ammonium.get("difference").asDouble()).isEqualTo(-0.25);
      assertThat(ammonium.get("percentDifference").asLong()).isEqualTo(-62);
      JsonNode dox = findParameter(b.get("metrics"), "dissolved_oxygen");
      assertThat(dox.get("pondAValue").asDouble()).isEqualTo(5.5);
      assertThat(dox.get("percentDifference").asLong()).isEqualTo(38); // 37.5 -> even
      JsonNode turbidity = findParameter(b.get("metrics"), "turbidity");
      assertThat(turbidity.get("pondAValue").asDouble()).isEqualTo(12.0); // null dropped
      assertThat(turbidity.get("percentDifference").asLong()).isEqualTo(20);
      // hourly grid: 24 buckets; readings land in the LOCAL 14:00 bucket (06:00Z+08)
      JsonNode data = findParameter(b.get("charts"), "ammonium").get("data");
      assertThat(data).hasSize(24);
      assertThat(data.get(14).get("label").asText()).isEqualTo("Jun 03 14:00");
      assertThat(data.get(14).get("seriesA").asDouble()).isEqualTo(0.15);
      assertThat(data.get(14).get("seriesB").asDouble()).isEqualTo(0.4);
      assertThat(data.get(13).get("seriesA").asDouble()).isZero(); // empty bucket zero-fill

      // options: reading windows now real (localized isoformat, +08:00 offset)
      JsonNode options = call(base + "/ponds", HttpMethod.GET, null, member);
      JsonNode alpha = findPond(options.at("/body/ponds"), "Pond Alpha");
      assertThat(alpha.get("hasSensorData").asBoolean()).isTrue();
      assertThat(alpha.get("firstReadingAt").asText()).isEqualTo("2026-06-03T14:00:00+08:00");
      assertThat(alpha.get("lastReadingAt").asText()).isEqualTo("2026-06-03T14:30:00+08:00");
      JsonNode beta = findPond(options.at("/body/ponds"), "Pond Beta");
      assertThat(beta.get("hasSensorData").asBoolean()).isFalse();
      assertThat(beta.get("firstReadingAt").isNull()).isTrue();
    } finally {
      READINGS.clear();
    }
  }

  private static JsonNode findPond(JsonNode ponds, String name) {
    for (JsonNode pond : ponds) {
      if (pond.get("name").asText().equals(name)) {
        return pond;
      }
    }
    throw new AssertionError("pond not found: " + name);
  }

  private static JsonNode findParameter(JsonNode rows, String parameter) {
    for (JsonNode row : rows) {
      if (row.get("parameter").asText().equals(parameter)) {
        return row;
      }
    }
    throw new AssertionError("parameter not found: " + parameter);
  }

  @Test
  void t05c_feedingGrowth_apiSlice() {
    String member = mint(MEMBER, "user", 1);

    JsonNode feedType = call("/api/feed-types/", HttpMethod.POST,
        Map.of("project", PROJECT.toString(), "name", "Starter 35",
            "pack_kg", "25.00", "pack_price", "62.50"),
        member);
    assertThat(feedType.get("status").asInt()).isEqualTo(201);
    String feedTypeId = feedType.at("/body/feed_type_id").asText();

    JsonNode options = call("/api/projects/" + PROJECT + "/feeding/options/",
        HttpMethod.GET, null, member);
    assertThat(options.get("status").asInt()).isEqualTo(200);
    assertThat(options.at("/body/feedTypes/0/name").asText()).isEqualTo("Starter 35");
    assertThat(options.at("/body/feedTypes/0/unitPrice").asDouble()).isEqualTo(2.5);

    LocalDate fedOn = LocalDate.now().minusDays(35);
    JsonNode saved = call("/api/ponds/" + pondId + "/feed-days/" + fedOn + "/",
        HttpMethod.PUT,
        Map.of("entries", List.of(Map.of("feedTypeId", feedTypeId, "amountKg", "12.50",
            "fedTime", "07:30"))),
        member);
    assertThat(saved.get("status").asInt()).isEqualTo(200);
    assertThat(saved.at("/body/ok").asBoolean()).isTrue();

    JsonNode dash = call("/api/projects/" + PROJECT + "/feeding/dashboard/?cycle=" + cycleId,
        HttpMethod.GET, null, member);
    assertThat(dash.get("status").asInt()).isEqualTo(200);
    JsonNode body = dash.get("body");
    assertThat(body.at("/cycle/cycleId").asText()).isEqualTo(cycleId);
    assertThat(body.at("/horizonDays").asInt()).isGreaterThanOrEqualTo(36);
    assertThat(body.at("/kpis/base/feedKg").asDouble()).isEqualTo(12.5);
    assertThat(body.at("/kpis/base/cost").asDouble()).isEqualTo(31.25);
    assertThat(body.at("/days/base/0/entries/0/fedTime").asText()).isEqualTo("07:30");
    assertThat(body.at("/days/base/0/entries/0/cost").asDouble()).isEqualTo(31.25);

    JsonNode biomass = call("/api/cycles/" + cycleId + "/biomass/", HttpMethod.PATCH,
        Map.of("stockingBiomassKg", "80.50"), member);
    assertThat(biomass.get("status").asInt()).isEqualTo(200);
    JsonNode harvestRejected = call("/api/cycles/" + cycleId + "/biomass/", HttpMethod.PATCH,
        Map.of("harvestBiomassKg", "300.00"), member);
    assertThat(harvestRejected.get("status").asInt()).isEqualTo(400);
    assertThat(harvestRejected.at("/body/detail").asText())
        .isEqualTo("Harvest biomass can only be recorded once the cycle is finished.");

    JsonNode deleteReferenced = call("/api/feed-types/" + feedTypeId + "/", HttpMethod.DELETE,
        null, member);
    assertThat(deleteReferenced.get("status").asInt()).isEqualTo(400);
    assertThat(deleteReferenced.at("/body/detail").asText())
        .isEqualTo("This feed type is already used by feed logs. Retire it instead.");
  }

  @Test
  void t06_grpcContract() {
    var pond = stub().getPond(GetPondRequest.newBuilder().setPondId(pondId).build());
    assertThat(pond.getName()).isEqualTo("Pond Alpha");
    assertThat(pond.getProjectId()).isEqualTo(PROJECT.toString());

    var current = stub().getCurrentCycle(
        GetCurrentCycleRequest.newBuilder().setPondId(pondId).build());
    assertThat(current.getStatus()).isEqualTo("ongoing");
    assertThat(current.getCurrentDay()).isGreaterThanOrEqualTo(36);

    assertThat(stub().validatePondInProject(ValidatePondInProjectRequest.newBuilder()
        .setPondId(pondId).setProjectId(PROJECT.toString()).build()).getValid()).isTrue();
    assertThat(stub().validatePondInProject(ValidatePondInProjectRequest.newBuilder()
        .setPondId(pondId).setProjectId(UUID.randomUUID().toString()).build()).getValid()).isFalse();

    var summary = stub().getPondSummary(
        GetPondSummaryRequest.newBuilder().setPondId(pondId).build());
    assertThat(summary.getHasActiveCycle()).isTrue();
    assertThat(summary.getTotalCycles()).isEqualTo(1);
    assertThat(summary.getLatestHealthStatus()).isEqualTo("good");

    assertThatThrownBy(() -> stub().getCurrentCycle(GetCurrentCycleRequest.newBuilder()
        .setPondId(UUID.randomUUID().toString()).build()))
        .isInstanceOfSatisfying(StatusRuntimeException.class, e ->
            assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.NOT_FOUND));
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
