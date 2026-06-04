package com.aquashield.identity.service;

import com.aquashield.identity.config.AuthProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/**
 * Opaque rotating refresh tokens, Redis-backed, with family-based reuse detection
 * (main/redis.md + authn_authz.md). This is the designed REPLACEMENT for the monolith's
 * silently-no-op blacklist — logout/rotation here truly invalidate server-side.
 *
 * Keys (per main/redis.md — do not invent new patterns):
 *   auth:refresh:{tokenHash}        -> {userId, familyId, current}   TTL = refresh TTL
 *   auth:refresh-family:{familyId}  -> "active" | "revoked"          TTL = refresh TTL
 *
 * Rules:
 *  - Raw tokens are NEVER stored — only SHA-256 hashes.
 *  - Rotation marks the old token current=false (kept until natural expiry so that a
 *    replayed old token is DETECTED as reuse, not just unknown).
 *  - Reuse of a rotated token revokes the whole family (steal-and-replay defense).
 *  - Fail closed: any missing/garbage state -> invalid.
 */
@Service
public class RefreshTokenService {

  private static final SecureRandom RNG = new SecureRandom();

  private final StringRedisTemplate redis;
  private final AuthProperties props;
  private final ObjectMapper mapper;

  public RefreshTokenService(StringRedisTemplate redis, AuthProperties props, ObjectMapper mapper) {
    this.redis = redis;
    this.props = props;
    this.mapper = mapper;
  }

  public record RefreshRecord(UUID userId, String familyId, boolean current) {}

  public record RotationResult(String newToken, UUID userId) {}

  /** Issue the first token of a NEW family (login). Returns the raw opaque token. */
  public String issue(UUID userId) {
    String familyId = UUID.randomUUID().toString();
    redis.opsForValue().set(familyKey(familyId), "active", props.refreshTokenTtl());
    return writeNewToken(userId, familyId);
  }

  /**
   * Validate + rotate. Throws InvalidRefreshTokenException on unknown/expired tokens,
   * revoked families, and DETECTED REUSE (which also revokes the family).
   */
  public RotationResult rotate(String rawToken) {
    String hash = sha256(rawToken);
    RefreshRecord rec = read(hash);
    if (rec == null) {
      throw new InvalidRefreshTokenException("Unknown or expired refresh token");
    }
    String familyState = redis.opsForValue().get(familyKey(rec.familyId()));
    if (!"active".equals(familyState)) {
      throw new InvalidRefreshTokenException("Refresh token family revoked");
    }
    if (!rec.current()) {
      // Reuse of an already-rotated token => assume theft; kill the family.
      revokeFamily(rec.familyId());
      throw new InvalidRefreshTokenException("Refresh token reuse detected — family revoked");
    }
    // Rotate: demote old (kept for reuse detection), mint new in same family.
    write(hash, new RefreshRecord(rec.userId(), rec.familyId(), false));
    String newToken = writeNewToken(rec.userId(), rec.familyId());
    redis.expire(familyKey(rec.familyId()), props.refreshTokenTtl());
    return new RotationResult(newToken, rec.userId());
  }

  /** Logout / forced revocation: kill the family of the presented token (if known). */
  public void revoke(String rawToken) {
    RefreshRecord rec = read(sha256(rawToken));
    if (rec != null) {
      revokeFamily(rec.familyId());
    }
  }

  private String writeNewToken(UUID userId, String familyId) {
    byte[] bytes = new byte[32];
    RNG.nextBytes(bytes);
    String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    write(sha256(raw), new RefreshRecord(userId, familyId, true));
    return raw;
  }

  private void revokeFamily(String familyId) {
    redis.opsForValue().set(familyKey(familyId), "revoked", props.refreshTokenTtl());
  }

  private RefreshRecord read(String hash) {
    String json = redis.opsForValue().get(tokenKey(hash));
    if (json == null) {
      return null;
    }
    try {
      return mapper.readValue(json, RefreshRecord.class);
    } catch (JsonProcessingException e) {
      return null; // garbage state -> treat as invalid (fail closed)
    }
  }

  private void write(String hash, RefreshRecord rec) {
    try {
      redis.opsForValue().set(tokenKey(hash), mapper.writeValueAsString(rec), props.refreshTokenTtl());
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Cannot serialize refresh record", e);
    }
  }

  private static String tokenKey(String hash) {
    return "auth:refresh:" + hash;
  }

  private static String familyKey(String familyId) {
    return "auth:refresh-family:" + familyId;
  }

  static String sha256(String value) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256")
          .digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        sb.append(String.format("%02x", b));
      }
      return sb.toString();
    } catch (Exception e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }

  public static class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException(String message) {
      super(message);
    }
  }
}
