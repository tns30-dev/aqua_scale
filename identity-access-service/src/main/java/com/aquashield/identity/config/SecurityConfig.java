package com.aquashield.identity.config;

import com.aquashield.identity.service.TokenRevocationService;
import com.aquashield.identity.service.TokenService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Stateless bearer-JWT security. Public: login, refresh, health probes.
 * Everything else requires a valid (non-revoked) access token.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, TokenService tokens,
                                  TokenRevocationService revocations) throws Exception {
    http
        .csrf(csrf -> csrf.disable()) // bearer model: no cookies -> no CSRF surface
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            // error dispatch must pass or 403s get rewritten to 401 by the entry point
            .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
            .requestMatchers("/api/auth/login", "/api/auth/refresh").permitAll()
            .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
            .anyRequest().authenticated())
        .exceptionHandling(e -> e.authenticationEntryPoint(
            new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
        .addFilterBefore(new JwtAuthFilter(tokens, revocations),
            UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    // bcrypt default; delegating encoder leaves room for a PBKDF2 decoder if monolith
    // user records are ever migrated with their Django hashes.
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
  }
}
