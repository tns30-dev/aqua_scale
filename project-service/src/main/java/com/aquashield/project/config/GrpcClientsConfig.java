package com.aquashield.project.config;

import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.inprocess.InProcessChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ingestion gRPC client — the readings seam feeding the energy dashboard (project-wide
 * electricity rows). In-cluster: mesh mTLS; in-process for tests.
 */
@Configuration
public class GrpcClientsConfig {

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel ingestionChannel(
      @Value("${aquashield.grpc.ingestion.target}") String target,
      @Value("${aquashield.grpc.ingestion.in-process-name:}") String inProcessName) {
    if (inProcessName != null && !inProcessName.isBlank()) {
      return InProcessChannelBuilder.forName(inProcessName).usePlaintext().build();
    }
    return ManagedChannelBuilder.forTarget(target).usePlaintext().build();
  }

  @Bean
  IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestionStub(
      ManagedChannel ingestionChannel) {
    return IngestionReadServiceGrpc.newBlockingStub(ingestionChannel);
  }
}
