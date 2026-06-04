package com.aquashield.notification.config;

import com.aquashield.common.authz.AuthzSnapshotConsumer;
import com.aquashield.common.security.JwtVerifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Resource-service security: local JWT verification (Identity's PUBLIC key) + Redis authz
 * snapshot — the designed hot path (main/authn_authz.md). No Identity calls per request.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  JwtVerifier jwtVerifier(@Value("${aquashield.jwt.public-key-pem}") String publicKeyPem,
                          @Value("${aquashield.jwt.issuer}") String issuer,
                          @Value("${aquashield.jwt.audience}") String audience) {
    if (publicKeyPem == null || publicKeyPem.isBlank()) {
      // fail closed at startup: a resource service without the verification key is
      // misconfigured — never run with auth silently disabled.
      throw new IllegalStateException(
          "JWT_PUBLIC_KEY_PEM is required for notification-service (Identity's public key)");
    }
    return new JwtVerifier(publicKeyPem, issuer, audience);
  }

  @Bean
  AuthzSnapshotConsumer authzSnapshotConsumer(StringRedisTemplate redis, ObjectMapper mapper) {
    return new AuthzSnapshotConsumer(redis, mapper);
  }

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, JwtVerifier verifier,
                                  AuthzSnapshotConsumer snapshots) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
            .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
            .anyRequest().authenticated())
        .exceptionHandling(e -> e.authenticationEntryPoint(
            new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
        .addFilterBefore(new SnapshotAuthFilter(verifier, snapshots),
            UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }
}
