package com.aquashield.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "aquashield.auth")
public record AuthProperties(
    Duration refreshTokenTtl,
    Duration authzSnapshotTtl,
    int loginRateLimit,
    Duration loginRateWindow) {
}
