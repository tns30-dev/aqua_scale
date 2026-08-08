package com.aquashield.ingestion.service;

import com.aquashield.ingestion.domain.Entities.SensorReadingRow;
import com.aquashield.ingestion.repo.Repos.SensorReadingRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@ConditionalOnProperty(
    prefix = "aquashield.ingestion",
    name = "telemetry-store",
    havingValue = "postgres",
    matchIfMissing = true)
public class PostgresTelemetryReadStore implements TelemetryReadStore {

  private final SensorReadingRepository readings;

  public PostgresTelemetryReadStore(SensorReadingRepository readings) {
    this.readings = readings;
  }

  @Override
  @Transactional(readOnly = true)
  public List<Reading> findReadings(UUID pondId, UUID projectId, OffsetDateTime start,
                                    OffsetDateTime end, int limit) {
    List<SensorReadingRow> rows = pondId != null
        ? readings.findByPondIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(pondId, start, end)
        : readings.findByProjectIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(projectId, start, end);
    return rows.stream().limit(limit + 1L).map(this::toReading).toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<EnergyHour> findProjectElectricityHourly(UUID projectId, OffsetDateTime start,
                                                       OffsetDateTime end, ZoneId zone) {
    return readings.findProjectElectricityHourly(projectId, start, end).stream()
        .map(row -> new EnergyHour(row.getHourStart(), row.getKwh() == null ? 0.0 : row.getKwh()))
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<BucketAverage> findPondParameterBucketAverages(UUID pondId, OffsetDateTime start,
                                                             OffsetDateTime end, ZoneId zone,
                                                             String grouping,
                                                             Collection<String> parameters) {
    if (parameters.isEmpty()) {
      return List.of();
    }
    List<BucketAverage> result = new ArrayList<>();
    for (var row : readings.findPondParameterBucketAverages(
        pondId, start, end, zone.getId(), grouping, parameters)) {
      result.add(new BucketAverage(
          row.getPondId(),
          row.getParameter(),
          row.getBucketStart(),
          row.getAvgValue() == null ? 0.0 : row.getAvgValue(),
          row.getSampleCount() == null ? 0L : row.getSampleCount()));
    }
    Map<String, Integer> order = parameterOrder(parameters);
    return result.stream()
        .sorted(Comparator
            .comparingInt((BucketAverage row) -> order.getOrDefault(row.parameter(), Integer.MAX_VALUE))
            .thenComparing(BucketAverage::bucketStart)
            .thenComparing(BucketAverage::parameter))
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<Reading> findLatestByProject(UUID projectId, Collection<UUID> pondIds) {
    if (pondIds.isEmpty()) {
      return readings.findLatestByProject(projectId).stream().map(this::toReading).toList();
    }
    return pondIds.stream()
        .map(pondId -> readings.findFirstByProjectIdAndPondIdOrderByMeasuredAtDesc(
            projectId, pondId))
        .flatMap(java.util.Optional::stream)
        .map(this::toReading)
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<Window> findReadingWindows(Collection<UUID> pondIds) {
    if (pondIds.isEmpty()) {
      return List.of();
    }
    return readings.findReadingWindows(pondIds).stream()
        .map(row -> new Window(
            (UUID) row[0],
            ((OffsetDateTime) row[1]).toInstant(),
            ((OffsetDateTime) row[2]).toInstant()))
        .toList();
  }

  private Reading toReading(SensorReadingRow row) {
    return new Reading(row.getProjectId(), row.getPondId(), row.getProjectSensorId(),
        row.getPort(), row.getMeasuredAt(), row.getReadingValues());
  }

  private static Map<String, Integer> parameterOrder(Collection<String> parameters) {
    Map<String, Integer> order = new HashMap<>();
    int index = 0;
    for (String parameter : parameters) {
      order.putIfAbsent(parameter, index++);
    }
    return order;
  }
}
