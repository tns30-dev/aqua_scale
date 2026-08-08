package com.aquashield.identity.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class CsrfController {

  private final AuthCookieSupport cookies;

  public CsrfController(AuthCookieSupport cookies) {
    this.cookies = cookies;
  }

  @GetMapping("/api/csrf")
  public ResponseEntity<Map<String, Object>> csrf() {
    AuthCookieSupport.CsrfBootstrap csrf = cookies.csrfOnly();
    return ResponseEntity.ok()
        .headers(csrf.headers())
        .body(Map.of("ok", true, "csrfToken", csrf.token()));
  }
}
