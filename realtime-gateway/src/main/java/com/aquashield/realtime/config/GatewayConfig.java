package com.aquashield.realtime.config;

import com.aquashield.common.authz.AuthzSnapshotConsumer;
import com.aquashield.common.security.JwtVerifier;
import com.aquashield.realtime.ws.RealtimeWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.reactive.handler.SimpleUrlHandlerMapping;

import java.util.Map;

@Configuration
public class GatewayConfig {

  @Bean
  JwtVerifier jwtVerifier(@Value("${aquashield.jwt.public-key-pem}") String publicKeyPem,
                          @Value("${aquashield.jwt.issuer}") String issuer,
                          @Value("${aquashield.jwt.audience}") String audience) {
    if (publicKeyPem == null || publicKeyPem.isBlank()) {
      throw new IllegalStateException(
          "JWT_PUBLIC_KEY_PEM is required for realtime-gateway (Identity's public key)");
    }
    return new JwtVerifier(publicKeyPem, issuer, audience);
  }

  @Bean
  AuthzSnapshotConsumer authzSnapshotConsumer(StringRedisTemplate redis, ObjectMapper mapper) {
    return new AuthzSnapshotConsumer(redis, mapper);
  }

  /** /ws upgrade route (the public URL is wss://… — TLS terminates at the LB). */
  @Bean
  SimpleUrlHandlerMapping wsMapping(RealtimeWebSocketHandler handler) {
    return new SimpleUrlHandlerMapping(Map.of("/ws", handler), -1);
  }
}
