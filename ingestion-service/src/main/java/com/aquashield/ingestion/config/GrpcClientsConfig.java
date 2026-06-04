package com.aquashield.ingestion.config;

import com.aquashield.api.project.v1.ProjectServiceGrpc;
import com.aquashield.api.sensor.v1.SensorServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.inprocess.InProcessChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * gRPC clients to Sensor (device/port resolution, HMAC metadata) and Project
 * (parameter catalogue). In-cluster these channels ride mesh mTLS; plaintext here is
 * the in-cluster/in-process configuration. In-process names are for tests.
 */
@Configuration
public class GrpcClientsConfig {

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel sensorChannel(
      @Value("${aquashield.grpc.sensor.target}") String target,
      @Value("${aquashield.grpc.sensor.in-process-name:}") String inProcessName) {
    return channel(target, inProcessName);
  }

  @Bean(destroyMethod = "shutdownNow")
  ManagedChannel projectChannel(
      @Value("${aquashield.grpc.project.target}") String target,
      @Value("${aquashield.grpc.project.in-process-name:}") String inProcessName) {
    return channel(target, inProcessName);
  }

  @Bean
  SensorServiceGrpc.SensorServiceBlockingStub sensorStub(ManagedChannel sensorChannel) {
    return SensorServiceGrpc.newBlockingStub(sensorChannel);
  }

  @Bean
  ProjectServiceGrpc.ProjectServiceBlockingStub projectStub(ManagedChannel projectChannel) {
    return ProjectServiceGrpc.newBlockingStub(projectChannel);
  }

  private static ManagedChannel channel(String target, String inProcessName) {
    if (inProcessName != null && !inProcessName.isBlank()) {
      return InProcessChannelBuilder.forName(inProcessName).usePlaintext().build();
    }
    return ManagedChannelBuilder.forTarget(target).usePlaintext().build();
  }
}
