package com.aquashield.project.config;

import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.notification.v1.NotificationServiceGrpc;
import com.aquashield.api.pond.v1.PondServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.inprocess.InProcessChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * gRPC clients: Ingestion (energy dashboard readings), Pond (summary pond count),
 * Notification (summary active-alert count). In-cluster: mesh mTLS; in-process for tests.
 */
@Configuration
public class GrpcClientsConfig {

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel ingestionChannel(
      @Value("${aquashield.grpc.ingestion.target}") String target,
      @Value("${aquashield.grpc.ingestion.in-process-name:}") String inProcessName) {
    return channel(target, inProcessName);
  }

  @Bean
  IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub(
      ManagedChannel ingestionChannel) {
    return IngestionReadServiceGrpc.newBlockingStub(ingestionChannel);
  }

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel pondChannel(
      @Value("${aquashield.grpc.pond.target}") String target,
      @Value("${aquashield.grpc.pond.in-process-name:}") String inProcessName) {
    return channel(target, inProcessName);
  }

  @Bean
  PondServiceGrpc.PondServiceBlockingStub pondStub(ManagedChannel pondChannel) {
    return PondServiceGrpc.newBlockingStub(pondChannel);
  }

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel notificationChannel(
      @Value("${aquashield.grpc.notification.target}") String target,
      @Value("${aquashield.grpc.notification.in-process-name:}") String inProcessName) {
    return channel(target, inProcessName);
  }

  @Bean
  NotificationServiceGrpc.NotificationServiceBlockingStub notificationStub(
      ManagedChannel notificationChannel) {
    return NotificationServiceGrpc.newBlockingStub(notificationChannel);
  }

  private static ManagedChannel channel(String target, String inProcessName) {
    if (inProcessName != null && !inProcessName.isBlank()) {
      return InProcessChannelBuilder.forName(inProcessName).usePlaintext().build();
    }
    return ManagedChannelBuilder.forTarget(target).usePlaintext().build();
  }
}
