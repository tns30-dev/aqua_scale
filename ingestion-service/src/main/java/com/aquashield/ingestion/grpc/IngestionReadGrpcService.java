package com.aquashield.ingestion.grpc;

import com.aquashield.api.ingestion.v1.EnergyHourlyReading;
import com.aquashield.api.ingestion.v1.GetEnergyHourlyReadingsRequest;
import com.aquashield.api.ingestion.v1.GetEnergyHourlyReadingsResponse;
import com.aquashield.api.ingestion.v1.GetLatestReadingsRequest;
import com.aquashield.api.ingestion.v1.GetLatestReadingsResponse;
import com.aquashield.api.ingestion.v1.GetPondParameterBucketAveragesRequest;
import com.aquashield.api.ingestion.v1.GetPondParameterBucketAveragesResponse;
import com.aquashield.api.ingestion.v1.GetReadingWindowsRequest;
import com.aquashield.api.ingestion.v1.GetReadingWindowsResponse;
import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.GetReadingsResponse;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.LatestReadingRow;
import com.aquashield.api.ingestion.v1.PondParameterBucketAverage;
import com.aquashield.api.ingestion.v1.ReadingRow;
import com.aquashield.api.ingestion.v1.ReadingWindow;
import com.aquashield.ingestion.service.TelemetryReadStore;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
  private static final Set<String> BUCKET_GROUPINGS =
      Set.of("hourly", "daily", "weekly", "monthly");

  private final TelemetryReadStore readings;

  public IngestionReadGrpcService(TelemetryReadStore readings) {
    this.readings = readings;
  }

  @Override
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

    List<TelemetryReadStore.Reading> rows =
        readings.findReadings(pondId, projectId, start, end, limit);

    GetReadingsResponse.Builder resp = GetReadingsResponse.newBuilder()
        .setPondId(pondId == null ? "" : pondId.toString())
        .setTruncated(rows.size() > limit);
    for (TelemetryReadStore.Reading row : rows.subList(0, Math.min(rows.size(), limit))) {
      ReadingRow.Builder out = ReadingRow.newBuilder()
          .setMeasuredAt(row.measuredAt().toInstant().toString())
          .setProjectSensorId(row.projectSensorId().toString())
          .setPort(row.port());
      if (row.pondId() != null) {
        out.setPondId(row.pondId().toString());
      }
      row.values().properties().forEach(e -> {
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
  public void getEnergyHourlyReadings(GetEnergyHourlyReadingsRequest request,
                                      StreamObserver<GetEnergyHourlyReadingsResponse> observer) {
    UUID projectId;
    OffsetDateTime start;
    OffsetDateTime end;
    ZoneId zone;
    try {
      projectId = UUID.fromString(request.getProjectId());
      start = Instant.parse(request.getStart()).atOffset(ZoneOffset.UTC);
      end = Instant.parse(request.getEnd()).atOffset(ZoneOffset.UTC);
      zone = request.getTimezone().isBlank()
          ? ZoneId.of("Asia/Singapore")
          : ZoneId.of(request.getTimezone());
    } catch (Exception e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("project_id must be a UUID; start/end must be ISO-8601 instants; timezone must be an IANA zone")
          .asRuntimeException());
      return;
    }

    GetEnergyHourlyReadingsResponse.Builder resp = GetEnergyHourlyReadingsResponse.newBuilder()
        .setProjectId(projectId.toString());
    for (var row : readings.findProjectElectricityHourly(projectId, start, end, zone)) {
      resp.addRows(EnergyHourlyReading.newBuilder()
          .setHourStart(row.hourStart().toString())
          .setKwh(row.kwh()));
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
  public void getPondParameterBucketAverages(GetPondParameterBucketAveragesRequest request,
                                             StreamObserver<GetPondParameterBucketAveragesResponse> observer) {
    UUID pondId;
    OffsetDateTime start;
    OffsetDateTime end;
    ZoneId zone;
    String grouping;
    try {
      pondId = UUID.fromString(request.getPondId());
      start = Instant.parse(request.getStart()).atOffset(ZoneOffset.UTC);
      end = Instant.parse(request.getEnd()).atOffset(ZoneOffset.UTC);
      zone = request.getTimezone().isBlank()
          ? ZoneId.of("Asia/Singapore")
          : ZoneId.of(request.getTimezone());
      grouping = request.getGrouping().isBlank() ? "daily" : request.getGrouping();
      if (!BUCKET_GROUPINGS.contains(grouping)) {
        throw new IllegalArgumentException("invalid grouping");
      }
    } catch (Exception e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("pond_id must be a UUID; start/end must be ISO-8601 instants; timezone must be an IANA zone; grouping must be hourly, daily, weekly, or monthly")
          .asRuntimeException());
      return;
    }

    GetPondParameterBucketAveragesResponse.Builder resp =
        GetPondParameterBucketAveragesResponse.newBuilder().setPondId(pondId.toString());
    List<String> parameters = request.getParametersList().stream().distinct().toList();
    for (var row : readings.findPondParameterBucketAverages(
        pondId, start, end, zone, grouping, parameters)) {
      addBucketAverage(resp, row.pondId(), row.bucketStart(), row.parameter(),
          row.average(), row.sampleCount());
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  private static void addBucketAverage(GetPondParameterBucketAveragesResponse.Builder resp,
                                       UUID pondId,
                                       Instant bucketStart,
                                       String parameter,
                                       Double average,
                                       Long sampleCount) {
    long count = sampleCount == null ? 0L : sampleCount;
    if (count == 0) {
      return;
    }
    resp.addRows(PondParameterBucketAverage.newBuilder()
        .setPondId(pondId.toString())
        .setParameter(parameter)
        .setBucketStart(bucketStart.toString())
        .setAverage(average == null ? 0.0 : average)
        .setSampleCount(count));
  }

  @Override
  public void getLatestReadings(GetLatestReadingsRequest request,
                                StreamObserver<GetLatestReadingsResponse> observer) {
    UUID projectId;
    List<UUID> pondIds = new java.util.ArrayList<>();
    try {
      if (request.getProjectId().isBlank()) {
        throw new IllegalArgumentException("project_id is required");
      }
      projectId = UUID.fromString(request.getProjectId());
      for (String id : request.getPondIdsList()) {
        if (!id.isBlank()) {
          pondIds.add(UUID.fromString(id));
        }
      }
    } catch (IllegalArgumentException e) {
      observer.onError(Status.INVALID_ARGUMENT
          .withDescription("project_id and pond_ids must be UUIDs")
          .asRuntimeException());
      return;
    }

    List<TelemetryReadStore.Reading> rows = readings.findLatestByProject(projectId, pondIds);

    Map<UUID, LatestReadingRow.Builder> byPond = new LinkedHashMap<>();
    for (TelemetryReadStore.Reading row : rows) {
      if (row.pondId() == null) {
        continue;
      }
      LatestReadingRow.Builder out = byPond.computeIfAbsent(row.pondId(), pondId ->
          LatestReadingRow.newBuilder()
              .setPondId(pondId.toString())
              .setMeasuredAt(row.measuredAt().toInstant().toString())
              .setProjectSensorId(row.projectSensorId().toString())
              .setPort(row.port())
      );
      row.values().properties().forEach(e -> {
        if (e.getValue().isNumber()) {
          out.putValues(e.getKey(), e.getValue().asDouble());
        }
      });
    }

    GetLatestReadingsResponse.Builder resp = GetLatestReadingsResponse.newBuilder();
    byPond.values().stream()
        .filter(row -> !row.getValuesMap().isEmpty())
        .forEach(resp::addReadings);
    observer.onNext(resp.build());
    observer.onCompleted();
  }

  @Override
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
      for (TelemetryReadStore.Window window : readings.findReadingWindows(pondIds)) {
        resp.addWindows(ReadingWindow.newBuilder()
            .setPondId(window.pondId().toString())
            .setFirstAt(window.firstAt().toString())
            .setLastAt(window.lastAt().toString()));
      }
    }
    observer.onNext(resp.build());
    observer.onCompleted();
  }
}
