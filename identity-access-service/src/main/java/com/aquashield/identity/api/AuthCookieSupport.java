package com.aquashield.identity.api;

import com.aquashield.common.security.BrowserAuth;
import com.aquashield.identity.config.AuthCookieProperties;
import com.aquashield.identity.config.AuthProperties;
import com.aquashield.identity.config.JwtProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

@Component
public class AuthCookieSupport {

  private final JwtProperties jwtProps;
  private final AuthProperties authProps;
  private final AuthCookieProperties cookieProps;
  private final SecureRandom random = new SecureRandom();

  public AuthCookieSupport(JwtProperties jwtProps, AuthProperties authProps,
                           AuthCookieProperties cookieProps) {
    this.jwtProps = jwtProps;
    this.authProps = authProps;
    this.cookieProps = cookieProps;
  }

  public HttpHeaders issue(String accessToken, String refreshToken) {
    HttpHeaders headers = new HttpHeaders();
    headers.add(HttpHeaders.SET_COOKIE, cookie(
        BrowserAuth.ACCESS_TOKEN_COOKIE, accessToken, true, jwtProps.accessTokenTtl()).toString());
    headers.add(HttpHeaders.SET_COOKIE, cookie(
        BrowserAuth.REFRESH_TOKEN_COOKIE, refreshToken, true, authProps.refreshTokenTtl()).toString());
    return headers;
  }

  public CsrfBootstrap csrfOnly() {
    String token = newCsrfToken();
    HttpHeaders headers = new HttpHeaders();
    headers.add(HttpHeaders.SET_COOKIE, csrfCookie(token).toString());
    return new CsrfBootstrap(headers, token);
  }

  public HttpHeaders clear() {
    HttpHeaders headers = new HttpHeaders();
    headers.add(HttpHeaders.SET_COOKIE, cookie(
        BrowserAuth.ACCESS_TOKEN_COOKIE, "", true, Duration.ZERO).toString());
    headers.add(HttpHeaders.SET_COOKIE, cookie(
        BrowserAuth.REFRESH_TOKEN_COOKIE, "", true, Duration.ZERO).toString());
    headers.add(HttpHeaders.SET_COOKIE, cookie(
        BrowserAuth.CSRF_COOKIE, "", false, Duration.ZERO).toString());
    return headers;
  }

  public record CsrfBootstrap(HttpHeaders headers, String token) {}

  private String newCsrfToken() {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private ResponseCookie csrfCookie(String token) {
    return cookie(BrowserAuth.CSRF_COOKIE, token, false, authProps.refreshTokenTtl());
  }

  private ResponseCookie cookie(String name, String value, boolean httpOnly, Duration maxAge) {
    ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
        .httpOnly(httpOnly)
        .secure(cookieProps.secure())
        .sameSite(sameSite())
        .path("/")
        .maxAge(maxAge);
    if (cookieProps.domain() != null && !cookieProps.domain().isBlank()) {
      builder.domain(cookieProps.domain());
    }
    return builder.build();
  }

  private String sameSite() {
    return cookieProps.sameSite() == null || cookieProps.sameSite().isBlank()
        ? "Strict"
        : cookieProps.sameSite();
  }
}
