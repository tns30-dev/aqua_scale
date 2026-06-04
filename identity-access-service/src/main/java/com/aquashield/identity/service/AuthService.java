package com.aquashield.identity.service;

import com.aquashield.identity.api.dto.AuthDtos.LoginResponse;
import com.aquashield.identity.api.dto.AuthDtos.MeResponse;
import com.aquashield.identity.api.dto.AuthDtos.ProjectRef;
import com.aquashield.identity.api.dto.AuthDtos.RefreshResponse;
import com.aquashield.identity.api.dto.AuthDtos.SessionUser;
import com.aquashield.identity.domain.User;
import com.aquashield.identity.repo.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Login / refresh / logout / me orchestration per main/authn_authz.md flows.
 *
 * PARITY: failures (bad credentials, unknown email, disabled account) all return the
 * same generic 401 message — no information leakage about which factor failed.
 */
@Service
public class AuthService {

  /** PARITY: exact monolith failure message (SimpleJWT default). */
  public static final String GENERIC_LOGIN_FAILURE = "No active account found with the given credentials";

  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;
  private final TokenService tokens;
  private final RefreshTokenService refreshTokens;
  private final AuthzSnapshotService snapshots;
  private final TokenRevocationService revocations;
  private final LoginRateLimiter rateLimiter;
  private final RbacService rbac;

  public AuthService(UserRepository users, PasswordEncoder passwordEncoder, TokenService tokens,
                     RefreshTokenService refreshTokens, AuthzSnapshotService snapshots,
                     TokenRevocationService revocations, LoginRateLimiter rateLimiter,
                     RbacService rbac) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
    this.tokens = tokens;
    this.refreshTokens = refreshTokens;
    this.snapshots = snapshots;
    this.revocations = revocations;
    this.rateLimiter = rateLimiter;
    this.rbac = rbac;
  }

  @Transactional(readOnly = true)
  public LoginResponse login(String email, String password, String clientIp) {
    if (!rateLimiter.tryAcquire(email.toLowerCase()) || !rateLimiter.tryAcquire(clientIp)) {
      throw new RateLimitedException();
    }
    User user = users.findByEmailIgnoreCase(email).orElse(null);
    if (user == null || !user.isActive()
        || !passwordEncoder.matches(password, user.getPasswordHash())) {
      throw new InvalidCredentialsException(); // same generic 401 for all three cases
    }
    var snapshot = snapshots.buildForLogin(user);
    var access = tokens.issueAccessToken(user.getUserId(), user.getRole(), snapshot.version());
    String refresh = refreshTokens.issue(user.getUserId());
    return new LoginResponse(access.token(), refresh, sessionUser(user), projectRefs(user.getUserId()));
  }

  @Transactional(readOnly = true)
  public RefreshResponse refresh(String rawRefreshToken) {
    var rotation = refreshTokens.rotate(rawRefreshToken);
    User user = users.findById(rotation.userId())
        .filter(User::isActive)
        .orElseThrow(() -> new RefreshTokenService.InvalidRefreshTokenException(
            "User disabled or missing"));
    long version = snapshots.currentVersion(user.getUserId());
    if (version == 0 || snapshots.get(user.getUserId(), version) == null) {
      // snapshot expired/invalidated -> rebuild at refresh time (controlled recovery)
      version = snapshots.rebuild(user).version();
    }
    var access = tokens.issueAccessToken(user.getUserId(), user.getRole(), version);
    return new RefreshResponse(access.token(), rotation.newToken());
  }

  public void logout(String jti, Instant accessExpiry, String rawRefreshToken) {
    if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
      refreshTokens.revoke(rawRefreshToken);
    }
    if (jti != null) {
      revocations.revoke(jti, accessExpiry);
    }
  }

  @Transactional(readOnly = true)
  public MeResponse me(UUID userId) {
    User user = users.findById(userId).orElseThrow(UserNotFoundException::new);
    return new MeResponse(sessionUser(user), projectRefs(userId));
  }

  /** PARITY: self-update may change firstName/lastName/mobileNumber ONLY (email/role ignored). */
  @Transactional
  public MeResponse updateMe(UUID userId, String firstName, String lastName, String mobileNumber) {
    User user = users.findById(userId).orElseThrow(UserNotFoundException::new);
    if (firstName != null && !firstName.isBlank()) {
      user.setFirstName(firstName);
    }
    if (lastName != null && !lastName.isBlank()) {
      user.setLastName(lastName);
    }
    if (mobileNumber != null) {
      user.setMobileNumber(mobileNumber);
    }
    return new MeResponse(sessionUser(user), projectRefs(userId));
  }

  private SessionUser sessionUser(User user) {
    // PARITY: username = computed full name, never email
    return new SessionUser(user.getUserId(), user.fullName(), user.getRole(),
        user.getFeatureActionAssigned());
  }

  private List<ProjectRef> projectRefs(UUID userId) {
    return rbac.getUserProjectIds(userId).stream().map(ProjectRef::idOnly).toList();
  }

  public static class InvalidCredentialsException extends RuntimeException {}

  public static class RateLimitedException extends RuntimeException {}

  public static class UserNotFoundException extends RuntimeException {}
}
