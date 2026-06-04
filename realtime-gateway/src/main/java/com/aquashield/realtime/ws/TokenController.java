package com.aquashield.realtime.ws;

import com.aquashield.common.authz.AuthzSnapshot;
import com.aquashield.common.authz.AuthzSnapshotConsumer;
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
      @RequestHeader(name = "Authorization", required = false) String authorization) {
    return Mono.fromCallable(() -> {
      if (authorization == null || !authorization.startsWith("Bearer ")) {
        return unauthorized();
      }
      try {
        Claims claims = verifier.verify(authorization.substring(7));
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
}
