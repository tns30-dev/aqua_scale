package com.aquashield.realtime;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * AquaShield Realtime Gateway — the WSS push layer (spec: main/websocket.md).
 *
 * Flow: authenticated REST /ws/token mints a short-lived ONE-TIME token -> client opens
 * /ws -> first-frame AUTH (replay-protected via Redis jti) -> subscription registered ->
 * project-scoped events (reading.ingested, alert.created/resolved) pushed.
 *
 * Stateless: no database. Socket objects stay pod-local; Redis carries routing metadata
 * and the cross-pod fanout channel (ws:fanout:{projectId}).
 */
@SpringBootApplication
public class RealtimeGatewayApplication {

  public static void main(String[] args) {
    SpringApplication.run(RealtimeGatewayApplication.class, args);
  }
}
