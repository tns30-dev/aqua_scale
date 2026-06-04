package com.aquashield.ingestion.grpc;

import com.aquashield.api.ingestion.v1.GetReadingWindowsRequest;
import com.aquashield.api.ingestion.v1.GetReadingWindowsResponse;
import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.GetReadingsResponse;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.ReadingRow;
import com.aquashield.api.ingestion.v1.ReadingWindow;
import com.aquashield.ingestion.domain.Entities.SensorReadingRow;
import com.aquashield.ingestion.repo.Repos.SensorReadingRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The telemetry READ seam (ingestion.proto): Analytics charts, Pond comparison and
 * Project energy all consume readings here instead of touching the store. Demo store =
 * Postgres; Bigtable swaps in behind the same repository seam. In-cluster only.
 */
@Service
public class IngestionReadGrpcService extends IngestionReadServiceGrpc.IngestionReadServiceImplBase {

  static final int MAX_LIMIT = 50_000;

  private final SensorReadingRepository readings;

  public IngestionReadGrpcService(SensorReadingRepository readings) {
    this.readings = readings;
  }

  @Override
  @Transactional(readOnly = true)
  public void getReadings(GetReadingsRequest request,
                          StreamObserver<GetReadingsResponse> observer) {
    UUID pondId;
    UUID projectId;
    OffsetDateTime start;
    OffsetDateTime end;
    try {
      // selector: pond_id wins when both set; at least one required
      pondId = request.getPondId().isEmpty() ? null : UUID.fromString(request.getPondId());
      projectId = request.getProjectId().isEmpty() ? null : UUID.fromString(request.getProjectId());
      if (pondId == null && projectId == null) {
        throw new IllegalArgumentException("selector required");
      }
      start = Instant.parse(request.getStart()).atOffset(ZoneOffset.UTC);
      end = Instant.parse(request.getEnd()).atOffset(ZoneOffset.UTC);
    } catch (Exception e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("pond_id or project_id must be a UUID; start/end must be ISO-8601 instants")
          .asRuntimeException());
      return;
    }
    int limit = request.getLimit() > 0 ? Math.min(request.getLimit(), MAX_LIMIT) : MAX_LIMIT;
    Set<String> filter = new HashSet<>(request.getParametersList());

    List<SensorReadingRow> rows = pondId != null
        ? readings.findByPondIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(pondId, start, end)
        : readings.findByProjectIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(projectId, start, end);

    GetReadingsResponse.Builder resp = GetReadingsResponse.newBuilder()
        .setPondId(pondId == null ? "" : pondId.toString())
        .setTruncated(rows.size() > limit);
    for (SensorReadingRow row : rows.subList(0, Math.min(rows.size(), limit))) {
      ReadingRow.Builder out = ReadingRow.newBuilder()
          .setMeasuredAt(row.getMeasuredAt().toInstant().toString())
          .setProjectSensorId(row.getProjectSensorId().toString())
          .setPort(row.getPort())
          .setPondId(row.getPondId().toString());
      row.getReadingValues().properties().forEach(e -> {
        if (e.getValue().isNumber() && (filter.isEmpty() || filter.contains(e.getKey()))) {
          out.putValues(e.getKey(), e.getValue().asDouble());
        }
      });
      if (!out.getValuesMap().isEmpty()) {
        resp.addRows(out);
      }
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  @Transactional(readOnly = true)
  public void getReadingWindows(GetReadingWindowsRequest request,
                                StreamObserver<GetReadingWindowsResponse> observer) {
    List<UUID> pondIds = new java.util.ArrayList<>();
    try {
      for (String id : request.getPondIdsList()) {
        pondIds.add(UUID.fromString(id));
      }
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("pond_ids must be UUIDs").asRuntimeException());
      return;
    }
    GetReadingWindowsResponse.Builder resp = GetReadingWindowsResponse.newBuilder();
    if (!pondIds.isEmpty()) {
      for (Object[] window : readings.findReadingWindows(pondIds)) {
        resp.addWindows(ReadingWindow.newBuilder()
            .setPondId(window[0].toString())
            .setFirstAt(((OffsetDateTime) window[1]).toInstant().toString())
            .setLastAt(((OffsetDateTime) window[2]).toInstant().toString()));
      }
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }
}
