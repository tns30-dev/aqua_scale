package com.aquashield.notification.grpc;

import com.aquashield.api.notification.v1.GetActiveAlertCountRequest;
import com.aquashield.api.notification.v1.GetActiveAlertCountResponse;
import com.aquashield.api.notification.v1.GetPondAlertCountsRequest;
import com.aquashield.api.notification.v1.GetPondAlertCountsResponse;
import com.aquashield.api.notification.v1.NotificationServiceGrpc;
import com.aquashield.api.notification.v1.PondAlertCount;
import com.aquashield.notification.repo.AlertLogRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
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

  @Override
  @Transactional(readOnly = true)
  public void getPondAlertCounts(GetPondAlertCountsRequest request,
                                 StreamObserver<GetPondAlertCountsResponse> observer) {
    UUID projectId;
    try {
      projectId = UUID.fromString(request.getProjectId());
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("project_id must be a UUID").asRuntimeException());
      return;
    }

    Map<UUID, PondAlertCount.Builder> counts = new LinkedHashMap<>();
    for (String pondIdText : request.getPondIdsList()) {
      try {
        UUID pondId = UUID.fromString(pondIdText);
        counts.putIfAbsent(pondId, PondAlertCount.newBuilder().setPondId(pondId.toString()));
      } catch (IllegalArgumentException e) {
        observer.onError(Status.INVALID_ARGUMENT
            .withDescription("pond_ids must contain only UUID values").asRuntimeException());
        return;
      }
    }

    if (counts.isEmpty()) {
      observer.onNext(GetPondAlertCountsResponse.newBuilder().build());
      observer.onCompleted();
      return;
    }

    OffsetDateTime start;
    OffsetDateTime end;
    try {
      start = OffsetDateTime.parse(request.getStartAt());
      end = OffsetDateTime.parse(request.getEndAt());
    } catch (Exception e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("start_at and end_at must be ISO-8601 offset timestamps")
          .asRuntimeException());
      return;
    }
    if (!end.isAfter(start)) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("end_at must be after start_at").asRuntimeException());
      return;
    }

    for (var row : alerts.countByPondAndLogType(projectId, counts.keySet(), start, end)) {
      PondAlertCount.Builder builder = counts.get(row.getPondId());
      if (builder == null) {
        continue;
      }
      String logType = row.getLogType();
      if ("alert".equals(logType)) {
        builder.setAlertCount(row.getCount());
      } else if ("warning".equals(logType)) {
        builder.setWarningCount(row.getCount());
      }
    }

    GetPondAlertCountsResponse.Builder response = GetPondAlertCountsResponse.newBuilder();
    counts.values().forEach(response::addCounts);
    observer.onNext(response.build());
    observer.onCompleted();
  }
}
