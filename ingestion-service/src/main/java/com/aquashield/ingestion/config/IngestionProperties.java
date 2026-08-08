package com.aquashield.ingestion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "aquashield.ingestion")
public record IngestionProperties(
    String subscription,
    boolean hmacEnabled,
    Duration maxSkew,
    Duration catalogueRefresh,
    String telemetryStore,
    Bigtable bigtable,
    BigQuery bigquery) {

  public record Bigtable(
      String projectId,
      String instanceId,
      String tableName,
      boolean writeEnabled) {
  }

  public record BigQuery(
      String projectId,
      String datasetId,
      String readingsTable,
      boolean energyEnabled) {
  }
}
