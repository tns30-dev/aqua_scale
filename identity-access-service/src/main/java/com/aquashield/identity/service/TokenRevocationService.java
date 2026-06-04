package com.aquashield.identity.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * Access-token revocation by jti (key: auth:revoked:{jti} per main/redis.md), kept only
 * until the token's natural expiry. Lets logout/forced revocation take effect BEFORE
 * the 15-minute access token dies — a real fix for the monolith's no-op blacklist.
 */
@Service
public class TokenRevocationService {

  private final StringRedisTemplate redis;

  public TokenRevocationService(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public void revoke(String jti, Instant tokenExpiry) {
    Duration remaining = Duration.between(Instant.now(), tokenExpiry);
    if (!remaining.isNegative() && !remaining.isZero()) {
      redis.opsForValue().set(key(jti), "revoked", remaining);
    }
  }

  public boolean isRevoked(String jti) {
    return jti != null && redis.hasKey(key(jti));
  }

  private static String key(String jti) {
    return "auth:revoked:" + jti;
  }
}
