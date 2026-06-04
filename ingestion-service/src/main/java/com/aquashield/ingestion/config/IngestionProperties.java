package com.aquashield.ingestion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "aquashield.ingestion")
public record IngestionProperties(
    String subscription,
    boolean hmacEnabled,
    Duration maxSkew,
    Duration catalogueRefresh) {
}
