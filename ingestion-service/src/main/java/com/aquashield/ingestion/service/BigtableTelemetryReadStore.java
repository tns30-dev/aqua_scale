package com.aquashield.ingestion.service;

import com.aquashield.ingestion.config.IngestionProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.gax.rpc.ServerStream;
import com.google.cloud.bigtable.data.v2.BigtableDataClient;
import com.google.cloud.bigtable.data.v2.models.Filters;
import com.google.cloud.bigtable.data.v2.models.Query;
import com.google.cloud.bigtable.data.v2.models.Row;
import com.google.cloud.bigtable.data.v2.models.TableId;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@ConditionalOnProperty(
    prefix = "aquashield.ingestion",
    name = "telemetry-store",
    havingValue = "bigtable")
public class BigtableTelemetryReadStore implements TelemetryReadStore {

  private final BigtableDataClient client;
  private final ObjectMapper mapper;
  private final String tableName;

  public BigtableTelemetryReadStore(IngestionProperties props, ObjectMapper mapper)
      throws IOException {
    IngestionProperties.Bigtable bigtable = props.bigtable();
    this.client = BigtableDataClient.create(
        required(bigtable.projectId(), "aquashield.ingestion.bigtable.project-id"),
        required(bigtable.instanceId(), "aquashield.ingestion.bigtable.instance-id"));
    this.tableName = required(bigtable.tableName(), "aquashield.ingestion.bigtable.table-name");
    this.mapper = mapper;
  }

  @PreDestroy
  public void close() {
    client.close();
  }

  @Override
  public List<Reading> findReadings(UUID pondId, UUID projectId, OffsetDateTime start,
                                    OffsetDateTime end, int limit) {
    String prefix = pondId != null
        ? BigtableTelemetryCodec.pondPrefix(pondId)
        : BigtableTelemetryCodec.projectPrefix(projectId);
    return readTimeRange(prefix, start, end).stream()
        .sorted(Comparator.comparing(Reading::measuredAt))
        .limit(limit + 1L)
        .toList();
  }

  @Override
  public List<EnergyHour> findProjectElectricityHourly(UUID projectId, OffsetDateTime start,
                                                       OffsetDateTime end, ZoneId zone) {
    Map<Instant, Double> totals = new LinkedHashMap<>();
    for (Reading reading : readTimeRange(BigtableTelemetryCodec.projectPrefix(projectId), start, end)) {
      JsonNode electricity = reading.values().get("electricity");
      if (electricity == null || !electricity.isNumber()) {
        continue;
      }
      Instant hour = reading.measuredAt().toInstant().truncatedTo(ChronoUnit.HOURS);
      totals.merge(hour, electricity.asDouble(), Double::sum);
    }
    return totals.entrySet().stream()
        .sorted(Map.Entry.comparingByKey())
        .map(entry -> new EnergyHour(entry.getKey(), entry.getValue()))
        .toList();
  }

  @Override
  public List<BucketAverage> findPondParameterBucketAverages(UUID pondId, OffsetDateTime start,
                                                             OffsetDateTime end, ZoneId zone,
                                                             String grouping,
                                                             Collection<String> parameters) {
    if (parameters.isEmpty()) {
      return List.of();
    }
    Set<String> requested = new HashSet<>(parameters);
    Map<String, Integer> order = parameterOrder(parameters);
    Map<BucketKey, BucketStats> buckets = new HashMap<>();
    for (Reading reading : readTimeRange(BigtableTelemetryCodec.pondPrefix(pondId), start, end)) {
      Instant bucketStart = bucketStart(reading.measuredAt(), zone, grouping);
      reading.values().properties().forEach(entry -> {
        if (!requested.contains(entry.getKey()) || !entry.getValue().isNumber()) {
          return;
        }
        buckets.computeIfAbsent(new BucketKey(entry.getKey(), bucketStart), ignored -> new BucketStats())
            .add(entry.getValue().asDouble());
      });
    }
    return buckets.entrySet().stream()
        .filter(entry -> entry.getValue().count > 0)
        .sorted(Comparator
            .comparingInt((Map.Entry<BucketKey, BucketStats> entry) ->
                order.getOrDefault(entry.getKey().parameter, Integer.MAX_VALUE))
            .thenComparing(entry -> entry.getKey().bucketStart)
            .thenComparing(entry -> entry.getKey().parameter))
        .map(entry -> new BucketAverage(
            pondId,
            entry.getKey().parameter,
            entry.getKey().bucketStart,
            entry.getValue().average(),
            entry.getValue().count))
        .toList();
  }

  @Override
  public List<Reading> findLatestByProject(UUID projectId, Collection<UUID> pondIds) {
    Set<UUID> filter = new HashSet<>(pondIds);
    List<Reading> rows = new ArrayList<>();
    ServerStream<Row> stream = client.readRows(
        Query.create(TableId.of(tableName))
            .prefix(BigtableTelemetryCodec.latestPrefix(projectId))
            .filter(Filters.FILTERS.limit().cellsPerColumn(1)));
    for (Row row : stream) {
      Reading reading = BigtableTelemetryCodec.toReading(row, mapper);
      if (reading != null && reading.pondId() != null
          && (filter.isEmpty() || filter.contains(reading.pondId()))) {
        rows.add(reading);
      }
    }
    rows.sort(Comparator.comparing(reading -> reading.pondId().toString()));
    return rows;
  }

  @Override
  public List<Window> findReadingWindows(Collection<UUID> pondIds) {
    List<Window> result = new ArrayList<>();
    for (UUID pondId : pondIds) {
      OffsetDateTime firstAt = null;
      OffsetDateTime lastAt = null;
      ServerStream<Row> stream = client.readRows(
          Query.create(TableId.of(tableName)).prefix(BigtableTelemetryCodec.pondPrefix(pondId)));
      for (Row row : stream) {
        Reading reading = BigtableTelemetryCodec.toReading(row, mapper);
        if (reading == null) {
          continue;
        }
        if (firstAt == null || reading.measuredAt().isBefore(firstAt)) {
          firstAt = reading.measuredAt();
        }
        if (lastAt == null || reading.measuredAt().isAfter(lastAt)) {
          lastAt = reading.measuredAt();
        }
      }
      if (firstAt != null) {
        result.add(new Window(pondId, firstAt.toInstant(), lastAt.toInstant()));
      }
    }
    return result;
  }

  private List<Reading> readTimeRange(String prefix, OffsetDateTime start, OffsetDateTime end) {
    String startKey = prefix + millisKey(start);
    String endKey = prefix + millisKey(end) + "~";
    List<Reading> rows = new ArrayList<>();
    ServerStream<Row> stream = client.readRows(
        Query.create(TableId.of(tableName)).range(startKey, endKey));
    for (Row row : stream) {
      Reading reading = BigtableTelemetryCodec.toReading(row, mapper);
      if (reading != null && !reading.measuredAt().isBefore(start)
          && !reading.measuredAt().isAfter(end)) {
        rows.add(reading);
      }
    }
    return rows;
  }

  private static Instant bucketStart(OffsetDateTime measuredAt, ZoneId zone, String grouping) {
    var zoned = measuredAt.toInstant().atZone(zone);
    return switch (grouping) {
      case "hourly" -> zoned.truncatedTo(ChronoUnit.HOURS).toInstant();
      case "weekly" -> zoned
          .with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
          .truncatedTo(ChronoUnit.DAYS)
          .toInstant();
      case "monthly" -> zoned
          .withDayOfMonth(1)
          .truncatedTo(ChronoUnit.DAYS)
          .toInstant();
      default -> zoned.truncatedTo(ChronoUnit.DAYS).toInstant();
    };
  }

  private static String millisKey(OffsetDateTime measuredAt) {
    return String.format("%013d", measuredAt.toInstant().toEpochMilli());
  }

  private static String required(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(name + " is required when Bigtable telemetry is enabled");
    }
    return value;
  }

  private static Map<String, Integer> parameterOrder(Collection<String> parameters) {
    Map<String, Integer> order = new HashMap<>();
    int index = 0;
    for (String parameter : parameters) {
      order.putIfAbsent(parameter, index++);
    }
    return order;
  }

  private record BucketKey(String parameter, Instant bucketStart) {}

  private static final class BucketStats {
    private double sum;
    private long count;

    private void add(double value) {
      sum += value;
      count++;
    }

    private double average() {
      return count == 0 ? 0.0 : sum / count;
    }
  }
}
