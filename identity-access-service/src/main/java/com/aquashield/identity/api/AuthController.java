package com.aquashield.identity.api;

import com.aquashield.identity.api.dto.AuthDtos.LoginRequest;
import com.aquashield.identity.api.dto.AuthDtos.LoginResponse;
import com.aquashield.identity.api.dto.AuthDtos.MeResponse;
import com.aquashield.identity.api.dto.AuthDtos.RefreshRequest;
import com.aquashield.identity.api.dto.AuthDtos.RefreshResponse;
import com.aquashield.identity.api.dto.AuthDtos.UpdateMeRequest;
import com.aquashield.identity.config.JwtAuthFilter.Principal;
import com.aquashield.identity.service.AuthService;
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

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/login")
  public LoginResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
    return auth.login(body.email(), body.password(), clientIp(request));
  }

  @PostMapping("/refresh")
  public RefreshResponse refresh(@Valid @RequestBody RefreshRequest body) {
    return auth.refresh(body.refreshToken());
  }

  /** PARITY: always 200 {"message": "Logged out successfully"}. */
  @PostMapping("/logout")
  public ResponseEntity<Map<String, String>> logout(@AuthenticationPrincipal Principal principal,
                                                    @RequestBody(required = false) RefreshRequest body) {
    auth.logout(principal.jti(), principal.expiresAt(),
        body == null ? null : body.refreshToken());
    return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
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
}
