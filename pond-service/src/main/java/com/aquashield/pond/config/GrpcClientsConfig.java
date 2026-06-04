package com.aquashield.pond.config;

import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.inprocess.InProcessChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * gRPC clients: Project (profile/threshold context) + Ingestion (the readings seam
 * feeding pond comparison). In-cluster: mesh mTLS; in-process for tests.
 */
@Configuration
public class GrpcClientsConfig {

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel projectChannel(
      @Value("${aquashield.grpc.project.target}") String target,
      @Value("${aquashield.grpc.project.in-process-name:}") String inProcessName) {
    return channel(target, inProcessName);
  }

  @Bean
  ProjectServiceGrpc.ProjectServiceBlockingStub projectStub(ManagedChannel projectChannel) {
    return ProjectServiceGrpc.newBlockingStub(projectChannel);
  }

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

  private static ManagedChannel channel(String target, String inProcessName) {
    if (inProcessName != null && !inProcessName.isBlank()) {
      return InProcessChannelBuilder.forName(inProcessName).usePlaintext().build();
    }
    return ManagedChannelBuilder.forTarget(target).usePlaintext().build();
  }
}
