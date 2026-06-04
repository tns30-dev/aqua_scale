package com.aquashield.realtime.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Pod-local connection registry (spec: socket objects stay local to each pod; Redis only
 * carries routing metadata + the fanout channel). Delivery is project-scoped: a frame for
 * project P goes to every local connection whose authorized projectIds contain P.
 */
@Service
public class ConnectionRegistry {

  public record Connection(UUID userId, Set<UUID> projectIds, Sinks.Many<String> outbound) {}

  private static final Logger log = LoggerFactory.getLogger(ConnectionRegistry.class);

  private final Map<String, Connection> connections = new ConcurrentHashMap<>();

  public void register(String connectionId, Connection connection) {
    connections.put(connectionId, connection);
  }

  public void remove(String connectionId) {
    connections.remove(connectionId);
  }

  public Connection get(String connectionId) {
    return connections.get(connectionId);
  }

  public int size() {
    return connections.size();
  }

  /** Push a frame to every local connection authorized for the project. */
  public int deliverToProject(UUID projectId, String frame) {
    int delivered = 0;
    for (Connection c : connections.values()) {
      if (c.projectIds().contains(projectId)) {
        Sinks.EmitResult result = c.outbound().tryEmitNext(frame);
        if (result.isSuccess()) {
          delivered++;
        } else {
          log.debug("Emit failed ({}) — slow/closed consumer", result);
        }
      }
    }
    return delivered;
  }
}
