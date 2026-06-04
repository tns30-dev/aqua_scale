package com.aquashield.project.service;

import com.aquashield.api.notification.v1.GetActiveAlertCountRequest;
import com.aquashield.api.notification.v1.NotificationServiceGrpc;
import com.aquashield.api.pond.v1.GetPondsByProjectRequest;
import com.aquashield.api.pond.v1.PondServiceGrpc;
import com.aquashield.project.api.dto.ProjectDtos.ProjectSummaryDto;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SummaryService {

  private static final Logger log = LoggerFactory.getLogger(SummaryService.class);

  private final PondServiceGrpc.PondServiceBlockingStub pondStub;
  private final NotificationServiceGrpc.NotificationServiceBlockingStub notificationStub;

  public SummaryService(PondServiceGrpc.PondServiceBlockingStub pondStub,
                        NotificationServiceGrpc.NotificationServiceBlockingStub notificationStub) {
    this.pondStub = pondStub;
    this.notificationStub = notificationStub;
  }

  public ProjectSummaryDto getSummary(UUID projectId) {
    int totalPonds = countPonds(projectId);
    long activeAlerts = countAlerts(projectId);
    int quality = deriveQuality(activeAlerts, totalPonds);
    String forecast = deriveForecast(quality);
    return new ProjectSummaryDto(totalPonds, activeAlerts, quality, forecast);
  }

  private int countPonds(UUID projectId) {
    try {
      return pondStub.getPondsByProject(
          GetPondsByProjectRequest.newBuilder()
              .setProjectId(projectId.toString())
              .build()
      ).getPondsCount();
    } catch (StatusRuntimeException e) {
      log.warn("pond gRPC unavailable for summary (project={}): {}", projectId, e.getStatus());
      return 0;
    }
  }

  private long countAlerts(UUID projectId) {
    try {
      return notificationStub.getActiveAlertCount(
          GetActiveAlertCountRequest.newBuilder()
              .setProjectId(projectId.toString())
              .build()
      ).getCount();
    } catch (StatusRuntimeException e) {
      log.warn("notification gRPC unavailable for summary (project={}): {}", projectId, e.getStatus());
      return 0;
    }
  }

  // Simple quality score: starts at 100, each alert costs 10 points, floor 30.
  private static int deriveQuality(long alerts, int ponds) {
    if (ponds == 0) return 0;
    int penalty = (int) Math.min(alerts * 10L, 70);
    return Math.max(100 - penalty, 30);
  }

  private static String deriveForecast(int quality) {
    if (quality >= 80) return "good";
    if (quality >= 60) return "fair";
    return "poor";
  }
}
