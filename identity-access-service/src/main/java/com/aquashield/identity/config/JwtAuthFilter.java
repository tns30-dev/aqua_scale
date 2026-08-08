package com.aquashield.identity.config;

import com.aquashield.common.security.BrowserAuth;
import com.aquashield.identity.service.TokenRevocationService;
import com.aquashield.identity.service.TokenService;
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
 * Local JWT validation (signature/issuer/audience/expiry) + Redis jti revocation check.
 * Per main/authn_authz.md: identity is proven WITHOUT calling Identity gRPC; the
 * authorization snapshot does deep authz in resource services.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

  private final TokenService tokens;
  private final TokenRevocationService revocations;

  public JwtAuthFilter(TokenService tokens, TokenRevocationService revocations) {
    this.tokens = tokens;
    this.revocations = revocations;
  }

  public record Principal(UUID userId, String role, String jti, java.time.Instant expiresAt) {}

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                  FilterChain chain) throws ServletException, IOException {
    var token = BrowserAuth.bearerOrCookie(
        request.getHeader("Authorization"), request.getHeader("Cookie"));
    if (token.isPresent() && !isPublicAuthPath(request)) {
      if (token.get().fromCookie() && BrowserAuth.isUnsafeMethod(request.getMethod())
          && !BrowserAuth.csrfMatches(csrfHeader(request), request.getHeader("Cookie"))) {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"detail\":\"CSRF verification failed.\"}");
        return;
      }
      try {
        Claims claims = tokens.validate(token.get().token());
        if (!revocations.isRevoked(claims.getId())) {
          var principal = new Principal(
              UUID.fromString(claims.getSubject()),
              claims.get(TokenService.CLAIM_ROLE, String.class),
              claims.getId(),
              claims.getExpiration().toInstant());
          var authorities = "platform_admin".equals(principal.role())
              ? List.of(new SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN"))
              : List.<SimpleGrantedAuthority>of();
          var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
          SecurityContextHolder.getContext().setAuthentication(auth);
        }
      } catch (JwtException | IllegalArgumentException ignored) {
        // invalid token -> stay anonymous; entry point returns 401 on protected routes
      }
    }
    chain.doFilter(request, response);
  }

  private static boolean isPublicAuthPath(HttpServletRequest request) {
    String path = request.getRequestURI();
    return "/api/auth/login".equals(path)
        || "/api/auth/refresh".equals(path)
        || "/api/csrf".equals(path);
  }

  private static String csrfHeader(HttpServletRequest request) {
    String header = request.getHeader(BrowserAuth.CSRF_HEADER);
    return header != null ? header : request.getHeader(BrowserAuth.CSRF_ALT_HEADER);
  }
}
