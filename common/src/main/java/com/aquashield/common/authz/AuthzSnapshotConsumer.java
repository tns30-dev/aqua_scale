package com.aquashield.common.authz;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Optional;
import java.util.UUID;

/**
 * Hot-path snapshot reader for resource services (project, pond, sensor, …).
 *
 * Per main/authn_authz.md: services validate the JWT locally, then load the snapshot at
 * the JWT's authzVersion via this consumer and run feature/ACL checks from it. A missing
 * or unreadable snapshot means the caller MUST fail closed (deny) or trigger a controlled
 * rebuild through Identity gRPC — never silently allow.
 */
public class AuthzSnapshotConsumer {

  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;

  public AuthzSnapshotConsumer(StringRedisTemplate redis, ObjectMapper mapper) {
    this.redis = redis;
    this.mapper = mapper;
  }

  /** Empty = missing/stale/unreadable → FAIL CLOSED at the call site. */
  public Optional<AuthzSnapshot> get(UUID userId, long version) {
    String json = redis.opsForValue().get("authz:snapshot:" + userId + ":" + version);
    if (json == null) {
      return Optional.empty();
    }
    try {
      return Optional.of(mapper.readValue(json, AuthzSnapshot.class));
    } catch (Exception e) {
      return Optional.empty(); // unreadable -> treat as missing (fail closed)
    }
  }

  /** Active version for a user (0 = none known). */
  public long currentVersion(UUID userId) {
    String v = redis.opsForValue().get("authz:version:" + userId);
    return v == null ? 0 : Long.parseLong(v);
  }
}
