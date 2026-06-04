package com.aquashield.identity.grpc;

import com.aquashield.api.identity.v1.AuthorizationSnapshot;
import com.aquashield.api.identity.v1.AuthorizeActionRequest;
import com.aquashield.api.identity.v1.AuthorizeActionResponse;
import com.aquashield.api.identity.v1.FeatureAction;
import com.aquashield.api.identity.v1.GetAuthorizationSnapshotRequest;
import com.aquashield.api.identity.v1.GetProjectUsersRequest;
import com.aquashield.api.identity.v1.GetProjectUsersResponse;
import com.aquashield.api.identity.v1.GetUserAccessRequest;
import com.aquashield.api.identity.v1.IdentityServiceGrpc;
import com.aquashield.api.identity.v1.ProjectUser;
import com.aquashield.api.identity.v1.UserAccess;
import com.aquashield.api.identity.v1.ValidateTokenRequest;
import com.aquashield.api.identity.v1.ValidateTokenResponse;
import com.aquashield.common.authz.FeatureActionEntry;
import com.aquashield.identity.domain.User;
import com.aquashield.identity.repo.UserProjectRepository;
import com.aquashield.identity.repo.UserRepository;
import com.aquashield.identity.service.AuthzSnapshotService;
import com.aquashield.identity.service.RbacService;
import com.aquashield.identity.service.TokenRevocationService;
import com.aquashield.identity.service.TokenService;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Internal gRPC API (spec: main/identity_and_access_service.md gRPC Contract Checklist).
 *
 * NOT the hot path (main/authn_authz.md): resource services validate JWTs locally and
 * read the Redis snapshot. These RPCs serve snapshot rebuild / cache-miss recovery,
 * admin/support queries, and fresh-verification fallbacks. In-cluster only — protected
 * by NetworkPolicy + mesh mTLS, never exposed through the public gateway.
 */
@Service
public class IdentityGrpcService extends IdentityServiceGrpc.IdentityServiceImplBase {

  private final TokenService tokens;
  private final TokenRevocationService revocations;
  private final AuthzSnapshotService snapshots;
  private final RbacService rbac;
  private final UserRepository users;
  private final UserProjectRepository userProjects;

  public IdentityGrpcService(TokenService tokens, TokenRevocationService revocations,
                             AuthzSnapshotService snapshots, RbacService rbac,
                             UserRepository users, UserProjectRepository userProjects) {
    this.tokens = tokens;
    this.revocations = revocations;
    this.snapshots = snapshots;
    this.rbac = rbac;
    this.users = users;
    this.userProjects = userProjects;
  }

  @Override
  public void validateToken(ValidateTokenRequest request,
                            StreamObserver<ValidateTokenResponse> observer) {
    ValidateTokenResponse.Builder resp = ValidateTokenResponse.newBuilder();
    try {
      Claims claims = tokens.validate(request.getToken());
      if (revocations.isRevoked(claims.getId())) {
        resp.setValid(false).setError("Token revoked");
      } else {
        resp.setValid(true)
            .setUserId(claims.getSubject())
            .setRole(claims.get(TokenService.CLAIM_ROLE, String.class))
            .setAuthzVersion(claims.get(TokenService.CLAIM_AUTHZ_VERSION, Long.class));
      }
    } catch (JwtException | IllegalArgumentException e) {
      resp.setValid(false).setError("Invalid token");
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  public void getAuthorizationSnapshot(GetAuthorizationSnapshotRequest request,
                                       StreamObserver<AuthorizationSnapshot> observer) {
    User user = findUser(request.getUserId(), observer);
    if (user == null) {
      return;
    }
    var snapshot = snapshots.rebuild(user); // controlled rebuild = the cache-miss recovery path
    AuthorizationSnapshot.Builder resp = AuthorizationSnapshot.newBuilder()
        .setUserId(snapshot.userId().toString())
        .setVersion(snapshot.version())
        .setRoleType(snapshot.roleType())
        .setIssuedAt(snapshot.issuedAt().toString())
        .setExpiresAt(snapshot.expiresAt().toString());
    addFeatures(resp::addFeatures, snapshot.features());
    snapshot.projectIds().forEach(id -> resp.addProjectIds(id.toString()));
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  public void getUserAccess(GetUserAccessRequest request, StreamObserver<UserAccess> observer) {
    User user = findUser(request.getUserId(), observer);
    if (user == null) {
      return;
    }
    UserAccess.Builder resp = UserAccess.newBuilder().setRole(user.getRole());
    addFeatures(resp::addFeatures, user.getFeatureActionAssigned());
    rbac.getUserProjectIds(user.getUserId()).forEach(id -> resp.addProjectIds(id.toString()));
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  public void authorizeAction(AuthorizeActionRequest request,
                              StreamObserver<AuthorizeActionResponse> observer) {
    User user = findUser(request.getUserId(), observer);
    if (user == null) {
      return;
    }
    String reason = "";
    boolean allowed = true;
    if (!user.isActive()) {
      allowed = false;
      reason = "User disabled";
    } else if (!request.getFeatureCode().isEmpty()
        && !rbac.hasFeatureAccess(user, request.getFeatureCode())) {
      allowed = false;
      reason = "Missing feature access: " + request.getFeatureCode();
    } else if (!request.getActionCode().isEmpty()
        && !rbac.hasActionControl(user, request.getActionCode())) {
      allowed = false;
      reason = "Missing action control: " + request.getActionCode();
    } else if (!request.getProjectId().isEmpty()
        && !rbac.hasProjectAccess(user.getUserId(), UUID.fromString(request.getProjectId()))) {
      allowed = false;
      reason = "No access to project: " + request.getProjectId();
    }
    observer.onNext(AuthorizeActionResponse.newBuilder()
        .setAllowed(allowed)
        .setReason(reason)
        .build());
    observer.onCompleted();
  }

  @Override
  public void getProjectUsers(GetProjectUsersRequest request,
                              StreamObserver<GetProjectUsersResponse> observer) {
    GetProjectUsersResponse.Builder resp = GetProjectUsersResponse.newBuilder();
    for (var grant : userProjects.findByProjectId(UUID.fromString(request.getProjectId()))) {
      users.findById(grant.getUserId()).ifPresent(u -> resp.addUsers(ProjectUser.newBuilder()
          .setUserId(u.getUserId().toString())
          .setEmail(u.getEmail())
          .setFullName(u.fullName())
          .setRole(u.getRole())));
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  private void addFeatures(java.util.function.Consumer<FeatureAction> sink,
                           List<FeatureActionEntry> entries) {
    if (entries == null) {
      return;
    }
    for (FeatureActionEntry e : entries) {
      if (e == null || e.featureAccess() == null) {
        continue;
      }
      FeatureAction.Builder fa = FeatureAction.newBuilder().setFeatureAccess(e.featureAccess());
      if (e.actionControls() != null) {
        fa.addAllActionControls(e.actionControls());
      }
      sink.accept(fa.build());
    }
  }

  private User findUser(String userId, StreamObserver<?> observer) {
    try {
      User user = users.findById(UUID.fromString(userId)).orElse(null);
      if (user == null) {
        observer.onError(Status.NOT_FOUND.withDescription("User not found").asRuntimeException());
      }
      return user;
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT.withDescription("Invalid user id").asRuntimeException());
      return null;
    }
  }
}
