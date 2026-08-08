package com.aquashield.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aquashield.auth.cookies")
public record AuthCookieProperties(
    boolean secure,
    String sameSite,
    String domain) {
}
