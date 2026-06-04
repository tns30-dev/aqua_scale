package com.aquashield.notification.service;

import com.aquashield.api.project.v1.GetParameterSettingsRequest;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Project parameter thresholds keyed by parameter_code (the monolith threshold_map),
 * sourced from Project gRPC GetParameterSettings and Redis-cached
 * (key notification:threshold:{projectId} per main/redis.md; thresholds are
 * project-level in the monolith). Invalidated by the project.settings.updated consumer.
 */
@Service
public class ThresholdCache {

  /** hasMin/hasMax mirror the proto's NULL-side flags (NULL side never breaches). */
  public record Threshold(String parameterCode, double min, double max,
                          boolean hasMin, boolean hasMax) {}

  private final ProjectServiceGrpc.ProjectServiceBlockingStub project;
  private final StringRedisTemplate redis;
  private final ObjectMapper mapper;
  private final Duration ttl;

  public ThresholdCache(ProjectServiceGrpc.ProjectServiceBlockingStub project,
                        StringRedisTemplate redis, ObjectMapper mapper,
                        @Value("${aquashield.notification.threshold-cache-ttl:PT15M}") Duration ttl) {
    this.project = project;
    this.redis = redis;
    this.mapper = mapper;
    this.ttl = ttl;
  }

  public Map<String, Threshold> forProject(UUID projectId) {
    String key = key(projectId);
    try {
      String cached = redis.opsForValue().get(key);
      if (cached != null) {
        return mapper.readValue(cached, mapper.getTypeFactory()
            .constructMapType(HashMap.class, String.class, Threshold.class));
      }
    } catch (Exception ignored) {
      // non-critical cache: fall through to source
    }
    Map<String, Threshold> map = new HashMap<>();
    var resp = project.getParameterSettings(GetParameterSettingsRequest.newBuilder()
        .setProjectId(projectId.toString()).build());
    for (var s : resp.getSettingsList()) {
      // PARITY: map keyed by parameter_code (the ParameterType.name alias)
      map.put(s.getParameterCode(), new Threshold(s.getParameterCode(),
          s.getMinValue(), s.getMaxValue(), s.getHasMin(), s.getHasMax()));
    }
    try {
      redis.opsForValue().set(key, mapper.writeValueAsString(map), ttl);
    } catch (Exception ignored) {
      // best-effort write-back
    }
    return map;
  }

  public void invalidate(UUID projectId) {
    redis.delete(key(projectId));
  }

  private static String key(UUID projectId) {
    return "notification:threshold:" + projectId;
  }
}
