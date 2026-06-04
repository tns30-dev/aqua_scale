package com.aquashield.realtime.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Cross-pod fanout (spec: redis.md ws:fanout:{projectId}). The Pub/Sub subscription is
 * load-balanced across pods — whichever pod receives a domain event REPUBLISHES it to
 * Redis pub/sub; EVERY pod (including the publisher) then delivers to its local sockets.
 */
@Service
public class RedisFanout {

  private static final Logger log = LoggerFactory.getLogger(RedisFanout.class);
  private static final String CHANNEL_PREFIX = "ws:fanout:";

  private final StringRedisTemplate redis;
  private final ConnectionRegistry registry;

  public RedisFanout(StringRedisTemplate redis, ConnectionRegistry registry) {
    this.redis = redis;
    this.registry = registry;
  }

  /** Publish a frame for a project to ALL pods (this one included). */
  public void publish(UUID projectId, String frame) {
    redis.convertAndSend(CHANNEL_PREFIX + projectId, frame);
  }

  void onMessage(String channel, String frame) {
    try {
      UUID projectId = UUID.fromString(channel.substring(CHANNEL_PREFIX.length()));
      int delivered = registry.deliverToProject(projectId, frame);
      log.debug("Fanout project={} delivered={}", projectId, delivered);
    } catch (Exception e) {
      log.warn("Fanout message dropped: {}", e.toString());
    }
  }

  @Configuration
  static class ListenerConfig {

    @Bean
    RedisMessageListenerContainer wsFanoutListener(RedisConnectionFactory factory,
                                                   RedisFanout fanout) {
      RedisMessageListenerContainer container = new RedisMessageListenerContainer();
      container.setConnectionFactory(factory);
      container.addMessageListener((message, pattern) -> fanout.onMessage(
              new String(message.getChannel(), StandardCharsets.UTF_8),
              new String(message.getBody(), StandardCharsets.UTF_8)),
          new PatternTopic(CHANNEL_PREFIX + "*"));
      return container;
    }
  }
}
