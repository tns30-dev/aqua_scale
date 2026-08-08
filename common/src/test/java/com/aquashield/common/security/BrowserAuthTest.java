package com.aquashield.common.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BrowserAuthTest {

  @Test
  void bearerTokenTakesPrecedenceOverCookie() {
    var token = BrowserAuth.bearerOrCookie(
        "Bearer header-token", "access_token=cookie-token; csrftoken=abc");

    assertThat(token).isPresent();
    assertThat(token.get().token()).isEqualTo("header-token");
    assertThat(token.get().fromCookie()).isFalse();
  }

  @Test
  void cookieTokenAndCsrfCanAuthenticateBrowserRequest() {
    String cookies = "theme=light; access_token=cookie-token; csrftoken=csrf-123";

    var token = BrowserAuth.bearerOrCookie(null, cookies);

    assertThat(token).isPresent();
    assertThat(token.get().token()).isEqualTo("cookie-token");
    assertThat(token.get().fromCookie()).isTrue();
    assertThat(BrowserAuth.isUnsafeMethod("POST")).isTrue();
    assertThat(BrowserAuth.csrfMatches("csrf-123", cookies)).isTrue();
    assertThat(BrowserAuth.csrfMatches("wrong", cookies)).isFalse();
  }
}
