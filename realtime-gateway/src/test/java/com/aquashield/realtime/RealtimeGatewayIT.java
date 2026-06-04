package com.aquashield.realtime;

import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.FeatureActionEntry;
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
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.pubsub.v1.ProjectSubscriptionName;
import com.google.pubsub.v1.PushConfig;
import com.google.pubsub.v1.TopicName;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.jsonwebtoken.Jwts;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.socket.client.ReactorNettyWebSocketClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PubSubEmulatorContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.net.URI;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end WSS gateway IT with a REAL WebSocket client: token mint (JWT + fail-closed
 * snapshot), first-frame AUTH, one-time token replay rejection, project-scoped event
 * delivery via the Redis fanout, heartbeat, and the auth timeout.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class RealtimeGatewayIT {

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  @Container
  static final PubSubEmulatorContainer pubsub = new PubSubEmulatorContainer(
      DockerImageName.parse("gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators"));

  static final String GCP_PROJECT = "aquashield-it";
  static final KeyPair KEYS = generateKeys();
  static final UUID USER = UUID.randomUUID();
  static final UUID PROJECT = UUID.randomUUID();
  static final UUID OTHER_PROJECT = UUID.randomUUID();
  static final UUID POND = UUID.randomUUID();
  static ManagedChannel adminChannel;

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) throws Exception {
    setupPubsub();
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("spring.cloud.gcp.project-id", () -> GCP_PROJECT);
    registry.add("spring.cloud.gcp.pubsub.emulator-host", pubsub::getEmulatorEndpoint);
    registry.add("aquashield.jwt.public-key-pem", RealtimeGatewayIT::publicPem);
    registry.add("aquashield.realtime.auth-timeout", () -> "PT2S");
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
      for (String t : List.of("reading.ingested", "alert.created", "alert.resolved")) {
        topics.createTopic(TopicName.of(GCP_PROJECT, t));
        subs.createSubscription(
            ProjectSubscriptionName.of(GCP_PROJECT, "realtime." + t + ".sub"),
            TopicName.of(GCP_PROJECT, t), PushConfig.getDefaultInstance(), 10);
      }
    }
  }

  @AfterAll
  static void shutdown() {
    if (adminChannel != null) {
      adminChannel.shutdownNow();
    }
  }

  @LocalServerPort int port;
  @Autowired ObjectMapper json;
  @Autowired StringRedisTemplate redisTemplate;
  @Autowired PubSubTemplate template;

  // ---------- helpers ----------

  static String mintJwt(UUID userId, long version) {
    Instant now = Instant.now();
    return Jwts.builder().subject(userId.toString()).id(UUID.randomUUID().toString())
        .issuer("aquashield-local").audience().add("aquashield-api").and()
        .claim("role", "user").claim("authzVersion", version)
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

  String mintWsToken(String jwt, int expectStatus) {
    var resp = WebClient.create("http://localhost:" + port).post().uri("/ws/token")
        .headers(h -> {
          if (jwt != null) {
            h.set(HttpHeaders.AUTHORIZATION, "Bearer " + jwt);
          }
          h.setContentType(MediaType.APPLICATION_JSON);
        })
        .retrieve().onStatus(s -> true, r -> Mono.empty())
        .toEntity(String.class).block(Duration.ofSeconds(10));
    assertThat(resp.getStatusCode().value()).isEqualTo(expectStatus);
    try {
      return expectStatus == 200 ? json.readTree(resp.getBody()).get("token").asText() : null;
    } catch (Exception e) {
      return null;
    }
  }

  /** A live WS connection with a send-sink + received-frame queue + closed latch. */
  class Probe {
    final ConcurrentLinkedQueue<String> received = new ConcurrentLinkedQueue<>();
    final Sinks.Many<String> toSend = Sinks.many().unicast().onBackpressureBuffer();
    final CountDownLatch closed = new CountDownLatch(1);
    Disposable connection;

    Probe connect() {
      connection = new ReactorNettyWebSocketClient()
          .execute(URI.create("ws://localhost:" + port + "/ws"), session ->
              Mono.when(
                  session.send(toSend.asFlux().map(session::textMessage)),
                  session.receive().map(m -> m.getPayloadAsText())
                      .doOnNext(received::add).then()))
          .doFinally(s -> closed.countDown())
          .subscribe();
      return this;
    }

    void send(String frame) {
      toSend.tryEmitNext(frame);
    }

    JsonNode awaitFrame(String type) {
      var holder = new java.util.concurrent.atomic.AtomicReference<JsonNode>();
      Awaitility.await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
        for (String f : received) {
          JsonNode node = json.readTree(f);
          if (type.equals(node.path("type").asText())) {
            holder.set(node);
            return;
          }
        }
        assertThat(holder.get()).isNotNull();
      });
      return holder.get();
    }

    void close() {
      toSend.tryEmitComplete();
      if (connection != null) {
        connection.dispose();
      }
    }
  }

  void publishEvent(String topic, UUID projectId, ObjectNode payload) throws Exception {
    ObjectNode envelope = json.createObjectNode();
    envelope.put("eventId", UUID.randomUUID().toString());
    envelope.put("eventType", topic);
    envelope.put("projectId", projectId.toString());
    envelope.put("pondId", POND.toString());
    envelope.set("payload", payload);
    template.publish(topic, json.writeValueAsString(envelope)).get();
  }

  // ---------- tests ----------

  @Test
  void t01_tokenMint_requiresJwtAndSnapshot() throws Exception {
    mintWsToken(null, 401);                       // no JWT
    String jwtNoSnapshot = mintJwt(UUID.randomUUID(), 9);
    mintWsToken(jwtNoSnapshot, 401);              // valid JWT, missing snapshot -> fail closed

    putSnapshot(USER, 1, List.of(PROJECT));
    String token = mintWsToken(mintJwt(USER, 1), 200);
    assertThat(token).isNotBlank();
    assertThat(redisTemplate.hasKey("ws:token:" + token)).isTrue();
  }

  @Test
  void t02_auth_ok_thenReplayRejected() throws Exception {
    String token = mintWsToken(mintJwt(USER, 1), 200);

    Probe first = new Probe().connect();
    first.send("{\"type\":\"AUTH\",\"token\":\"" + token + "\"}");
    JsonNode ok = first.awaitFrame("AUTH_OK");
    assertThat(ok.get("connectionId").asText()).isNotBlank();
    // subscription routing metadata in Redis (spec)
    Awaitility.await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
        assertThat(redisTemplate.keys("ws:sub:" + USER + ":*")).isNotEmpty());

    // REPLAY the consumed token on a second connection -> AUTH_FAILED (one-time)
    Probe second = new Probe().connect();
    second.send("{\"type\":\"AUTH\",\"token\":\"" + token + "\"}");
    JsonNode failed = second.awaitFrame("AUTH_FAILED");
    assertThat(failed.get("reason").asText()).contains("invalid or replayed");
    second.close();

    // heartbeat
    first.send("{\"type\":\"PING\"}");
    first.awaitFrame("PONG");
    first.close();
  }

  @Test
  void t03_projectScopedDelivery() throws Exception {
    String token = mintWsToken(mintJwt(USER, 1), 200);
    Probe probe = new Probe().connect();
    probe.send("{\"type\":\"AUTH\",\"token\":\"" + token + "\"}");
    probe.awaitFrame("AUTH_OK");

    // event for ANOTHER project first — must NOT reach this client
    ObjectNode foreign = json.createObjectNode();
    foreign.put("measuredAt", Instant.now().toString());
    foreign.set("values", json.createObjectNode().put("ph", 9.9));
    publishEvent("reading.ingested", OTHER_PROJECT, foreign);

    // event for OUR project — must arrive as the parity sensor.reading frame
    ObjectNode payload = json.createObjectNode();
    payload.put("measuredAt", Instant.now().toString());
    payload.set("values", json.createObjectNode().put("ph", 7.2).put("temperature", 28.5));
    publishEvent("reading.ingested", PROJECT, payload);

    JsonNode frame = probe.awaitFrame("sensor.reading");
    assertThat(frame.get("project_id").asText()).isEqualTo(PROJECT.toString());
    assertThat(frame.get("pond_id").asText()).isEqualTo(POND.toString());
    assertThat(frame.at("/values/ph").asDouble()).isEqualTo(7.2);
    // the foreign project's reading never arrived
    for (String f : probe.received) {
      assertThat(f).doesNotContain(OTHER_PROJECT.toString());
    }

    // alert frame (parity ProjectConsumer.alert_message shape: alert under "alert")
    ObjectNode alert = json.createObjectNode();
    alert.put("parameter", "ph").put("severity", "critical")
        .put("message", "ph exceeded maximum: 9.9 > 8.5");
    publishEvent("alert.created", PROJECT, alert);
    JsonNode alertFrame = probe.awaitFrame("alert");
    assertThat(alertFrame.at("/alert/severity").asText()).isEqualTo("critical");
    assertThat(alertFrame.at("/alert/message").asText()).contains("exceeded maximum");

    // alert_resolved (new-arch frame)
    ObjectNode resolved = json.createObjectNode();
    resolved.put("parameter", "ph").put("resolvedCount", 1);
    publishEvent("alert.resolved", PROJECT, resolved);
    JsonNode resolvedFrame = probe.awaitFrame("alert_resolved");
    assertThat(resolvedFrame.get("parameter").asText()).isEqualTo("ph");
    probe.close();
  }

  @Test
  void t04_authTimeout_closesIdleSession() throws Exception {
    Probe probe = new Probe().connect();        // never sends AUTH
    assertThat(probe.closed.await(8, TimeUnit.SECONDS)).isTrue(); // PT2S timeout + slack
    probe.close();
  }

  @Test
  void t05_firstFrameMustBeAuth() throws Exception {
    Probe probe = new Probe().connect();
    probe.send("{\"type\":\"PING\"}");
    JsonNode failed = probe.awaitFrame("AUTH_FAILED");
    assertThat(failed.get("reason").asText()).contains("AUTH frame required");
    probe.close();
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
