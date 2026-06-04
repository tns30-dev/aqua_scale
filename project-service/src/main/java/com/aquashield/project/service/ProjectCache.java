package com.aquashield.project.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Read-through Redis caches (spec: main/project_service.md Cache Checklist + redis.md).
 * Keys: per-project settings use the decided pattern `project:parameters:{projectId}`;
 * global catalogues use `project:catalogue:{name}` (extension logged in tracker).
 * Every key has a TTL; invalidation on every write (settings update, profile change).
 */
@Component
public class ProjectCache {

  private final StringRedisTemplate redis;
  private final Duration catalogueTtl;
  private final Duration settingsTtl;

  public ProjectCache(StringRedisTemplate redis,
                      @Value("${aquashield.cache.catalogue-ttl:PT1H}") Duration catalogueTtl,
                      @Value("${aquashield.cache.settings-ttl:PT15M}") Duration settingsTtl) {
    this.redis = redis;
    this.catalogueTtl = catalogueTtl;
    this.settingsTtl = settingsTtl;
  }

  public static String settingsKey(UUID projectId) {
    return "project:parameters:" + projectId;
  }

  public static String catalogueKey(String name) {
    return "project:catalogue:" + name;
  }

  /** Read-through with TTL; cache failures fall through to the loader (non-critical cache). */
  public String catalogue(String name, Supplier<String> loader) {
    return readThrough(catalogueKey(name), catalogueTtl, loader);
  }

  public String settings(UUID projectId, Supplier<String> loader) {
    return readThrough(settingsKey(projectId), settingsTtl, loader);
  }

  public void invalidateSettings(UUID projectId) {
    redis.delete(settingsKey(projectId));
  }

  public void invalidateCatalogue(String name) {
    redis.delete(catalogueKey(name));
  }

  private String readThrough(String key, Duration ttl, Supplier<String> loader) {
    try {
      String cached = redis.opsForValue().get(key);
      if (cached != null) {
        return cached;
      }
    } catch (Exception ignored) {
      // non-critical cache: fall through to source on Redis trouble
    }
    String value = loader.get();
    try {
      redis.opsForValue().set(key, value, ttl);
    } catch (Exception ignored) {
      // best-effort write-back
    }
    return value;
  }
}
