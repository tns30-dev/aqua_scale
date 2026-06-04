package com.aquashield.project.config;

import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.AuthzSnapshotConsumer;
import com.aquashield.common.security.JwtVerifier;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * THE designed resource-service auth flow (main/authn_authz.md "Normal API Request Flow"):
 *  1. Verify JWT locally (signature/iss/aud/exp via Identity's public key).
 *  2. Load the Redis authz snapshot at the token's authzVersion.
 *  3. Snapshot present  -> authenticated principal carrying the snapshot (feature/ACL
 *     checks happen at the endpoint layer from snapshot data).
 *  4. Snapshot missing/stale -> FAIL CLOSED: request stays anonymous -> 401. The client
 *     refreshes (Identity rebuilds the snapshot) and retries.
 */
public class SnapshotAuthFilter extends OncePerRequestFilter {

  private final JwtVerifier verifier;
  private final AuthzSnapshotConsumer snapshots;

  public SnapshotAuthFilter(JwtVerifier verifier, AuthzSnapshotConsumer snapshots) {
    this.verifier = verifier;
    this.snapshots = snapshots;
  }

  /** Principal = identity claims + the authorization snapshot for this request. */
  public record SnapshotPrincipal(UUID userId, String role, AuthzSnapshot snapshot) {

    public boolean hasProjectAccess(UUID projectId) {
      return snapshot.hasProjectAccess(projectId);
    }

    public boolean isPlatformAdmin() {
      return "platform_admin".equals(role);
    }
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                  FilterChain chain) throws ServletException, IOException {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) {
      try {
        Claims claims = verifier.verify(header.substring(7));
        UUID userId = UUID.fromString(claims.getSubject());
        long version = claims.get(JwtVerifier.CLAIM_AUTHZ_VERSION, Long.class);
        // fail closed: only a present, readable snapshot authenticates the request
        snapshots.get(userId, version).ifPresent(snapshot -> {
          String role = claims.get(JwtVerifier.CLAIM_ROLE, String.class);
          var principal = new SnapshotPrincipal(userId, role, snapshot);
          var authorities = principal.isPlatformAdmin()
              ? List.of(new SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN"))
              : List.<SimpleGrantedAuthority>of();
          SecurityContextHolder.getContext().setAuthentication(
              new UsernamePasswordAuthenticationToken(principal, null, authorities));
        });
      } catch (JwtException | IllegalArgumentException | NullPointerException ignored) {
        // invalid token -> anonymous -> 401 on protected routes
      }
    }
    chain.doFilter(request, response);
  }
}
