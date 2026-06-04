package com.aquashield.identity.service;

import com.aquashield.identity.config.AuthProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Login abuse counters (key: ratelimit:login:{ipOrUser} per main/redis.md).
 * NEW capability — the monolith had no lockout/rate limiting (parity spec §9).
 * Counts ALL attempts in the window; blocks when over the limit.
 */
@Service
public class LoginRateLimiter {

  private final StringRedisTemplate redis;
  private final AuthProperties props;

  public LoginRateLimiter(StringRedisTemplate redis, AuthProperties props) {
    this.redis = redis;
    this.props = props;
  }

  /** Returns true when the attempt is allowed; false when rate-limited. */
  public boolean tryAcquire(String identifier) {
    String key = "ratelimit:login:" + identifier;
    Long count = redis.opsForValue().increment(key);
    if (count != null && count == 1) {
      redis.expire(key, props.loginRateWindow());
    }
    return count == null || count <= props.loginRateLimit();
  }
}
