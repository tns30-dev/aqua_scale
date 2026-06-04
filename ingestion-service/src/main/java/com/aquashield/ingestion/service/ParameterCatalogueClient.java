package com.aquashield.ingestion.service;

import com.aquashield.api.project.v1.GetParameterCatalogueRequest;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.ingestion.config.IngestionProperties;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * ParameterType id -> code map from Project Service (the catalogue owner).
 *
 * PARITY NOTE: mirrors the monolith's get_allowed_parameter_names @lru_cache — but with a
 * TTL instead of stale-until-restart (a documented FIX, the parity spec flagged the
 * staleness as a real gotcha). Codes — never display names — are the broker tokens.
 */
@Service
public class ParameterCatalogueClient {

  private final ProjectServiceGrpc.ProjectServiceBlockingStub project;
  private final long refreshMillis;

  private volatile Map<String, String> idToCode = Map.of();
  private volatile Instant loadedAt = Instant.EPOCH;

  public ParameterCatalogueClient(ProjectServiceGrpc.ProjectServiceBlockingStub project,
                                  IngestionProperties props) {
    this.project = project;
    this.refreshMillis = props.catalogueRefresh().toMillis();
  }

  /** id -> parameter_code; refreshed lazily on TTL expiry. */
  public Map<String, String> idToCode() {
    if (Instant.now().toEpochMilli() - loadedAt.toEpochMilli() > refreshMillis
        || idToCode.isEmpty()) {
      synchronized (this) {
        if (Instant.now().toEpochMilli() - loadedAt.toEpochMilli() > refreshMillis
            || idToCode.isEmpty()) {
          Map<String, String> fresh = new HashMap<>();
          project.getParameterCatalogue(GetParameterCatalogueRequest.getDefaultInstance())
              .getParametersList()
              .forEach(p -> fresh.put(p.getParameterTypeId(), p.getCode()));
          idToCode = Map.copyOf(fresh);
          loadedAt = Instant.now();
        }
      }
    }
    return idToCode;
  }
}
