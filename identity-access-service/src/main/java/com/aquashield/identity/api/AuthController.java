package com.aquashield.identity.api;

import com.aquashield.common.security.BrowserAuth;
import com.aquashield.identity.api.dto.AuthDtos.LoginRequest;
import com.aquashield.identity.api.dto.AuthDtos.LoginResponse;
import com.aquashield.identity.api.dto.AuthDtos.MeResponse;
import com.aquashield.identity.api.dto.AuthDtos.RefreshRequest;
import com.aquashield.identity.api.dto.AuthDtos.RefreshResponse;
import com.aquashield.identity.api.dto.AuthDtos.UpdateMeRequest;
import com.aquashield.identity.config.JwtAuthFilter.Principal;
import com.aquashield.identity.service.AuthService;
import com.aquashield.identity.service.RefreshTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService auth;
  private final AuthCookieSupport cookies;

  public AuthController(AuthService auth, AuthCookieSupport cookies) {
    this.auth = auth;
    this.cookies = cookies;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest body,
                                             HttpServletRequest request) {
    LoginResponse response = auth.login(body.email(), body.password(), clientIp(request));
    return ResponseEntity.ok()
        .headers(cookies.issue(response.token(), response.refreshToken()))
        .body(response);
  }

  @PostMapping("/refresh")
  public ResponseEntity<RefreshResponse> refresh(@RequestBody(required = false) RefreshRequest body,
                                                 HttpServletRequest request) {
    boolean fromCookie = !hasBodyRefreshToken(body);
    if (fromCookie && !BrowserAuth.csrfMatches(csrfHeader(request), request.getHeader("Cookie"))) {
      throw new CsrfFailureException();
    }
    RefreshResponse response = auth.refresh(refreshToken(body, request));
    return ResponseEntity.ok()
        .headers(cookies.issue(response.token(), response.refreshToken()))
        .body(response);
  }

  /** PARITY: always 200 {"message": "Logged out successfully"}. */
  @PostMapping("/logout")
  public ResponseEntity<Map<String, String>> logout(@AuthenticationPrincipal Principal principal,
                                                    @RequestBody(required = false) RefreshRequest body,
                                                    HttpServletRequest request) {
    auth.logout(principal.jti(), principal.expiresAt(),
        refreshTokenOrNull(body, request));
    return ResponseEntity.ok()
        .headers(cookies.clear())
        .body(Map.of("message", "Logged out successfully"));
  }

  @GetMapping("/me")
  public MeResponse me(@AuthenticationPrincipal Principal principal) {
    return auth.me(principal.userId());
  }

  @PatchMapping("/me")
  public MeResponse updateMe(@AuthenticationPrincipal Principal principal,
                             @RequestBody UpdateMeRequest body) {
    return auth.updateMe(principal.userId(), body.firstName(), body.lastName(),
        body.mobileNumber());
  }

  private static String clientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    return forwarded != null ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
  }

  private static boolean hasBodyRefreshToken(RefreshRequest body) {
    return body != null && body.refreshToken() != null && !body.refreshToken().isBlank();
  }

  private static String refreshToken(RefreshRequest body, HttpServletRequest request) {
    String token = refreshTokenOrNull(body, request);
    if (token == null) {
      throw new RefreshTokenService.InvalidRefreshTokenException("Refresh token is required");
    }
    return token;
  }

  private static String refreshTokenOrNull(RefreshRequest body, HttpServletRequest request) {
    if (hasBodyRefreshToken(body)) {
      return body.refreshToken();
    }
    return BrowserAuth.cookieValue(request.getHeader("Cookie"), BrowserAuth.REFRESH_TOKEN_COOKIE)
        .orElse(null);
  }

  private static String csrfHeader(HttpServletRequest request) {
    String header = request.getHeader(BrowserAuth.CSRF_HEADER);
    return header != null ? header : request.getHeader(BrowserAuth.CSRF_ALT_HEADER);
  }

  public static class CsrfFailureException extends RuntimeException {}
}
