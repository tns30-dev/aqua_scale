package com.aquashield.identity.service;

import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.identity.config.AuthProperties;
import com.aquashield.identity.domain.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The Redis authorization snapshot — the HOT PATH read model every other service uses
 * for feature/ACL checks instead of calling Identity (main/authn_authz.md, redis.md).
 *
 * Keys (per main/redis.md):
 *   authz:snapshot:{userId}:{version} -> snapshot JSON, TTL
 *   authz:version:{userId}            -> active version (monotonic counter)
 *
 * Identity OWNS build/version/invalidate. Cloud SQL stays the source of truth.
 * Consumers fail closed when the snapshot for the JWT's version is missing.
 *
 * Note: pondIdsByProject / deviceIdsByProject / deniedFeatures are NEW capabilities
 * (no monolith equivalent) — emitted empty until pond/device ACLs are introduced.
 */
@Service
public class AuthzSnapshotService {

  private final StringRedisTemplate redis;
  private final RbacService rbac;
  private final AuthProperties props;
  private final ObjectMapper mapper;

  public AuthzSnapshotService(StringRedisTemplate redis, RbacService rbac,
                              AuthProperties props, ObjectMapper mapper) {
    this.redis = redis;
    this.rbac = rbac;
    this.props = props;
    this.mapper = mapper;
  }

  // Snapshot record = com.aquashield.common.authz.AuthzSnapshot — the cross-service
  // contract lives in `common` so producers and consumers can never diverge.

  /** Build + store a fresh snapshot from Cloud SQL state; bumps the active version. */
  public AuthzSnapshot buildForLogin(User user) {
    long version = redis.opsForValue().increment(versionKey(user.getUserId()));
    AuthzSnapshot snapshot = snapshotOf(user, version);
    store(snapshot);
    return snapshot;
  }

  /** Rebuild at the CURRENT active version (cache-miss recovery path). */
  public AuthzSnapshot rebuild(User user) {
    long version = currentVersion(user.getUserId());
    if (version == 0) {
      return buildForLogin(user);
    }
    AuthzSnapshot snapshot = snapshotOf(user, version);
    store(snapshot);
    return snapshot;
  }

  /**
   * Invalidate on any role/feature/project-access/status change: bump version (stale
   * JWTs now point at a missing snapshot -> consumers fail closed / force re-auth).
   */
  public void invalidate(UUID userId) {
    Long old = redis.opsForValue().increment(versionKey(userId));
    if (old != null && old > 1) {
      redis.delete(snapshotKey(userId, old - 1));
    }
  }

  public long currentVersion(UUID userId) {
    String v = redis.opsForValue().get(versionKey(userId));
    return v == null ? 0 : Long.parseLong(v);
  }

  public AuthzSnapshot get(UUID userId, long version) {
    String json = redis.opsForValue().get(snapshotKey(userId, version));
    if (json == null) {
      return null;
    }
    try {
      return mapper.readValue(json, AuthzSnapshot.class);
    } catch (JsonProcessingException e) {
      return null; // unreadable snapshot -> treat as missing (fail closed)
    }
  }

  private AuthzSnapshot snapshotOf(User user, long version) {
    Instant now = Instant.now();
    return new AuthzSnapshot(
        user.getUserId(),
        version,
        user.getRole(),
        user.getFeatureActionAssigned(),
        rbac.getUserProjectIds(user.getUserId()),
        Map.of(),
        Map.of(),
        List.of(),
        now,
        now.plus(props.authzSnapshotTtl()));
  }

  private void store(AuthzSnapshot snapshot) {
    try {
      redis.opsForValue().set(
          snapshotKey(snapshot.userId(), snapshot.version()),
          mapper.writeValueAsString(snapshot),
          props.authzSnapshotTtl());
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Cannot serialize authz snapshot", e);
    }
  }

  private static String snapshotKey(UUID userId, long version) {
    return "authz:snapshot:" + userId + ":" + version;
  }

  private static String versionKey(UUID userId) {
    return "authz:version:" + userId;
  }
}
