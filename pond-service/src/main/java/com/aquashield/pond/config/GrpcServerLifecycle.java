package com.aquashield.pond.config;

import io.grpc.BindableService;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Plain grpc-java server managed as a Spring SmartLifecycle — deliberately starter-free
 * (net.devh 3.1.0 is incompatible with Boot 3.4 / Security 6.4).
 *
 * Properties:
 *   grpc.server.port            TCP port; <= 0 disables the TCP server (tests)
 *   grpc.server.in-process-name when set, also serves an in-process server (tests)
 *
 * The TCP server is internal-only: in-cluster it is protected by NetworkPolicy and mesh
 * mTLS; it is never exposed through the public gateway.
 */
@Configuration
public class GrpcServerLifecycle {

  private static final Logger log = LoggerFactory.getLogger(GrpcServerLifecycle.class);

  @Bean
  SmartLifecycle grpcServer(List<BindableService> services,
                            @Value("${grpc.server.port:9091}") int port,
                            @Value("${grpc.server.in-process-name:}") String inProcessName) {
    return new SmartLifecycle() {

      private Server tcpServer;
      private Server inProcessServer;
      private volatile boolean running;

      @Override
      public void start() {
        try {
          if (port > 0) {
            ServerBuilder<?> builder = ServerBuilder.forPort(port);
            services.forEach(builder::addService);
            tcpServer = builder.build().start();
            log.info("gRPC server listening on port {} ({} services)", port, services.size());
          }
          if (!inProcessName.isBlank()) {
            InProcessServerBuilder builder = InProcessServerBuilder.forName(inProcessName);
            services.forEach(builder::addService);
            inProcessServer = builder.build().start();
            log.info("In-process gRPC server '{}' started", inProcessName);
          }
          running = true;
        } catch (IOException e) {
          throw new IllegalStateException("Cannot start gRPC server", e);
        }
      }

      @Override
      public void stop() {
        shutdown(tcpServer);
        shutdown(inProcessServer);
        running = false;
      }

      private void shutdown(Server server) {
        if (server == null) {
          return;
        }
        server.shutdown();
        try {
          if (!server.awaitTermination(5, TimeUnit.SECONDS)) {
            server.shutdownNow();
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          server.shutdownNow();
        }
      }

      @Override
      public boolean isRunning() {
        return running;
      }
    };
  }
}
