package com.aquashield.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "aquashield.jwt")
public record JwtProperties(
    String issuer,
    String audience,
    Duration accessTokenTtl,
    String privateKeyPem,
    String publicKeyPem) {
}
