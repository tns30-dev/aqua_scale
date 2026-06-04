package com.aquashield.realtime.ws;

import com.aquashield.realtime.service.ConnectionRegistry;
import com.aquashield.realtime.service.WsTokenService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The /ws endpoint (spec: main/websocket.md Connection Flow + Implementation Checklist):
 *  - origin allow-list (CSWH protection; empty list = local dev)
 *  - first-frame AUTH within a timeout; unauthenticated sessions closed
 *  - one-time WS token consume (Redis GETDEL + ws:jti) — replay rejected
 *  - bounded auth-frame size
 *  - subscription metadata in Redis with TTL; PING heartbeat refreshes it
 *  - outbound = per-connection sink fed by the project-scoped fanout
 *
 * Public transport is WSS (TLS terminates at the LB/Gateway); plain ws:// is local-only.
 */
@Component
public class RealtimeWebSocketHandler implements WebSocketHandler {

  private static final Logger log = LoggerFactory.getLogger(RealtimeWebSocketHandler.class);
  private static final int MAX_AUTH_FRAME_BYTES = 4096;

  private final WsTokenService tokens;
  private final ConnectionRegistry registry;
  private final ObjectMapper mapper;
  private final Duration authTimeout;
  private final List<String> allowedOrigins;

  public RealtimeWebSocketHandler(WsTokenService tokens, ConnectionRegistry registry,
                                  ObjectMapper mapper,
                                  @Value("${aquashield.realtime.auth-timeout:PT10S}") Duration authTimeout,
                                  @Value("${aquashield.realtime.allowed-origins:}") List<String> allowedOrigins) {
    this.tokens = tokens;
    this.registry = registry;
    this.mapper = mapper;
    this.authTimeout = authTimeout;
    this.allowedOrigins = allowedOrigins == null ? List.of()
        : allowedOrigins.stream().filter(o -> !o.isBlank()).toList();
  }

  @Override
  public Mono<Void> handle(WebSocketSession session) {
    // origin allow-list (spec: CSWH protection); empty = allow (local dev)
    String origin = session.getHandshakeInfo().getHeaders().getOrigin();
    if (!allowedOrigins.isEmpty() && (origin == null || !allowedOrigins.contains(origin))) {
      log.info("WS rejected: origin '{}' not allowed", origin);
      return session.close();
    }

    String connectionId = UUID.randomUUID().toString();
    Sinks.Many<String> outbound = Sinks.many().unicast().onBackpressureBuffer();
    AtomicReference<WsTokenService.WsTokenClaims> authed = new AtomicReference<>();

    // auth timeout: close idle unauthenticated sessions (spec)
    Mono<Void> authWatchdog = Mono.delay(authTimeout)
        .filter(t -> authed.get() == null)
        .flatMap(t -> {
          outbound.tryEmitComplete();
          return session.close();
        })
        .then();

    Mono<Void> inbound = session.receive()
        .map(WebSocketMessage::getPayloadAsText)
        .publishOn(Schedulers.boundedElastic()) // Redis ops off the event loop
        .doOnNext(text -> handleFrame(session, connectionId, outbound, authed, text))
        .doFinally(signal -> {
          WsTokenService.WsTokenClaims claims = authed.get();
          registry.remove(connectionId);
          if (claims != null) {
            tokens.removeSubscription(claims.userId(), connectionId); // clean routing state
          }
        })
        .then();

    Mono<Void> outboundFlow = session.send(
        Flux.merge(outbound.asFlux()).map(session::textMessage));

    return Mono.when(inbound, outboundFlow, authWatchdog);
  }

  private void handleFrame(WebSocketSession session, String connectionId,
                           Sinks.Many<String> outbound,
                           AtomicReference<WsTokenService.WsTokenClaims> authed, String text) {
    try {
      if (text.length() > MAX_AUTH_FRAME_BYTES) { // bounded frames (spec)
        outbound.tryEmitNext("{\"type\":\"ERROR\",\"reason\":\"frame too large\"}");
        outbound.tryEmitComplete();
        return;
      }
      JsonNode frame = mapper.readTree(text);
      String type = frame.path("type").asText("");

      if (authed.get() == null) {
        // first frame MUST be AUTH (spec)
        if (!"AUTH".equals(type)) {
          outbound.tryEmitNext("{\"type\":\"AUTH_FAILED\",\"reason\":\"AUTH frame required\"}");
          outbound.tryEmitComplete();
          return;
        }
        WsTokenService.WsTokenClaims claims = tokens.consume(frame.path("token").asText(""));
        if (claims == null) {
          // unknown / expired / REPLAYED token -> reject + close (spec evidence case)
          outbound.tryEmitNext("{\"type\":\"AUTH_FAILED\",\"reason\":\"invalid or replayed token\"}");
          outbound.tryEmitComplete();
          return;
        }
        authed.set(claims);
        registry.register(connectionId, new ConnectionRegistry.Connection(
            claims.userId(), new HashSet<>(claims.projectIds()), outbound));
        tokens.registerSubscription(claims.userId(), connectionId, claims.projectIds());
        outbound.tryEmitNext("{\"type\":\"AUTH_OK\",\"connectionId\":\"" + connectionId + "\"}");
        return;
      }

      if ("PING".equals(type)) { // heartbeat refreshes the subscription TTL (spec)
        tokens.refreshSubscription(authed.get().userId(), connectionId);
        outbound.tryEmitNext("{\"type\":\"PONG\"}");
      }
    } catch (Exception e) {
      log.debug("Bad WS frame on {}: {}", connectionId, e.toString());
      outbound.tryEmitNext("{\"type\":\"ERROR\",\"reason\":\"bad frame\"}");
    }
  }
}
