package com.aquashield.identity;

import com.aquashield.api.identity.v1.AuthorizeActionRequest;
import com.aquashield.api.identity.v1.GetAuthorizationSnapshotRequest;
import com.aquashield.api.identity.v1.GetProjectUsersRequest;
import com.aquashield.api.identity.v1.IdentityServiceGrpc;
import com.aquashield.api.identity.v1.ValidateTokenRequest;
import com.aquashield.identity.api.dto.UserAdminDtos.OnboardRequest;
import com.aquashield.identity.service.AuthService;
import com.aquashield.identity.service.UserAdminService;
import io.grpc.ManagedChannel;
import io.grpc.inprocess.InProcessChannelBuilder;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * gRPC contract integration test (spec: main/identity_and_access_service.md gRPC
 * Contract Checklist) over an in-process server with real Postgres + Redis.
 */
@Testcontainers
@SpringBootTest
class IdentityGrpcIT {

  @Container
  static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @SuppressWarnings("resource")
  static final GenericContainer<?> redis =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  static final String IN_PROCESS = "identity-grpc-it";
  static ManagedChannel channel;

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.data.redis.host", redis::getHost);
    registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    registry.add("BOOTSTRAP_ADMIN_EMAIL", () -> "admin@aquashield.local");
    registry.add("BOOTSTRAP_ADMIN_PASSWORD", () -> "AdminBoot123!");
    registry.add("aquashield.auth.login-rate-limit", () -> 1000);
    registry.add("grpc.server.port", () -> -1);              // no TCP in tests
    registry.add("grpc.server.in-process-name", () -> IN_PROCESS);
  }

  @AfterAll
  static void shutdownChannel() {
    if (channel != null) {
      channel.shutdownNow();
    }
  }

  @Autowired AuthService auth;
  @Autowired UserAdminService admin;

  private IdentityServiceGrpc.IdentityServiceBlockingStub stub() {
    if (channel == null) {
      channel = InProcessChannelBuilder.forName(IN_PROCESS).usePlaintext().build();
    }
    return IdentityServiceGrpc.newBlockingStub(channel);
  }

  @Test
  void grpcContract_endToEnd() {
    // login via service layer -> real JWT + snapshot
    var login = auth.login("admin@aquashield.local", "AdminBoot123!", "127.0.0.1");
    UUID adminId = login.user().userId();

    // ValidateToken: valid token -> identity claims surfaced
    var valid = stub().validateToken(
        ValidateTokenRequest.newBuilder().setToken(login.token()).build());
    assertThat(valid.getValid()).isTrue();
    assertThat(valid.getUserId()).isEqualTo(adminId.toString());
    assertThat(valid.getRole()).isEqualTo("platform_admin");
    assertThat(valid.getAuthzVersion()).isPositive();

    // ValidateToken: garbage -> invalid, no exception
    var invalid = stub().validateToken(
        ValidateTokenRequest.newBuilder().setToken("garbage.token.here").build());
    assertThat(invalid.getValid()).isFalse();
    assertThat(invalid.getError()).isNotBlank();

    // GetAuthorizationSnapshot: rebuild path returns versioned snapshot with features
    var snapshot = stub().getAuthorizationSnapshot(
        GetAuthorizationSnapshotRequest.newBuilder().setUserId(adminId.toString()).build());
    assertThat(snapshot.getVersion()).isPositive();
    assertThat(snapshot.getRoleType()).isEqualTo("platform_admin");
    assertThat(snapshot.getFeaturesList()).isNotEmpty();
    assertThat(snapshot.getFeatures(0).getFeatureAccess()).isEqualTo("*");

    // AuthorizeAction: admin wildcard -> any feature/action allowed
    var allowed = stub().authorizeAction(AuthorizeActionRequest.newBuilder()
        .setUserId(adminId.toString())
        .setFeatureCode("anything")
        .setActionCode("anything")
        .build());
    assertThat(allowed.getAllowed()).isTrue();

    // Onboard a scoped user, then verify deny + project membership via gRPC
    UUID projectId = UUID.randomUUID();
    var onboarded = admin.onboard(new OnboardRequest(
        "grpc.user@aquashield.local", "Password1", "Grpc", "User",
        null, "farm_manager", null, List.of(projectId)), adminId);

    var deniedFeature = stub().authorizeAction(AuthorizeActionRequest.newBuilder()
        .setUserId(onboarded.userId().toString())
        .setFeatureCode("user_management") // not in default grants
        .build());
    assertThat(deniedFeature.getAllowed()).isFalse();
    assertThat(deniedFeature.getReason()).contains("user_management");

    var deniedProject = stub().authorizeAction(AuthorizeActionRequest.newBuilder()
        .setUserId(onboarded.userId().toString())
        .setProjectId(UUID.randomUUID().toString()) // not granted
        .build());
    assertThat(deniedProject.getAllowed()).isFalse();

    var allowedProject = stub().authorizeAction(AuthorizeActionRequest.newBuilder()
        .setUserId(onboarded.userId().toString())
        .setProjectId(projectId.toString())
        .build());
    assertThat(allowedProject.getAllowed()).isTrue();

    // GetProjectUsers: returns the onboarded member with computed full name
    var members = stub().getProjectUsers(
        GetProjectUsersRequest.newBuilder().setProjectId(projectId.toString()).build());
    assertThat(members.getUsersList()).hasSize(1);
    assertThat(members.getUsers(0).getEmail()).isEqualTo("grpc.user@aquashield.local");
    assertThat(members.getUsers(0).getFullName()).isEqualTo("Grpc User");
  }
}
