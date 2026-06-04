package com.aquashield.pond.service;

import com.aquashield.api.ingestion.v1.GetReadingWindowsRequest;
import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.ReadingRow;
import com.aquashield.common.util.PyRound;
import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.repo.Repos.PondRepository;
import com.aquashield.pond.repo.Repos.PondTreatmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * PARITY port of PondComparisonService — now fed by REAL readings through the Ingestion
 * GetReadings seam (the former [XSVC] zero-stub is gone).
 *
 * The FROZEN contract: exactly 4 parameters in fixed order; camelCase payloads; grouping
 * auto-resolution by inclusive span (<=1 hourly, <=31 daily, <=90 weekly, else monthly);
 * shared X-axis grid with EVERY bucket present (zero-filled); pct diff = 0 when the
 * denominator is 0; card averages over the WHOLE range (not bucketed).
 *
 * TIMEZONE (config/settings/base.py TIME_ZONE='Asia/Singapore'): query bounds are local
 * midnight/23:59:59.999999 and ALL bucketing/labels use local time. Rounding is CPython
 * round() (half-to-even on the binary double) — see PyRound.
 *
 * FAIL-SOFT (get_readings parity): any readings-fetch error -> empty list -> zero-filled
 * output, never a 5xx.
 */
@Service
public class ComparisonService {

  private static final Logger log = LoggerFactory.getLogger(ComparisonService.class);

  public record ParameterDef(String code, String label, String unit, boolean lowerIsBetter) {}

  /** PARITY: frozen catalogue, fixed order. */
  public static final List<ParameterDef> PARAMETERS = List.of(
      new ParameterDef("ammonium", "Ammonium", "mg/L", true),
      new ParameterDef("dissolved_oxygen", "Dissolved Oxygen (DO)", "mg/L", false),
      new ParameterDef("turbidity", "Turbidity", "NTU", true),
      new ParameterDef("electricity", "Electricity", "kWh", true));

  public static final Set<String> VALID_GROUPINGS =
      Set.of("auto", "hourly", "daily", "weekly", "monthly");

  private final PondRepository ponds;
  private final PondTreatmentRepository treatments;
  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion;
  private final ZoneId zone;

  public ComparisonService(PondRepository ponds, PondTreatmentRepository treatments,
                           IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion,
                           @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.ponds = ponds;
    this.treatments = treatments;
    this.ingestion = ingestion;
    this.zone = ZoneId.of(timezone);
  }

  /** PARITY (_resolve_grouping): inclusive span days. */
  static String resolveGrouping(String requested, LocalDate start, LocalDate end) {
    if (!"auto".equals(requested)) {
      return requested;
    }
    long span = end.toEpochDay() - start.toEpochDay() + 1;
    if (span <= 1) {
      return "hourly";
    }
    if (span <= 31) {
      return "daily";
    }
    if (span <= 90) {
      return "weekly";
    }
    return "monthly";
  }

  /** PARITY (_pct_diff): round((a-b)/b*100) banker's int; 0 when b == 0. */
  static long pctDiff(double a, double b) {
    if (b == 0) {
      return 0;
    }
    return PyRound.round((a - b) / b * 100);
  }

  /** PARITY (_safe_avg): 0.0 for empty/all-null; CPython round 2dp. */
  static double safeAvg(List<Double> values) {
    List<Double> usable = values.stream().filter(v -> v != null).toList();
    if (usable.isEmpty()) {
      return 0.0;
    }
    double avg = usable.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    return PyRound.round(avg, 2);
  }

  // ---------- grid + bucketing (all in local time — Asia/Singapore) ----------

  private static final DateTimeFormatter DAY_FMT =
      DateTimeFormatter.ofPattern("MMM dd", Locale.ENGLISH);

  /**
   * PARITY (_bucket_by_period): the shared X-axis grid — every bucket present, keyed by
   * the bucket-start local datetime. Hourly enumerates EVERY hour from start 00:00 to
   * end 23:59 (multi-day spans included — monolith cursor runs to end_date time.max).
   */
  static LinkedHashMap<LocalDateTime, String> bucketGrid(LocalDate start, LocalDate end,
                                                         String grouping) {
    LinkedHashMap<LocalDateTime, String> grid = new LinkedHashMap<>();
    switch (grouping) {
      case "hourly" -> {
        LocalDateTime cursor = start.atStartOfDay();
        LocalDateTime max = end.atTime(LocalTime.MAX);
        while (!cursor.isAfter(max)) {
          grid.put(cursor, cursor.format(DAY_FMT) + String.format(" %02d:00", cursor.getHour()));
          cursor = cursor.plusHours(1);
        }
      }
      case "daily" -> {
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
          grid.put(d.atStartOfDay(), d.format(DAY_FMT));
        }
      }
      case "weekly" -> {
        LocalDate anchor = start.minusDays(start.getDayOfWeek().getValue() - 1L); // Monday
        for (LocalDate d = anchor; !d.isAfter(end); d = d.plusWeeks(1)) {
          grid.put(d.atStartOfDay(), d.format(DAY_FMT));
        }
      }
      case "monthly" -> {
        LocalDate anchor = start.withDayOfMonth(1);
        for (LocalDate d = anchor; !d.isAfter(end); d = d.plusMonths(1)) {
          grid.put(d.atStartOfDay(), d.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
              + " " + d.getYear());
        }
      }
      default -> throw new IllegalArgumentException("unresolved grouping: " + grouping);
    }
    return grid;
  }

  /** PARITY (_bucket_key_for): floor-truncate the LOCAL timestamp per grouping. */
  static LocalDateTime bucketKey(LocalDateTime local, String grouping) {
    return switch (grouping) {
      case "hourly" -> local.withMinute(0).withSecond(0).withNano(0);
      case "daily" -> local.toLocalDate().atStartOfDay();
      case "weekly" -> local.toLocalDate()
          .minusDays(local.getDayOfWeek().getValue() - 1L).atStartOfDay();
      case "monthly" -> local.toLocalDate().withDayOfMonth(1).atStartOfDay();
      default -> throw new IllegalArgumentException("unresolved grouping: " + grouping);
    };
  }

  // ---------- readings (the Ingestion seam) ----------

  record LocalReading(LocalDateTime localTime, Map<String, Double> values) {}

  /** get_readings parity: local-midnight..local-23:59:59.999999 window; errors -> []. */
  List<LocalReading> fetchReadings(UUID pondId, LocalDate start, LocalDate end) {
    try {
      Instant from = start.atStartOfDay(zone).toInstant();
      Instant to = end.atTime(23, 59, 59, 999_999_000).atZone(zone).toInstant();
      GetReadingsRequest.Builder req = GetReadingsRequest.newBuilder()
          .setPondId(pondId.toString())
          .setStart(from.toString())
          .setEnd(to.toString());
      for (ParameterDef p : PARAMETERS) {
        req.addParameters(p.code());
      }
      List<LocalReading> out = new ArrayList<>();
      for (ReadingRow row : ingestion.getReadings(req.build()).getRowsList()) {
        out.add(new LocalReading(
            ZonedDateTime.ofInstant(Instant.parse(row.getMeasuredAt()), zone).toLocalDateTime(),
            row.getValuesMap()));
      }
      return out;
    } catch (Exception e) {
      log.warn("Readings fetch failed pond={} — serving empty (parity): {}", pondId, e.toString());
      return List.of(); // PARITY: get_readings swallows errors -> []
    }
  }

  // ---------- payloads (camelCase, exact FE contract) ----------

  @Transactional(readOnly = true)
  public Map<String, Object> listPondOptions(UUID projectId) {
    List<Pond> pondList = ponds.findByProjectIdOrderByNameAsc(projectId);
    Map<String, com.aquashield.api.ingestion.v1.ReadingWindow> windows = new HashMap<>();
    try {
      GetReadingWindowsRequest.Builder req = GetReadingWindowsRequest.newBuilder();
      pondList.forEach(p -> req.addPondIds(p.getPondId().toString()));
      if (req.getPondIdsCount() > 0) {
        ingestion.getReadingWindows(req.build()).getWindowsList()
            .forEach(w -> windows.put(w.getPondId(), w));
      }
    } catch (Exception e) {
      log.warn("Reading windows fetch failed — options served without sensor flags: {}",
          e.toString());
    }

    List<Map<String, Object>> options = new ArrayList<>();
    for (Pond pond : pondList) {
      var window = windows.get(pond.getPondId().toString());
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("pondId", pond.getPondId().toString());
      entry.put("name", pond.getName());
      entry.put("companyName", metaText(pond, "company_name"));
      entry.put("gpsLocation", metaText(pond, "gps_location"));
      entry.put("treatments", activeTreatments(pond.getPondId()));
      entry.put("hasSensorData", window != null);
      entry.put("firstReadingAt", window == null ? null : pyIso(window.getFirstAt()));
      entry.put("lastReadingAt", window == null ? null : pyIso(window.getLastAt()));
      options.add(entry);
    }
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("projectId", projectId.toString());
    body.put("ponds", options);
    return body;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> compare(UUID projectId, Pond pondA, Pond pondB,
                                     LocalDate start, LocalDate end, String grouping) {
    String resolved = resolveGrouping(grouping, start, end);
    LinkedHashMap<LocalDateTime, String> grid = bucketGrid(start, end, resolved);

    List<LocalReading> readingsA = fetchReadings(pondA.getPondId(), start, end);
    List<LocalReading> readingsB = fetchReadings(pondB.getPondId(), start, end);

    List<Map<String, Object>> metrics = new ArrayList<>();
    List<Map<String, Object>> charts = new ArrayList<>();
    for (ParameterDef p : PARAMETERS) {
      // PARITY: card averages over the WHOLE range (not bucketed)
      double avgA = safeAvg(paramValues(readingsA, p.code()));
      double avgB = safeAvg(paramValues(readingsB, p.code()));
      Map<String, Object> metric = new LinkedHashMap<>();
      metric.put("parameter", p.code());
      metric.put("label", p.label());
      metric.put("unit", p.unit());
      metric.put("pondAValue", avgA);
      metric.put("pondBValue", avgB);
      metric.put("difference", PyRound.round(avgA - avgB, 2));
      metric.put("percentDifference", pctDiff(avgA, avgB));
      metric.put("lowerIsBetter", p.lowerIsBetter());
      metrics.add(metric);

      Map<LocalDateTime, List<Double>> bucketsA = bucketValues(readingsA, p.code(), resolved, grid);
      Map<LocalDateTime, List<Double>> bucketsB = bucketValues(readingsB, p.code(), resolved, grid);
      List<Map<String, Object>> data = new ArrayList<>();
      for (Map.Entry<LocalDateTime, String> bucket : grid.entrySet()) {
        data.add(Map.of("label", bucket.getValue(),
            "seriesA", safeAvg(bucketsA.getOrDefault(bucket.getKey(), List.of())),
            "seriesB", safeAvg(bucketsB.getOrDefault(bucket.getKey(), List.of()))));
      }
      Map<String, Object> chart = new LinkedHashMap<>();
      chart.put("parameter", p.code());
      chart.put("title", p.label());
      chart.put("unit", p.unit());
      chart.put("variant", "line");
      chart.put("data", data);
      charts.add(chart);
    }

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("projectId", projectId.toString());
    body.put("pondA", pondRef(pondA));
    body.put("pondB", pondRef(pondB));
    body.put("dateRange", Map.of("startDate", start.toString(), "endDate", end.toString(),
        "grouping", resolved)); // PARITY: never 'auto'
    body.put("metrics", metrics);
    body.put("charts", charts);
    return body;
  }

  private static List<Double> paramValues(List<LocalReading> readings, String code) {
    List<Double> values = new ArrayList<>();
    for (LocalReading r : readings) {
      values.add(r.values().get(code)); // null when absent — safeAvg drops them
    }
    return values;
  }

  /** Readings whose bucket key is not on the grid are dropped (parity). */
  private static Map<LocalDateTime, List<Double>> bucketValues(
      List<LocalReading> readings, String code, String grouping,
      Map<LocalDateTime, String> grid) {
    Map<LocalDateTime, List<Double>> out = new HashMap<>();
    for (LocalReading r : readings) {
      Double value = r.values().get(code);
      if (value == null) {
        continue;
      }
      LocalDateTime key = bucketKey(r.localTime(), grouping);
      if (grid.containsKey(key)) {
        out.computeIfAbsent(key, k -> new ArrayList<>()).add(value);
      }
    }
    return out;
  }

  private Map<String, Object> pondRef(Pond pond) {
    Map<String, Object> ref = new LinkedHashMap<>();
    ref.put("pondId", pond.getPondId().toString());
    ref.put("name", pond.getName());
    ref.put("treatments", activeTreatments(pond.getPondId()));
    return ref;
  }

  private List<Map<String, Object>> activeTreatments(UUID pondId) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (PondTreatment t : treatments.findByPondIdAndEndedAtIsNullOrderByStartedAtDesc(pondId)) {
      out.add(Map.of("code", t.getTreatment().getCode(), "name", t.getTreatment().getName(),
          "startedAt", t.getStartedAt().toString()));
    }
    return out;
  }

  /** Python isoformat() of localtime(): seconds always present, micros only when != 0. */
  String pyIso(String utcInstant) {
    ZonedDateTime local = ZonedDateTime.ofInstant(Instant.parse(utcInstant), zone);
    String base = local.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
    int micros = local.getNano() / 1000;
    if (micros != 0) {
      base += String.format(".%06d", micros);
    }
    return base + local.getOffset();
  }

  private static String metaText(Pond pond, String key) {
    return pond.getMetadata() == null ? "" : pond.getMetadata().path(key).asText("");
  }
}
