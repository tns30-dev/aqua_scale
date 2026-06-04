package com.aquashield.notification.config;

import com.aquashield.api.project.v1.ProjectServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.inprocess.InProcessChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Project gRPC client (threshold source). In-cluster: mesh mTLS; in-process for tests. */
@Configuration
public class GrpcClientsConfig {

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel projectChannel(
      @Value("${aquashield.grpc.project.target}") String target,
      @Value("${aquashield.grpc.project.in-process-name:}") String inProcessName) {
    if (inProcessName != null && !inProcessName.isBlank()) {
      return InProcessChannelBuilder.forName(inProcessName).usePlaintext().build();
    }
    return ManagedChannelBuilder.forTarget(target).usePlaintext().build();
  }

  @Bean
  ProjectServiceGrpc.ProjectServiceBlockingStub projectStub(ManagedChannel projectChannel) {
    return ProjectServiceGrpc.newBlockingStub(projectChannel);
  }
}
