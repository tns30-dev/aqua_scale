package com.aquashield.pond.service;

import com.aquashield.api.ingestion.v1.GetReadingWindowsRequest;
import com.aquashield.api.ingestion.v1.GetPondParameterBucketAveragesRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.PondParameterBucketAverage;
import com.aquashield.api.project.v1.GetParameterCatalogueRequest;
import com.aquashield.api.project.v1.GetParameterSettingsRequest;
import com.aquashield.api.project.v1.ParameterSetting;
import com.aquashield.api.project.v1.ParameterTypeInfo;
import com.aquashield.api.project.v1.ProjectServiceGrpc;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Pond comparison, second-round contract. Parameters are now dynamic: explicit
 * query pills win; otherwise the service compares parameters watched by treatment
 * courses overlapping the selected window, with a four-parameter fallback.
 */
@Service
public class ComparisonService {

  private static final Logger log = LoggerFactory.getLogger(ComparisonService.class);

  public record ParameterDef(
      String code, String label, String title, String unit, Boolean lowerIsBetter) {}

  public static final List<String> CANONICAL_ORDER = List.of(
      "ammonia", "dissolved_oxygen", "turbidity", "ph", "alkalinity",
      "nitrite", "nitrate", "tan", "ammonium", "salinity", "temperature",
      "total_hardness", "calcium", "magnesium", "phosphate", "carbonate",
      "bicarbonate", "hydrogen_sulfide", "ph_lab", "water_level",
      "total_vibrio_count", "total_bacteria_count");

  public static final List<String> DEFAULT_PARAMETERS =
      List.of("ammonia", "dissolved_oxygen", "turbidity", "ph");

  private static final Map<String, Boolean> LOWER_IS_BETTER = Map.ofEntries(
      Map.entry("ammonia", true),
      Map.entry("ammonium", true),
      Map.entry("nitrite", true),
      Map.entry("nitrate", true),
      Map.entry("tan", true),
      Map.entry("turbidity", true),
      Map.entry("hydrogen_sulfide", true),
      Map.entry("phosphate", true),
      Map.entry("total_vibrio_count", true),
      Map.entry("total_bacteria_count", true),
      Map.entry("dissolved_oxygen", false));

  private static final Map<String, String> LABEL_OVERRIDES =
      Map.of("dissolved_oxygen", "Dissolved O2");
  private static final Map<String, String> TITLE_OVERRIDES =
      Map.of("dissolved_oxygen", "Dissolved Oxygen (DO)");
  private static final Map<String, String> UNIT_OVERRIDES =
      Map.of("ph", "pH", "ph_lab", "pH");

  public static final Set<String> VALID_GROUPINGS =
      Set.of("auto", "hourly", "daily", "weekly", "monthly");
  private static final long COMPARISON_CACHE_TTL_MILLIS = 30_000L;
  private static final int COMPARISON_CACHE_MAX = 128;

  private final PondRepository ponds;
  private final PondTreatmentRepository treatments;
  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion;
  private final ProjectServiceGrpc.ProjectServiceBlockingStub projectStub;
  private final ZoneId zone;
  private final ConcurrentMap<ComparisonCacheKey, ComparisonCacheEntry> comparisonCache =
      new ConcurrentHashMap<>();
  private final ConcurrentMap<ComparisonCacheKey, CompletableFuture<Map<String, Object>>> inflight =
      new ConcurrentHashMap<>();

  private record ComparisonCacheKey(UUID projectId, UUID pondAId, UUID pondBId,
                                    LocalDate start, LocalDate end, String grouping,
                                    boolean customParameters, List<String> parameters) {
    ComparisonCacheKey {
      parameters = List.copyOf(parameters);
    }
  }

  private record ComparisonCacheEntry(long expiresAtMillis, Map<String, Object> body) {}

  public ComparisonService(PondRepository ponds, PondTreatmentRepository treatments,
                           IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion,
                           ProjectServiceGrpc.ProjectServiceBlockingStub projectStub,
                           @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.ponds = ponds;
    this.treatments = treatments;
    this.ingestion = ingestion;
    this.projectStub = projectStub;
    this.zone = ZoneId.of(timezone);
  }

  /** Source parity: inclusive span days. */
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

  /** Source parity: round((a-b)/b*100); denominator 0 returns 0. */
  static long pctDiff(double a, double b) {
    if (b == 0) {
      return 0;
    }
    return PyRound.round((a - b) / b * 100);
  }

  static double safeAvg(List<Double> values) {
    List<Double> usable = values.stream().filter(v -> v != null).toList();
    if (usable.isEmpty()) {
      return 0.0;
    }
    double avg = usable.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    return PyRound.round(avg, 2);
  }

  static Double bucketAvg(List<Double> values) {
    List<Double> usable = values.stream().filter(v -> v != null).toList();
    if (usable.isEmpty()) {
      return null;
    }
    double avg = usable.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    return PyRound.round(avg, 2);
  }

  private static double safeWeightedAvg(List<BucketStat> values) {
    long count = values.stream().mapToLong(BucketStat::sampleCount).sum();
    if (count == 0) {
      return 0.0;
    }
    double total = values.stream()
        .mapToDouble(v -> v.average() * v.sampleCount())
        .sum();
    return PyRound.round(total / count, 2);
  }

  private static boolean hasSamples(List<BucketStat> values) {
    return values.stream().anyMatch(v -> v.sampleCount() > 0);
  }

  public static List<String> unknownParameters(List<String> requested) {
    Set<String> known = new LinkedHashSet<>(CANONICAL_ORDER);
    return requested.stream().filter(code -> !known.contains(code)).distinct().sorted().toList();
  }

  // ---------- grid + bucketing (all in local time, Asia/Singapore by default) ----------

  private static final DateTimeFormatter DAY_FMT =
      DateTimeFormatter.ofPattern("MMM dd", Locale.ENGLISH);

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
        LocalDate anchor = start.minusDays(start.getDayOfWeek().getValue() - 1L);
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

  record BucketStat(double average, long sampleCount) {}

  Map<String, Map<LocalDateTime, BucketStat>> fetchBucketAverages(
      UUID pondId, LocalDate start, LocalDate end, String grouping, List<String> parameters) {
    try {
      Instant from = start.atStartOfDay(zone).toInstant();
      Instant to = end.atTime(23, 59, 59, 999_999_000).atZone(zone).toInstant();
      GetPondParameterBucketAveragesRequest.Builder req =
          GetPondParameterBucketAveragesRequest.newBuilder()
          .setPondId(pondId.toString())
          .setStart(from.toString())
          .setEnd(to.toString())
          .setTimezone(zone.getId())
          .setGrouping(grouping);
      parameters.stream().distinct().forEach(req::addParameters);
      Map<String, Map<LocalDateTime, BucketStat>> out = new HashMap<>();
      for (PondParameterBucketAverage row :
          ingestion.getPondParameterBucketAverages(req.build()).getRowsList()) {
        LocalDateTime bucket = ZonedDateTime
            .ofInstant(Instant.parse(row.getBucketStart()), zone)
            .toLocalDateTime();
        out.computeIfAbsent(row.getParameter(), ignored -> new HashMap<>())
            .put(bucket, new BucketStat(row.getAverage(), row.getSampleCount()));
      }
      return out;
    } catch (Exception e) {
      log.warn("Reading aggregate fetch failed pond={} - serving empty: {}",
          pondId, e.toString());
      return Map.of();
    }
  }

  // ---------- payloads ----------

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
      log.warn("Reading windows fetch failed - options served without sensor flags: {}",
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
                                     LocalDate start, LocalDate end, String grouping,
                                     List<String> explicitParameters) {
    String resolved = resolveGrouping(grouping, start, end);
    List<String> cacheParameters = explicitParameters == null
        ? List.of()
        : List.copyOf(explicitParameters);
    ComparisonCacheKey cacheKey = new ComparisonCacheKey(projectId, pondA.getPondId(),
        pondB.getPondId(), start, end, resolved, explicitParameters != null, cacheParameters);
    Map<String, Object> cached = cachedComparison(cacheKey);
    if (cached != null) {
      return cached;
    }

    CompletableFuture<Map<String, Object>> current = new CompletableFuture<>();
    CompletableFuture<Map<String, Object>> existing = inflight.putIfAbsent(cacheKey, current);
    if (existing != null) {
      return awaitComparison(existing);
    }
    try {
      Map<String, Object> body = buildComparison(projectId, pondA, pondB, start, end,
          resolved, explicitParameters);
      rememberComparison(cacheKey, body);
      current.complete(body);
      return body;
    } catch (RuntimeException | Error e) {
      current.completeExceptionally(e);
      throw e;
    } finally {
      inflight.remove(cacheKey, current);
    }
  }

  private Map<String, Object> buildComparison(UUID projectId, Pond pondA, Pond pondB,
                                              LocalDate start, LocalDate end, String resolved,
                                              List<String> explicitParameters) {
    LinkedHashMap<LocalDateTime, String> grid = bucketGrid(start, end, resolved);
    List<PondTreatment> coursesA = windowCourses(pondA.getPondId(), start, end);
    List<PondTreatment> coursesB = windowCourses(pondB.getPondId(), start, end);
    Watched watched = watched(coursesA, coursesB);

    String parameterSource;
    List<String> codes;
    if (explicitParameters != null) {
      Set<String> requested = new LinkedHashSet<>(explicitParameters);
      codes = CANONICAL_ORDER.stream().filter(requested::contains).toList();
      parameterSource = "custom";
    } else {
      codes = CANONICAL_ORDER.stream().filter(watched.codes()::contains).toList();
      parameterSource = codes.isEmpty() ? "default" : "treatments";
      if (codes.isEmpty()) {
        codes = DEFAULT_PARAMETERS;
      }
    }

    Map<String, ParameterMeta> meta = parameterMetadata();
    List<ParameterDef> defs = paramDefsFor(codes, meta);
    List<String> wanted = defs.stream().map(ParameterDef::code).toList();
    Map<String, Map<LocalDateTime, BucketStat>> readingsA =
        fetchBucketAverages(pondA.getPondId(), start, end, resolved, wanted);
    Map<String, Map<LocalDateTime, BucketStat>> readingsB =
        fetchBucketAverages(pondB.getPondId(), start, end, resolved, wanted);

    List<Map<String, Object>> metrics = new ArrayList<>();
    List<Map<String, Object>> charts = new ArrayList<>();
    for (ParameterDef p : defs) {
      List<BucketStat> valuesA = paramStats(readingsA, p.code());
      List<BucketStat> valuesB = paramStats(readingsB, p.code());
      double avgA = safeWeightedAvg(valuesA);
      double avgB = safeWeightedAvg(valuesB);
      Map<String, Object> metric = new LinkedHashMap<>();
      metric.put("parameter", p.code());
      metric.put("label", p.label());
      metric.put("unit", p.unit());
      metric.put("watchedBy", watched.declaredBy().getOrDefault(p.code(), List.of()));
      metric.put("pondAValue", avgA);
      metric.put("pondBValue", avgB);
      metric.put("pondAHasReadings", hasSamples(valuesA));
      metric.put("pondBHasReadings", hasSamples(valuesB));
      metric.put("difference", PyRound.round(avgA - avgB, 2));
      metric.put("percentDifference", pctDiff(avgA, avgB));
      metric.put("lowerIsBetter", p.lowerIsBetter());
      metrics.add(metric);

      Map<LocalDateTime, BucketStat> bucketsA = readingsA.getOrDefault(p.code(), Map.of());
      Map<LocalDateTime, BucketStat> bucketsB = readingsB.getOrDefault(p.code(), Map.of());
      List<Map<String, Object>> data = new ArrayList<>();
      for (Map.Entry<LocalDateTime, String> bucket : grid.entrySet()) {
        BucketStat statA = bucketsA.get(bucket.getKey());
        BucketStat statB = bucketsB.get(bucket.getKey());
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("label", bucket.getValue());
        point.put("seriesA", statA == null ? null : PyRound.round(statA.average(), 2));
        point.put("seriesB", statB == null ? null : PyRound.round(statB.average(), 2));
        data.add(point);
      }
      Map<String, Object> chart = new LinkedHashMap<>();
      chart.put("parameter", p.code());
      chart.put("title", p.title());
      chart.put("unit", p.unit());
      chart.put("variant", "line");
      chart.put("data", data);
      charts.add(chart);
    }

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("projectId", projectId.toString());
    body.put("pondA", pondRef(pondA, coursesA));
    body.put("pondB", pondRef(pondB, coursesB));
    body.put("dateRange", Map.of("startDate", start.toString(), "endDate", end.toString(),
        "grouping", resolved));
    body.put("parameterSource", parameterSource);
    body.put("availableParameters", availableParameters(projectId, meta));
    body.put("metrics", metrics);
    body.put("charts", charts);
    return body;
  }

  private Map<String, Object> cachedComparison(ComparisonCacheKey key) {
    long now = System.currentTimeMillis();
    ComparisonCacheEntry entry = comparisonCache.get(key);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAtMillis() <= now) {
      comparisonCache.remove(key, entry);
      return null;
    }
    return entry.body();
  }

  private void rememberComparison(ComparisonCacheKey key, Map<String, Object> body) {
    long now = System.currentTimeMillis();
    comparisonCache.put(key, new ComparisonCacheEntry(now + COMPARISON_CACHE_TTL_MILLIS, body));
    pruneComparisonCache(now);
  }

  private void pruneComparisonCache(long now) {
    for (Map.Entry<ComparisonCacheKey, ComparisonCacheEntry> entry : comparisonCache.entrySet()) {
      if (entry.getValue().expiresAtMillis() <= now) {
        comparisonCache.remove(entry.getKey(), entry.getValue());
      }
    }
    int overflow = comparisonCache.size() - COMPARISON_CACHE_MAX;
    if (overflow <= 0) {
      return;
    }
    for (ComparisonCacheKey key : comparisonCache.keySet()) {
      comparisonCache.remove(key);
      overflow--;
      if (overflow <= 0) {
        return;
      }
    }
  }

  private static Map<String, Object> awaitComparison(
      CompletableFuture<Map<String, Object>> future) {
    try {
      return future.join();
    } catch (CompletionException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtime) {
        throw runtime;
      }
      if (cause instanceof Error error) {
        throw error;
      }
      throw new IllegalStateException(cause);
    }
  }

  private Map<String, Object> pondRef(Pond pond, List<PondTreatment> courses) {
    Map<String, Object> ref = new LinkedHashMap<>();
    ref.put("pondId", pond.getPondId().toString());
    ref.put("name", pond.getName());
    ref.put("treatments", windowTreatmentsJson(courses));
    return ref;
  }

  private List<PondTreatment> windowCourses(UUID pondId, LocalDate start, LocalDate end) {
    return treatments.findByPondIdAndStartedAtLessThanEqualOrderByStartedAtAsc(pondId, end).stream()
        .filter(pt -> pt.getEndedAt() == null || !pt.getEndedAt().isBefore(start))
        .toList();
  }

  private List<Map<String, Object>> windowTreatmentsJson(List<PondTreatment> courses) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (PondTreatment pt : courses) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("code", pt.getTreatment().getCode());
      row.put("name", pt.getTreatment().getName());
      row.put("startedAt", pt.getStartedAt().toString());
      row.put("endedAt", pt.getEndedAt() == null ? null : pt.getEndedAt().toString());
      out.add(row);
    }
    return out;
  }

  private Watched watched(List<PondTreatment> coursesA, List<PondTreatment> coursesB) {
    Set<String> codes = new LinkedHashSet<>();
    Map<String, List<String>> declaredBy = new LinkedHashMap<>();
    List<PondTreatment> all = new ArrayList<>();
    all.addAll(coursesA);
    all.addAll(coursesB);
    for (PondTreatment pt : all) {
      var params = pt.getTreatment().getTargetParameters();
      if (params == null || !params.isArray()) {
        continue;
      }
      params.forEach(item -> {
        if (!item.isTextual() || item.asText().isBlank()) {
          return;
        }
        String code = item.asText();
        codes.add(code);
        List<String> names = declaredBy.computeIfAbsent(code, k -> new ArrayList<>());
        if (!names.contains(pt.getTreatment().getName())) {
          names.add(pt.getTreatment().getName());
        }
      });
    }
    return new Watched(codes, declaredBy);
  }

  private static List<BucketStat> paramStats(
      Map<String, Map<LocalDateTime, BucketStat>> readings, String code) {
    return List.copyOf(readings.getOrDefault(code, Map.of()).values());
  }

  private List<Map<String, Object>> availableParameters(UUID projectId,
                                                        Map<String, ParameterMeta> meta) {
    try {
      Set<String> configured = new LinkedHashSet<>();
      for (ParameterSetting setting : projectStub.getParameterSettings(
          GetParameterSettingsRequest.newBuilder().setProjectId(projectId.toString()).build())
          .getSettingsList()) {
        configured.add(setting.getParameterCode());
        meta.putIfAbsent(setting.getParameterCode(),
            new ParameterMeta(setting.getParameterName(), setting.getUnit()));
      }
      return paramDefsFor(CANONICAL_ORDER.stream().filter(configured::contains).toList(), meta)
          .stream()
          .map(def -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("parameter", def.code());
            row.put("label", def.label());
            row.put("unit", def.unit());
            return row;
          })
          .toList();
    } catch (Exception e) {
      log.warn("Project parameter settings lookup failed project={} - add menu empty: {}",
          projectId, e.toString());
      return List.of();
    }
  }

  private Map<String, ParameterMeta> parameterMetadata() {
    try {
      Map<String, ParameterMeta> out = new HashMap<>();
      for (ParameterTypeInfo row : projectStub.getParameterCatalogue(
          GetParameterCatalogueRequest.newBuilder().build()).getParametersList()) {
        out.put(row.getCode(), new ParameterMeta(row.getName(), row.getUnit()));
      }
      return out;
    } catch (Exception e) {
      log.warn("Project parameter catalogue lookup failed - using code-derived labels: {}",
          e.toString());
      return new HashMap<>();
    }
  }

  private static List<ParameterDef> paramDefsFor(List<String> codes,
                                                 Map<String, ParameterMeta> meta) {
    List<ParameterDef> out = new ArrayList<>();
    for (String code : codes) {
      ParameterMeta row = meta.get(code);
      String name = row == null || row.name() == null || row.name().isBlank()
          ? titleize(code) : row.name();
      String unit = UNIT_OVERRIDES.getOrDefault(code,
          row == null || row.unit() == null ? "" : row.unit());
      out.add(new ParameterDef(code, LABEL_OVERRIDES.getOrDefault(code, name),
          TITLE_OVERRIDES.getOrDefault(code, name), unit, LOWER_IS_BETTER.get(code)));
    }
    return out;
  }

  private List<Map<String, Object>> activeTreatments(UUID pondId) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (PondTreatment t : treatments.findByPondIdAndEndedAtIsNullOrderByStartedAtDesc(pondId)) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("code", t.getTreatment().getCode());
      row.put("name", t.getTreatment().getName());
      row.put("startedAt", t.getStartedAt().toString());
      row.put("endedAt", null);
      out.add(row);
    }
    return out;
  }

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

  private static String titleize(String code) {
    String[] parts = code.split("_");
    List<String> words = new ArrayList<>();
    for (String part : parts) {
      if (part.isBlank()) {
        continue;
      }
      words.add(part.substring(0, 1).toUpperCase(Locale.ROOT) + part.substring(1));
    }
    return String.join(" ", words);
  }

  record ParameterMeta(String name, String unit) {}

  record Watched(Set<String> codes, Map<String, List<String>> declaredBy) {}
}
