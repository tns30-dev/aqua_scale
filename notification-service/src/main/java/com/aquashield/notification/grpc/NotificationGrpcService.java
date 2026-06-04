package com.aquashield.notification.grpc;

import com.aquashield.api.notification.v1.GetActiveAlertCountRequest;
import com.aquashield.api.notification.v1.GetActiveAlertCountResponse;
import com.aquashield.api.notification.v1.NotificationServiceGrpc;
import com.aquashield.notification.repo.AlertLogRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Internal gRPC API — first consumer: Project Service's overview summary.
 * PARITY: "active" = acknowledged=false AND resolved=false (module_project views.py
 * summary filter on AlertLog). In-cluster only (NetworkPolicy + mesh mTLS).
 */
@Service
public class NotificationGrpcService extends NotificationServiceGrpc.NotificationServiceImplBase {

  private final AlertLogRepository alerts;

  public NotificationGrpcService(AlertLogRepository alerts) {
    this.alerts = alerts;
  }

  @Override
  @Transactional(readOnly = true)
  public void getActiveAlertCount(GetActiveAlertCountRequest request,
                                  StreamObserver<GetActiveAlertCountResponse> observer) {
    UUID projectId;
    try {
      projectId = UUID.fromString(request.getProjectId());
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("project_id must be a UUID").asRuntimeException());
      return;
    }
    observer.onNext(GetActiveAlertCountResponse.newBuilder()
        .setCount(alerts.countByProjectIdAndAcknowledgedFalseAndResolvedFalse(projectId))
        .build());
    observer.onCompleted();
  }
}
