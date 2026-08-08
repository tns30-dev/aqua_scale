package com.aquashield.notification.config;

import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.inprocess.InProcessChannelBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Project gRPC client (threshold source). In-cluster: mesh mTLS; in-process for tests. */
@Configuration
public class GrpcClientsConfig {

  @Bean(destroyMethod = "shutdownNow")
  @Qualifier("projectChannel")
  ManagedChannel projectChannel(
      @Value("${aquashield.grpc.project.target}") String target,
      @Value("${aquashield.grpc.project.in-process-name:}") String inProcessName) {
    if (inProcessName != null && !inProcessName.isBlank()) {
      return InProcessChannelBuilder.forName(inProcessName).usePlaintext().build();
    }
    return ManagedChannelBuilder.forTarget(target).usePlaintext().build();
  }

  @Bean
  ProjectServiceGrpc.ProjectServiceBlockingStub projectStub(
      @Qualifier("projectChannel") ManagedChannel projectChannel) {
    return ProjectServiceGrpc.newBlockingStub(projectChannel);
  }

  @Bean(destroyMethod = "shutdownNow")
  @Qualifier("ingestionChannel")
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
      @Qualifier("ingestionChannel") ManagedChannel ingestionChannel) {
    return IngestionReadServiceGrpc.newBlockingStub(ingestionChannel);
  }
}
