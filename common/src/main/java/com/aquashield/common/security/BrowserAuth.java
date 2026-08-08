package com.aquashield.common.security;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

/**
 * Shared browser-auth transport helpers. Header bearer tokens stay supported for
 * service tests, scripts, and load tools; browser sessions use HttpOnly cookies.
 */
public final class BrowserAuth {

  public static final String ACCESS_TOKEN_COOKIE = "access_token";
  public static final String REFRESH_TOKEN_COOKIE = "refresh_token";
  public static final String CSRF_COOKIE = "csrftoken";
  public static final String CSRF_HEADER = "X-CSRFToken";
  public static final String CSRF_ALT_HEADER = "X-CSRF-Token";

  private BrowserAuth() {}

  public enum TokenSource {
    HEADER,
    COOKIE
  }

  public record AuthToken(String token, TokenSource source) {
    public boolean fromCookie() {
      return source == TokenSource.COOKIE;
    }
  }

  public static Optional<AuthToken> bearerOrCookie(String authorizationHeader, String cookieHeader) {
    Optional<String> bearer = bearerToken(authorizationHeader);
    if (bearer.isPresent()) {
      return Optional.of(new AuthToken(bearer.get(), TokenSource.HEADER));
    }
    return cookieValue(cookieHeader, ACCESS_TOKEN_COOKIE)
        .map(token -> new AuthToken(token, TokenSource.COOKIE));
  }

  public static Optional<String> bearerToken(String authorizationHeader) {
    if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
      return Optional.empty();
    }
    String token = authorizationHeader.substring(7).trim();
    return token.isBlank() ? Optional.empty() : Optional.of(token);
  }

  public static Optional<String> cookieValue(String cookieHeader, String name) {
    if (cookieHeader == null || cookieHeader.isBlank() || name == null || name.isBlank()) {
      return Optional.empty();
    }
    String prefix = name + "=";
    for (String part : cookieHeader.split(";")) {
      String cookie = part.trim();
      if (cookie.startsWith(prefix)) {
        String value = cookie.substring(prefix.length()).trim();
        return value.isBlank() ? Optional.empty() : Optional.of(decode(value));
      }
    }
    return Optional.empty();
  }

  public static boolean isUnsafeMethod(String method) {
    if (method == null) {
      return true;
    }
    return switch (method.toUpperCase(Locale.ROOT)) {
      case "GET", "HEAD", "OPTIONS", "TRACE" -> false;
      default -> true;
    };
  }

  public static boolean csrfMatches(String csrfHeader, String cookieHeader) {
    if (csrfHeader == null || csrfHeader.isBlank()) {
      return false;
    }
    return cookieValue(cookieHeader, CSRF_COOKIE)
        .filter(cookie -> cookie.equals(csrfHeader.trim()))
        .isPresent();
  }

  private static String decode(String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }
}
