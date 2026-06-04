package com.aquashield.ingestion;

import com.aquashield.api.project.v1.GetParameterCatalogueRequest;
import com.aquashield.api.project.v1.GetParameterCatalogueResponse;
import com.aquashield.api.project.v1.ParameterTypeInfo;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.api.sensor.v1.DevicePortMapping;
import com.aquashield.api.sensor.v1.DeviceValidationMetadata;
import com.aquashield.api.sensor.v1.GetDeviceValidationMetadataRequest;
import com.aquashield.api.sensor.v1.ResolveDevicePortRequest;
import com.aquashield.api.sensor.v1.SensorServiceGrpc;
import com.aquashield.common.security.PayloadHmac;
import com.aquashield.ingestion.repo.Repos.SensorMessageRepository;
import com.aquashield.ingestion.repo.Repos.SensorReadingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.PubSubEmulatorContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end pipeline IT: real Pub/Sub emulator + Postgres + FAKE in-process Sensor and
 * Project gRPC servers (controllable per scenario). Oracles from the module_sensor /
 * module_data_ingestion parity spec §2 + §7.
 */
@Testcontainers
@SpringBootTest
@TestMethodOrder(MethodOrderer.MethodName.class)
class IngestionIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  static final PubSubEmulatorContainer pubsub = new PubSubEmulatorContainer(
      DockerImageName.parse("gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators"));

  static final String GCP_PROJECT = "aquashield-it";
  static final String DEPS = "ingestion-it-deps";
  static final String DEVICE = "DEV-001";
  static final String KEY = "super-secret-device-key";
  static final UUID DEVICE_ID = UUID.randomUUID();
  static final UUID PROJECT_ID = UUID.randomUUID();
  static final UUID POND_ID = UUID.randomUUID();
  static final UUID MAPPING_ID = UUID.randomUUID();
  static final UUID PARAM_PH = UUID.randomUUID();
  static final UUID PARAM_TEMP = UUID.randomUUID();

  static Server fakeDeps;
  static ManagedChannel adminChannel;
  static SubscriberStub subscriber;

  /** scenario knobs for the fake sensor service */
  static final ConcurrentHashMap<String, DeviceValidationMetadata> DEVICES = new ConcurrentHashMap<>();
  static final ConcurrentHashMap<String, DevicePortMapping> PORTS = new ConcurrentHashMap<>();

  static class FakeSensor extends SensorServiceGrpc.SensorServiceImplBase {
    @Override
    public void getDeviceValidationMetadata(GetDeviceValidationMetadataRequest req,
                                            StreamObserver<DeviceValidationMetadata> obs) {
      obs.onNext(DEVICES.getOrDefault(req.getDeviceCode(),
          DeviceValidationMetadata.newBuilder().setKnown(false).build()));
      obs.onCompleted();
    }

    @Override
    public void resolveDevicePort(ResolveDevicePortRequest req,
                                  StreamObserver<DevicePortMapping> obs) {
      obs.onNext(PORTS.getOrDefault(req.getDeviceCode() + ":" + req.getPort(),
          DevicePortMapping.newBuilder().setFound(false).build()));
      obs.onCompleted();
    }
  }

  static class FakeProject extends ProjectServiceGrpc.ProjectServiceImplBase {
    @Override
    public void getParameterCatalogue(GetParameterCatalogueRequest req,
                                      StreamObserver<GetParameterCatalogueResponse> obs) {
      obs.onNext(GetParameterCatalogueResponse.newBuilder()
          .addParameters(ParameterTypeInfo.newBuilder()
              .setParameterTypeId(PARAM_PH.toString()).setCode("ph").setName("pH"))
          .addParameters(ParameterTypeInfo.newBuilder()
              .setParameterTypeId(PARAM_TEMP.toString()).setCode("temperature").setName("Temperature"))
          .build());
      obs.onCompleted();
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) throws Exception {
    // fake gRPC deps must exist before the app context starts
    fakeDeps = InProcessServerBuilder.forName(DEPS)
        .addService(new FakeSensor()).addService(new FakeProject()).build().start();
    // healthy default device + mapping (ph + temperature allowed)
    DEVICES.put(DEVICE, DeviceValidationMetadata.newBuilder()
        .setKnown(true).setActive(true).setDeviceId(DEVICE_ID.toString()).setDeviceKey(KEY).build());
    PORTS.put(DEVICE + ":A1", DevicePortMapping.newBuilder()
        .setFound(true).setProjectSensorId(MAPPING_ID.toString())
        .setProjectId(PROJECT_ID.toString()).setPondId(POND_ID.toString())
        .setSensorTypeId(UUID.randomUUID().toString()).setSensorTypeName("AquaProbe")
        .addParameterTypeIds(PARAM_PH.toString()).addParameterTypeIds(PARAM_TEMP.toString())
        .setActive(true).build());
    setupPubsub();

    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.cloud.gcp.project-id", () -> GCP_PROJECT);
    registry.add("spring.cloud.gcp.pubsub.emulator-host", pubsub::getEmulatorEndpoint);
    registry.add("aquashield.grpc.sensor.in-process-name", () -> DEPS);
    registry.add("aquashield.grpc.project.in-process-name", () -> DEPS);
    registry.add("aquashield.ingestion.max-skew", () -> "PT5M");
    registry.add("grpc.server.port", () -> -1);
    registry.add("grpc.server.in-process-name", () -> "ingestion-grpc-it");
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
      for (String t : List.of("iot.telemetry.received", "sensor.message.validated",
          "sensor.message.rejected", "reading.ingested", "reading.quarantined")) {
        topics.createTopic(TopicName.of(GCP_PROJECT, t));
      }
      subs.createSubscription(
          ProjectSubscriptionName.of(GCP_PROJECT, "ingestion.iot.telemetry.received.sub"),
          TopicName.of(GCP_PROJECT, "iot.telemetry.received"),
          PushConfig.getDefaultInstance(), 10);
      subs.createSubscription(ProjectSubscriptionName.of(GCP_PROJECT, "it.validated.sub"),
          TopicName.of(GCP_PROJECT, "sensor.message.validated"), PushConfig.getDefaultInstance(), 10);
      subs.createSubscription(ProjectSubscriptionName.of(GCP_PROJECT, "it.rejected.sub"),
          TopicName.of(GCP_PROJECT, "sensor.message.rejected"), PushConfig.getDefaultInstance(), 10);
      subs.createSubscription(ProjectSubscriptionName.of(GCP_PROJECT, "it.ingested.sub"),
          TopicName.of(GCP_PROJECT, "reading.ingested"), PushConfig.getDefaultInstance(), 10);
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
  @Autowired SensorMessageRepository messages;
  @Autowired SensorReadingRepository readings;

  // ---------- helpers ----------

  ObjectNode telemetry(long seq, String port, Object... paramValuePairs) {
    ObjectNode payload = json.createObjectNode();
    payload.put("device_code", DEVICE);
    payload.put("seq_no", seq);
    payload.put("measured_at", Instant.now().toString());
    payload.put("ts", Instant.now().getEpochSecond());
    ArrayNode batches = payload.putArray("sensor_batches");
    ObjectNode batch = batches.addObject();
    batch.put("port", port);
    ArrayNode rs = batch.putArray("readings");
    for (int i = 0; i < paramValuePairs.length; i += 2) {
      ObjectNode r = rs.addObject();
      r.put("parameter", (String) paramValuePairs[i]);
      r.put("value", ((Number) paramValuePairs[i + 1]).doubleValue());
    }
    payload.put(PayloadHmac.SIG_FIELD, PayloadHmac.sign(payload, KEY));
    return payload;
  }

  void publish(ObjectNode payload) throws Exception {
    ObjectNode envelope = json.createObjectNode();
    envelope.put("eventId", UUID.randomUUID().toString());
    envelope.put("eventType", "iot.telemetry.received");
    envelope.put("schemaVersion", "v1");
    envelope.put("correlationId", UUID.randomUUID().toString());
    envelope.set("payload", payload);
    template.publish("iot.telemetry.received", json.writeValueAsString(envelope)).get();
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

  /** await until a rejected event with the given reason substring arrives. */
  void awaitRejected(String reasonContains) {
    List<JsonNode> seen = new ArrayList<>();
    Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
      seen.addAll(drain("it.rejected.sub"));
      assertThat(seen.stream().anyMatch(e ->
          e.at("/payload/reason").asText().contains(reasonContains))).isTrue();
    });
  }

  // ---------- tests ----------

  @Test
  void t01_happyPath_persistsAndPublishes() throws Exception {
    publish(telemetry(1, "A1", "ph", 7.2, "temperature", 28.5));

    Awaitility.await().atMost(Duration.ofSeconds(20))
        .untilAsserted(() -> assertThat(readings.count()).isEqualTo(1));
    var row = readings.findAll().get(0);
    assertThat(row.getProjectId()).isEqualTo(PROJECT_ID);
    assertThat(row.getPondId()).isEqualTo(POND_ID);
    assertThat(row.getReadingValues().get("ph").asDouble()).isEqualTo(7.2);
    assertThat(row.getReadingValues().get("temperature").asDouble()).isEqualTo(28.5);

    List<JsonNode> ingested = new ArrayList<>();
    Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
      ingested.addAll(drain("it.ingested.sub"));
      assertThat(ingested).isNotEmpty();
    });
    JsonNode event = ingested.get(0);
    assertThat(event.get("eventType").asText()).isEqualTo("reading.ingested");
    assertThat(event.get("projectId").asText()).isEqualTo(PROJECT_ID.toString());
    assertThat(event.get("pondId").asText()).isEqualTo(POND_ID.toString());
    assertThat(event.at("/payload/values/ph").asDouble()).isEqualTo(7.2);
  }

  // Oracle #11 — duplicate (device, seq) ignored: no new rows, no new reading event
  @Test
  void t02_duplicateSeq_isIgnored() throws Exception {
    drain("it.ingested.sub");
    publish(telemetry(1, "A1", "ph", 7.9));
    Thread.sleep(3000); // allow async processing
    assertThat(readings.count()).isEqualTo(1);          // unchanged
    assertThat(messages.count()).isEqualTo(1);          // unchanged
    assertThat(drain("it.ingested.sub")).isEmpty();     // no new event
  }

  // Oracle #13 — tampered signature rejected, nothing persisted
  @Test
  void t03_invalidSignature_rejected() throws Exception {
    ObjectNode bad = telemetry(2, "A1", "ph", 7.0);
    bad.put("seq_no", 999); // tamper AFTER signing
    publish(bad);
    awaitRejected("Invalid HMAC signature");
    assertThat(messages.count()).isEqualTo(1);
  }

  // Oracles #2/#3 — unknown device: exact parity message
  @Test
  void t04_unknownDevice_rejected() throws Exception {
    ObjectNode p = telemetry(3, "A1", "ph", 7.0);
    p.put("device_code", "DEV-X");
    p.put(PayloadHmac.SIG_FIELD, PayloadHmac.sign(p, KEY));
    publish(p);
    awaitRejected("Unknown or Inactive IoT device - 'DEV-X'.");
  }

  // Oracle #6 — unknown port: hard error, NOTHING persisted (message included)
  @Test
  void t05_unknownPort_hardError_nothingPersisted() throws Exception {
    long before = messages.count();
    publish(telemetry(4, "Z9", "ph", 7.0));
    awaitRejected("No Sensor mapping for device 'DEV-001' port 'Z9'.");
    assertThat(messages.count()).isEqualTo(before);
  }

  // Oracle #7 — strict mode: disallowed parameter is a hard error
  @Test
  void t06_disallowedParameter_rejected() throws Exception {
    publish(telemetry(5, "A1", "salinity", 30.1));
    awaitRejected("Parameter 'salinity' not allowed");
  }

  // Oracle #9 — duplicate parameter in same port: always a hard error
  @Test
  void t07_duplicateParameter_rejected() throws Exception {
    publish(telemetry(6, "A1", "ph", 7.0, "ph", 7.1));
    awaitRejected("Duplicate parameter 'ph'");
  }

  // Oracle #14 — timestamp skew exceeded
  @Test
  void t08_skewExceeded_rejected() throws Exception {
    ObjectNode p = telemetry(7, "A1", "ph", 7.0);
    p.put("ts", Instant.now().getEpochSecond() - 3600);
    p.put(PayloadHmac.SIG_FIELD, PayloadHmac.sign(p, KEY));
    publish(p);
    awaitRejected("Timestamp skew exceeded");
  }

  // The telemetry READ seam: GetReadings serves what t01 persisted
  @Test
  void t08b_getReadings_servesPersistedRows() {
    var channel = io.grpc.inprocess.InProcessChannelBuilder.forName("ingestion-grpc-it")
        .usePlaintext().build();
    try {
      var stub = com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc.newBlockingStub(channel);
      var resp = stub.getReadings(com.aquashield.api.ingestion.v1.GetReadingsRequest.newBuilder()
          .setPondId(POND_ID.toString())
          .setStart(Instant.now().minusSeconds(3600).toString())
          .setEnd(Instant.now().toString())
          .build());
      assertThat(resp.getRowsCount()).isGreaterThanOrEqualTo(1);
      var row = resp.getRows(0);
      assertThat(row.getValuesMap()).containsEntry("ph", 7.2).containsEntry("temperature", 28.5);
      assertThat(row.getPort()).isEqualTo("A1");

      // parameter filter
      var filtered = stub.getReadings(com.aquashield.api.ingestion.v1.GetReadingsRequest.newBuilder()
          .setPondId(POND_ID.toString())
          .setStart(Instant.now().minusSeconds(3600).toString())
          .setEnd(Instant.now().toString())
          .addParameters("ph")
          .build());
      assertThat(filtered.getRows(0).getValuesMap()).containsOnlyKeys("ph");

      // invalid args -> INVALID_ARGUMENT
      org.assertj.core.api.Assertions.assertThatThrownBy(() ->
          stub.getReadings(com.aquashield.api.ingestion.v1.GetReadingsRequest.newBuilder()
              .setPondId("not-a-uuid").setStart("now").setEnd("later").build()))
          .isInstanceOfSatisfying(io.grpc.StatusRuntimeException.class, e ->
              assertThat(e.getStatus().getCode())
                  .isEqualTo(io.grpc.Status.Code.INVALID_ARGUMENT));
    } finally {
      channel.shutdownNow();
    }
  }

  // Oracle #10 — empty allow-list: port silently skipped, message persisted, no reading
  @Test
  void t09_emptyAllowList_silentSkip() throws Exception {
    PORTS.put(DEVICE + ":B2", DevicePortMapping.newBuilder()
        .setFound(true).setProjectSensorId(UUID.randomUUID().toString())
        .setProjectId(PROJECT_ID.toString()).setPondId(POND_ID.toString())
        .setSensorTypeId(UUID.randomUUID().toString()).setSensorTypeName("InactiveProbe")
        .setActive(true).build()); // NO parameter_type_ids -> empty allow-list
    long readingsBefore = readings.count();
    long messagesBefore = messages.count();
    publish(telemetry(8, "B2", "ph", 7.0));

    Awaitility.await().atMost(Duration.ofSeconds(20))
        .untilAsserted(() -> assertThat(messages.count()).isEqualTo(messagesBefore + 1));
    assertThat(readings.count()).isEqualTo(readingsBefore); // port row skipped silently
    List<JsonNode> validated = new ArrayList<>();
    Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
      validated.addAll(drain("it.validated.sub"));
      assertThat(validated.stream().anyMatch(e ->
          e.at("/payload/seqNo").asLong() == 8 && e.at("/payload/rows").asInt() == 0)).isTrue();
    });
  }
}
