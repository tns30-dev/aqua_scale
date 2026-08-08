package com.aquashield.realtime.ws;

import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.AuthzSnapshotConsumer;
import com.aquashield.common.security.BrowserAuth;
import com.aquashield.common.security.JwtVerifier;
import com.aquashield.realtime.service.WsTokenService;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * POST /ws/token — the spec's authenticated mint step: verify the normal JWT locally
 * (Identity's public key) + load the Redis authz snapshot (FAIL CLOSED), then mint a
 * one-time WS token carrying the user's authorized projectIds.
 *
 * Blocking Redis reads hop to boundedElastic (low-QPS mint path; sockets stay reactive).
 */
@RestController
public class TokenController {

  private final JwtVerifier verifier;
  private final AuthzSnapshotConsumer snapshots;
  private final WsTokenService tokens;

  public TokenController(JwtVerifier verifier, AuthzSnapshotConsumer snapshots,
                         WsTokenService tokens) {
    this.verifier = verifier;
    this.snapshots = snapshots;
    this.tokens = tokens;
  }

  @PostMapping("/ws/token")
  public Mono<ResponseEntity<Map<String, String>>> mint(
      @RequestHeader(name = "Authorization", required = false) String authorization,
      @RequestHeader(name = "Cookie", required = false) String cookie,
      @RequestHeader(name = BrowserAuth.CSRF_HEADER, required = false) String csrf,
      @RequestHeader(name = BrowserAuth.CSRF_ALT_HEADER, required = false) String csrfAlt) {
    return Mono.fromCallable(() -> {
      var token = BrowserAuth.bearerOrCookie(authorization, cookie);
      if (token.isEmpty()) {
        return unauthorized();
      }
      String csrfHeader = csrf != null ? csrf : csrfAlt;
      if (token.get().fromCookie() && !BrowserAuth.csrfMatches(csrfHeader, cookie)) {
        return forbidden();
      }
      try {
        Claims claims = verifier.verify(token.get().token());
        UUID userId = UUID.fromString(claims.getSubject());
        long version = claims.get(JwtVerifier.CLAIM_AUTHZ_VERSION, Long.class);
        Optional<AuthzSnapshot> snapshot = snapshots.get(userId, version);
        if (snapshot.isEmpty()) {
          return unauthorized(); // fail closed: no snapshot, no realtime session
        }
        String wsToken = tokens.mint(userId, snapshot.get().projectIds());
        return ResponseEntity.ok(Map.of("token", wsToken));
      } catch (Exception e) {
        return unauthorized();
      }
    }).subscribeOn(Schedulers.boundedElastic());
  }

  private static ResponseEntity<Map<String, String>> unauthorized() {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("detail", "Unauthorized"));
  }

  private static ResponseEntity<Map<String, String>> forbidden() {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(Map.of("detail", "CSRF verification failed."));
  }
}
