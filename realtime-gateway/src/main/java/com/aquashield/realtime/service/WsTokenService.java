package com.aquashield.realtime.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Short-lived ONE-TIME WebSocket tokens (spec: main/websocket.md + redis.md ws:jti).
 *
 * Implementation of the spec's "short-lived WebSocket token": opaque random token whose
 * state lives ONLY in Redis (ws:token:{token}, TTL ~60s). Consumption is atomic GETDEL —
 * a replayed token finds nothing. The token's jti is additionally marked used
 * (ws:jti:{jti}) for the spec's replay-protection evidence.
 */
@Service
public class WsTokenService {

  public record WsTokenClaims(UUID userId, String jti, List<UUID> projectIds) {}

  private static final SecureRandom RNG = new SecureRandom();

  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;
  private final Duration tokenTtl;
  private final Duration subscriptionTtl;

  public WsTokenService(StringRedisTemplate redis, ObjectMapper mapper,
                        @Value("${aquashield.realtime.ws-token-ttl:PT60S}") Duration tokenTtl,
                        @Value("${aquashield.realtime.subscription-ttl:PT5M}") Duration subscriptionTtl) {
    this.redis = redis;
    this.mapper = mapper;
    this.tokenTtl = tokenTtl;
    this.subscriptionTtl = subscriptionTtl;
  }

  /** Mint for an already-authenticated user (JWT + snapshot checked by the caller). */
  public String mint(UUID userId, List<UUID> projectIds) {
    byte[] bytes = new byte[32];
    RNG.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    try {
      WsTokenClaims claims = new WsTokenClaims(userId, UUID.randomUUID().toString(), projectIds);
      redis.opsForValue().set("ws:token:" + token, mapper.writeValueAsString(claims), tokenTtl);
    } catch (Exception e) {
      throw new IllegalStateException("Cannot mint ws token", e);
    }
    return token;
  }

  /** Atomic one-time consume; null = unknown/expired/replayed. */
  public WsTokenClaims consume(String token) {
    String json = redis.opsForValue().getAndDelete("ws:token:" + token);
    if (json == null) {
      return null;
    }
    try {
      WsTokenClaims claims = mapper.readValue(json, WsTokenClaims.class);
      // ws:jti one-time marker (spec replay-protection evidence)
      Boolean fresh = redis.opsForValue().setIfAbsent("ws:jti:" + claims.jti(), "used", tokenTtl);
      return Boolean.TRUE.equals(fresh) ? claims : null;
    } catch (Exception e) {
      return null; // unreadable -> fail closed
    }
  }

  /** Subscription routing metadata with TTL; refreshed on heartbeat (spec). */
  public void registerSubscription(UUID userId, String connectionId, List<UUID> projectIds) {
    try {
      redis.opsForValue().set(subKey(userId, connectionId),
          mapper.writeValueAsString(projectIds), subscriptionTtl);
    } catch (Exception ignored) {
      // routing metadata is best-effort; local registry is authoritative for delivery
    }
  }

  public void refreshSubscription(UUID userId, String connectionId) {
    redis.expire(subKey(userId, connectionId), subscriptionTtl);
  }

  public void removeSubscription(UUID userId, String connectionId) {
    redis.delete(subKey(userId, connectionId));
  }

  private static String subKey(UUID userId, String connectionId) {
    return "ws:sub:" + userId + ":" + connectionId;
  }
}
