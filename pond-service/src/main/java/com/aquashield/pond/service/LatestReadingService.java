package com.aquashield.pond.service;

import com.aquashield.api.ingestion.v1.GetLatestReadingsRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.LatestReadingRow;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class LatestReadingService {

  private static final Logger log = LoggerFactory.getLogger(LatestReadingService.class);
  private static final long CACHE_TTL_MILLIS = 2_000L;
  private static final int CACHE_MAX = 128;

  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub;
  private final ConcurrentMap<LatestCacheKey, LatestCacheEntry> latestCache =
      new ConcurrentHashMap<>();
  private final ConcurrentMap<LatestCacheKey, CompletableFuture<Map<String, Object>>> inflight =
      new ConcurrentHashMap<>();

  private record LatestCacheKey(UUID projectId, List<UUID> pondIds) {
    LatestCacheKey {
      pondIds = List.copyOf(pondIds);
    }
  }

  private record LatestCacheEntry(long expiresAtMillis, Map<String, Object> body) {}

  public LatestReadingService(IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub) {
    this.ingestionStub = ingestionStub;
  }

  public Map<String, Object> latestReadings(UUID projectId, List<UUID> pondIds) {
    LatestCacheKey key = new LatestCacheKey(projectId, pondIds);
    Map<String, Object> cached = cachedLatest(key);
    if (cached != null) {
      return cached;
    }

    CompletableFuture<Map<String, Object>> current = new CompletableFuture<>();
    CompletableFuture<Map<String, Object>> existing = inflight.putIfAbsent(key, current);
    if (existing != null) {
      return awaitLatest(existing);
    }
    try {
      Map<String, Object> body = fetchLatestReadings(projectId, pondIds);
      rememberLatest(key, body);
      current.complete(body);
      return body;
    } catch (RuntimeException | Error e) {
      current.completeExceptionally(e);
      throw e;
    } finally {
      inflight.remove(key, current);
    }
  }

  private Map<String, Object> fetchLatestReadings(UUID projectId, List<UUID> pondIds) {
    GetLatestReadingsRequest.Builder request = GetLatestReadingsRequest.newBuilder()
        .setProjectId(projectId.toString());
    pondIds.forEach(pondId -> request.addPondIds(pondId.toString()));

    try {
      List<Map<String, Object>> readings = new ArrayList<>();
      for (LatestReadingRow row : ingestionStub.getLatestReadings(request.build()).getReadingsList()) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("pond_id", row.getPondId());
        item.put("timestamp", row.getMeasuredAt());
        item.put("parameters", new LinkedHashMap<>(row.getValuesMap()));
        item.put("alerts", List.of());
        readings.add(item);
      }
      return Map.of("readings", readings);
    } catch (StatusRuntimeException e) {
      log.warn("ingestion gRPC unavailable for latest readings (project={}): {}",
          projectId, e.getStatus());
      return Map.of("readings", List.of());
    }
  }

  private Map<String, Object> cachedLatest(LatestCacheKey key) {
    long now = System.currentTimeMillis();
    LatestCacheEntry entry = latestCache.get(key);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAtMillis() <= now) {
      latestCache.remove(key, entry);
      return null;
    }
    return entry.body();
  }

  private void rememberLatest(LatestCacheKey key, Map<String, Object> body) {
    long now = System.currentTimeMillis();
    latestCache.put(key, new LatestCacheEntry(now + CACHE_TTL_MILLIS, body));
    pruneLatestCache(now);
  }

  private void pruneLatestCache(long now) {
    for (Map.Entry<LatestCacheKey, LatestCacheEntry> entry : latestCache.entrySet()) {
      if (entry.getValue().expiresAtMillis() <= now) {
        latestCache.remove(entry.getKey(), entry.getValue());
      }
    }
    int overflow = latestCache.size() - CACHE_MAX;
    if (overflow <= 0) {
      return;
    }
    for (LatestCacheKey key : latestCache.keySet()) {
      latestCache.remove(key);
      overflow--;
      if (overflow <= 0) {
        return;
      }
    }
  }

  private static Map<String, Object> awaitLatest(
      CompletableFuture<Map<String, Object>> future) {
    try {
      return future.join();
    } catch (CompletionException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtime) {
        throw runtime;
      }
      if (cause instanceof Error error) {
        throw error;
      }
      throw new IllegalStateException(cause);
    }
  }
}
