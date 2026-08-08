package com.aquashield.project.service;

import com.aquashield.api.ingestion.v1.EnergyHourlyReading;
import com.aquashield.api.ingestion.v1.GetEnergyHourlyReadingsRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.common.util.PyRound;
import com.aquashield.project.api.dto.ProjectDtos.EnergySettingsDto;
import com.aquashield.project.api.dto.ProjectDtos.PutEnergySettingsRequest;
import com.aquashield.project.domain.ProjectEnergySetting;
import com.aquashield.project.repo.Repositories.ProjectEnergySettingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Energy settings + dashboard (PARITY: module_project/services/energy_dashboard.py,
 * line-for-line port — formerly the [XSVC] zero-data stub).
 *
 * Readings come through Ingestion GetEnergyHourlyReadings (project-wide electricity
 * aggregate; the monolith filtered sensor_readings by project_id + electricity__isnull=False).
 * Electricity is PER-INTERVAL consumption: SUMMED per local hour, never diffed.
 *
 * TIMEZONE: Asia/Singapore (config/settings/base.py) for all bucketing/labels/bounds.
 * Rounding: CPython round() half-to-even (PyRound) at the exact places the monolith
 * rounds (3dp totals, 2dp money/averages, 4dp tariff, 1dp percentages).
 */
@Service
public class EnergyService {

  private static final Logger log = LoggerFactory.getLogger(EnergyService.class);

  private static final Set<String> GROUP_BY = Set.of("hour", "day", "week", "month");
  /** PARITY: energy_dashboard.py CURRENCY_SYMBOLS (exact map). */
  private static final Map<String, String> CURRENCY_SYMBOLS = Map.of(
      "USD", "$", "EUR", "€", "GBP", "£", "JPY", "¥", "CNY", "¥",
      "SGD", "S$", "MYR", "RM", "THB", "฿", "INR", "₹", "AUD", "A$");

  private static final DateTimeFormatter MON_DD =
      DateTimeFormatter.ofPattern("MMM dd", Locale.ENGLISH);
  private static final DateTimeFormatter MON_DD_HHMM =
      DateTimeFormatter.ofPattern("MMM dd HH:mm", Locale.ENGLISH);
  private static final DateTimeFormatter MON_DD_COMMA_HHMM =
      DateTimeFormatter.ofPattern("MMM dd, HH:mm", Locale.ENGLISH);
  private static final DateTimeFormatter MON_YYYY =
      DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH);
  private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

  private final ProjectEnergySettingRepository energySettings;
  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion;
  private final ZoneId zone;
  private final long grpcDeadlineMs;

  public record ExportFile(String filename, byte[] content) {}

  public EnergyService(ProjectEnergySettingRepository energySettings,
                       IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion,
                       @Value("${aquashield.timezone:Asia/Singapore}") String timezone,
                       @Value("${aquashield.grpc.deadline-ms:2500}") long grpcDeadlineMs) {
    this.energySettings = energySettings;
    this.ingestion = ingestion;
    this.zone = ZoneId.of(timezone);
    this.grpcDeadlineMs = grpcDeadlineMs;
  }

  @Transactional(readOnly = true)
  public EnergySettingsDto getSettings(UUID projectId, String type) {
    return energySettings.findByProjectIdAndType(projectId, type)
        .map(EnergySettingsDto::from)
        .orElseGet(() -> EnergySettingsDto.defaults(type));
  }

  @Transactional
  public EnergySettingsDto putSettings(UUID projectId, String type,
                                       PutEnergySettingsRequest req, UUID actingUserId) {
    ProjectEnergySetting setting = energySettings.findByProjectIdAndType(projectId, type)
        .orElseGet(() -> new ProjectEnergySetting(projectId, type, actingUserId));
    // PARITY: merge — only keys present in the body are written
    if (req.unit() != null) {
      setting.setUnit(req.unit());
    }
    if (req.tariffPerUnit() != null) {
      setting.setTariffPerUnit(req.tariffPerUnit());
    }
    if (req.currency() != null) {
      setting.setCurrency(req.currency());
    }
    if (req.highHourlyThreshold() != null) {
      setting.setHighHourlyThreshold(req.highHourlyThreshold());
    }
    if (req.highDailyThreshold() != null) {
      setting.setHighDailyThreshold(req.highDailyThreshold());
    }
    if (req.manualEntryEnabled() != null) {
      setting.setManualEntryEnabled(req.manualEntryEnabled());
    }
    if (req.notes() != null) {
      setting.setNotes(req.notes());
    }
    setting.setUpdatedBy(actingUserId);
    return EnergySettingsDto.from(energySettings.save(setting));
  }

  public ExportFile exportXlsx(UUID projectId, String projectName,
                               String startDate, String endDate) {
    LocalDate end = parseDate(endDate, LocalDate.now(zone));
    LocalDate start = parseDate(startDate, end.minusDays(6));
    if (end.isBefore(start)) {
      throw new ProjectAppService.BadRequestException("endDate must be on or after startDate");
    }
    EnergySettingsDto settings = getSettings(projectId, "electricity");
    String symbol = CURRENCY_SYMBOLS.getOrDefault(settings.currency(), settings.currency());
    double tariff = settings.tariffPerUnit();
    long days = end.toEpochDay() - start.toEpochDay() + 1;
    LocalDate prevEnd = start.minusDays(1);
    LocalDate prevStart = prevEnd.minusDays(days - 1);
    Map<LocalDateTime, Double> all = hourly(projectId, prevStart, end);
    Map<LocalDateTime, Double> cur = slice(all, start, end);
    Map<LocalDateTime, Double> prev = slice(all, prevStart, prevEnd);
    double curTotal = PyRound.round(cur.values().stream().mapToDouble(Double::doubleValue).sum(), 3);
    double prevTotal = PyRound.round(prev.values().stream().mapToDouble(Double::doubleValue).sum(), 3);

    List<List<Object>> summaryRows = new ArrayList<>();
    summaryRows.add(List.of("Energy Consumption - " + projectName));
    summaryRows.add(List.of("Selected period", rangeLabel(start, end)));
    summaryRows.add(List.of("Generated", pyIso(ZonedDateTime.now(zone))));
    summaryRows.add(List.of());
    summaryRows.add(List.of("Metric", "Current Period"));
    for (Map<String, Object> row : summary(cur, prev, curTotal, prevTotal, days, tariff, symbol)) {
      summaryRows.add(List.of(row.get("metric"), row.get("current")));
    }

    Map<LocalDate, double[]> daily = dailyTotals(cur);
    List<List<Object>> dailyRows = new ArrayList<>();
    dailyRows.add(List.of("Daily records (" + rangeLabel(start, end) + ")"));
    dailyRows.add(List.of("Date", "Total Electricity (kWh)", "Average kWh per Hour"));
    daily.entrySet().stream()
        .sorted(Map.Entry.comparingByKey())
        .forEach(entry -> dailyRows.add(List.of(entry.getKey().toString(),
            PyRound.round(entry.getValue()[0], 3),
            PyRound.round(entry.getValue()[0] / entry.getValue()[1], 2))));

    List<List<Object>> alertRows = new ArrayList<>();
    alertRows.add(List.of("High consumption alerts (" + rangeLabel(start, end) + ")"));
    alertRows.add(List.of("Alert", "When", "Value", "Status"));
    for (Map<String, Object> alert : alerts(cur, settings)) {
      alertRows.add(List.of(alert.get("title"), alert.get("when"), alert.get("value"), "Computed"));
    }

    String slug = slug(projectName);
    String filename = "energy_" + slug + "_" + start + "_" + end + ".xlsx";
    return new ExportFile(filename, xlsx(List.of(
        new Sheet("Summary", summaryRows),
        new Sheet("Daily Records", dailyRows),
        new Sheet("Alerts", alertRows))));
  }

  // ---------- dashboard (energy_dashboard.py port) ----------

  public Map<String, Object> dashboard(UUID projectId, String groupBy,
                                       String startDate, String endDate) {
    if (!GROUP_BY.contains(groupBy)) {
      throw new ProjectAppService.BadRequestException(
          "Invalid groupBy. Must be one of: hour, day, week, month");
    }
    LocalDate end = parseDate(endDate, LocalDate.now(zone));
    LocalDate start = parseDate(startDate, end.minusDays(6));
    if (end.isBefore(start)) {
      throw new ProjectAppService.BadRequestException("endDate must be on or after startDate");
    }

    EnergySettingsDto settings = getSettings(projectId, "electricity");
    double tariff = settings.tariffPerUnit();
    String symbol = CURRENCY_SYMBOLS.getOrDefault(settings.currency(), settings.currency());

    long days = end.toEpochDay() - start.toEpochDay() + 1;
    LocalDate prevEnd = start.minusDays(1);
    LocalDate prevStart = prevEnd.minusDays(days - 1);

    Map<LocalDateTime, Double> all = hourly(projectId, prevStart, end);
    Map<LocalDateTime, Double> cur = slice(all, start, end);
    Map<LocalDateTime, Double> prev = slice(all, prevStart, prevEnd);
    double curTotal = PyRound.round(cur.values().stream().mapToDouble(Double::doubleValue).sum(), 3);
    double prevTotal = PyRound.round(prev.values().stream().mapToDouble(Double::doubleValue).sum(), 3);

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("lastUpdated", pyIso(ZonedDateTime.now(zone)));
    body.put("dateRangeLabel", rangeLabel(start, end));
    body.put("kpis", kpis(cur, prev, curTotal, prevTotal, days, tariff, symbol));
    body.put("trend", trend(cur, prev, groupBy, start, end, prevStart, prevEnd));
    body.put("trendCurrentLabel", "Current period");
    body.put("trendPreviousLabel", "Previous period");
    body.put("heatmap", heatmap(cur, start, end));
    body.put("summary", summary(cur, prev, curTotal, prevTotal, days, tariff, symbol));
    body.put("byPeriod", byPeriod(cur, groupBy, start, end));
    body.put("alerts", alerts(cur, settings));
    body.put("dataQuality", dataQuality(cur, days));
    body.put("compareInfo", Map.of(
        "currentRange", rangeLabel(start, end),
        "previousRange", rangeLabel(prevStart, prevEnd)));
    return body;
  }

  /** _hourly: {local hour-truncated datetime -> summed kWh}; sparse; errors -> empty. */
  Map<LocalDateTime, Double> hourly(UUID projectId, LocalDate start, LocalDate end) {
    Map<LocalDateTime, Double> buckets = new LinkedHashMap<>(); // insertion order = row order
    try {
      Instant from = start.atStartOfDay(zone).toInstant();
      Instant to = end.atTime(23, 59, 59, 999_999_000).atZone(zone).toInstant();
      var resp = ingestion.withDeadlineAfter(grpcDeadlineMs, TimeUnit.MILLISECONDS)
          .getEnergyHourlyReadings(GetEnergyHourlyReadingsRequest.newBuilder()
          .setProjectId(projectId.toString())
          .setStart(from.toString())
          .setEnd(to.toString())
          .setTimezone(zone.getId())
          .build());
      for (EnergyHourlyReading row : resp.getRowsList()) {
        LocalDateTime hour = ZonedDateTime
            .ofInstant(Instant.parse(row.getHourStart()), zone)
            .toLocalDateTime();
        buckets.merge(hour, row.getKwh(), Double::sum);
      }
    } catch (Exception e) {
      log.warn("Energy readings fetch failed project={} — serving empty: {}",
          projectId, e.toString());
    }
    return buckets;
  }

  private static Map<LocalDateTime, Double> slice(Map<LocalDateTime, Double> hourly,
                                                  LocalDate start, LocalDate end) {
    Map<LocalDateTime, Double> out = new LinkedHashMap<>();
    for (Map.Entry<LocalDateTime, Double> entry : hourly.entrySet()) {
      LocalDate day = entry.getKey().toLocalDate();
      if (!day.isBefore(start) && !day.isAfter(end)) {
        out.put(entry.getKey(), entry.getValue());
      }
    }
    return out;
  }

  private Map<String, Object> kpis(Map<LocalDateTime, Double> cur,
                                   Map<LocalDateTime, Double> prev,
                                   double curTotal, double prevTotal, long days,
                                   double tariff, String symbol) {
    long hours = days * 24;
    Peak peak = peak(cur, days > 1);
    Peak previousPeak = peak(prev, false);
    double pct = prevTotal != 0
        ? PyRound.round((curTotal - prevTotal) / prevTotal * 100, 1) : Double.NaN;
    Map<String, Object> kpis = new LinkedHashMap<>();
    kpis.put("totalKwh", curTotal);
    kpis.put("estimatedCost", PyRound.round(curTotal * tariff, 2));
    kpis.put("tariffPerKwh", PyRound.round(tariff, 4));
    kpis.put("currencySymbol", symbol);
    kpis.put("avgKwhPerDay", days != 0 ? PyRound.round(curTotal / days, 2) : 0.0);
    kpis.put("avgKwhPerHour", hours != 0 ? PyRound.round(curTotal / hours, 2) : 0.0);
    kpis.put("peakHourKwh", peak.value());
    kpis.put("peakHourLabel", peak.label());
    kpis.put("changeVsPreviousPct", Double.isNaN(pct) ? null : pct);
    kpis.put("costChange", PyRound.round((curTotal - prevTotal) * tariff, 2));
    kpis.put("compareLabel", "previous " + days + " day" + (days != 1 ? "s" : ""));
    kpis.put("previousTotalKwh", prevTotal);
    kpis.put("previousEstimatedCost", PyRound.round(prevTotal * tariff, 2));
    kpis.put("previousAvgKwhPerDay", days != 0 ? PyRound.round(prevTotal / days, 2) : 0.0);
    kpis.put("previousAvgKwhPerHour", hours != 0 ? PyRound.round(prevTotal / hours, 2) : 0.0);
    kpis.put("previousPeakHourKwh", previousPeak.value());
    return kpis;
  }

  private record Peak(String label, double value) {}

  /** _peak: first max in insertion order (monolith dict order); empty -> ('—', 0.0). */
  private static Peak peak(Map<LocalDateTime, Double> hourly, boolean withDate) {
    if (hourly.isEmpty()) {
      return new Peak("—", 0.0);
    }
    LocalDateTime bestHour = null;
    double best = Double.NEGATIVE_INFINITY;
    for (Map.Entry<LocalDateTime, Double> e : hourly.entrySet()) {
      if (e.getValue() > best) { // strict > keeps the FIRST max (Python max semantics)
        best = e.getValue();
        bestHour = e.getKey();
      }
    }
    return new Peak(bestHour.format(withDate ? MON_DD_COMMA_HHMM : HHMM), PyRound.round(best, 2));
  }

  private record Bucket(String key, String label) {}

  /** _bucket: (sort_key, label) for a local hour datetime under group_by. */
  private static Bucket bucket(LocalDateTime dt, String groupBy, LocalDate periodStart) {
    return switch (groupBy) {
      case "hour" -> new Bucket(
          dt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH")), dt.format(MON_DD_HHMM));
      case "week" -> {
        long idx = (dt.toLocalDate().toEpochDay() - periodStart.toEpochDay()) / 7 + 1;
        yield new Bucket(String.format("%03d", idx), "Week " + idx);
      }
      case "month" -> new Bucket(dt.format(DateTimeFormatter.ofPattern("yyyy-MM")),
          dt.format(MON_YYYY));
      default -> new Bucket(dt.format(DateTimeFormatter.ISO_LOCAL_DATE), dt.format(MON_DD));
    };
  }

  private record SeriesEntry(String key, String label, double total) {}

  /** _series: chronological hours -> first-seen bucket order, totals rounded 3dp. */
  private static List<SeriesEntry> series(Map<LocalDateTime, Double> hourly, String groupBy,
                                          LocalDate periodStart) {
    Map<String, double[]> agg = new LinkedHashMap<>();
    Map<String, String> labels = new LinkedHashMap<>();
    for (Map.Entry<LocalDateTime, Double> e : new TreeMap<>(hourly).entrySet()) {
      Bucket b = bucket(e.getKey(), groupBy, periodStart);
      labels.putIfAbsent(b.key(), b.label());
      agg.computeIfAbsent(b.key(), k -> new double[1])[0] += e.getValue();
    }
    List<SeriesEntry> out = new ArrayList<>();
    for (Map.Entry<String, double[]> e : agg.entrySet()) {
      out.add(new SeriesEntry(e.getKey(), labels.get(e.getKey()),
          PyRound.round(e.getValue()[0], 3)));
    }
    return out;
  }

  private static String weekSpan(LocalDate periodStart, LocalDate periodEnd, int idx) {
    LocalDate s = periodStart.plusDays((long) (idx - 1) * 7);
    LocalDate e = s.plusDays(6).isAfter(periodEnd) ? periodEnd : s.plusDays(6);
    return s.format(MON_DD) + " – " + e.format(MON_DD);
  }

  /** _trend: current and previous buckets paired by offset from each period start. */
  private List<Map<String, Object>> trend(Map<LocalDateTime, Double> cur,
                                          Map<LocalDateTime, Double> prev, String groupBy,
                                          LocalDate startDate, LocalDate endDate,
                                          LocalDate prevStart, LocalDate prevEnd) {
    List<SeriesEntry> curS = series(cur, groupBy, startDate);
    List<SeriesEntry> prevS = series(prev, groupBy, prevStart);
    Map<Integer, Double> prevByOffset = new LinkedHashMap<>();
    for (SeriesEntry entry : prevS) {
      prevByOffset.put(offset(entry.key(), groupBy, prevStart), entry.total());
    }
    List<Map<String, Object>> out = new ArrayList<>();
    for (SeriesEntry entry : curS) {
      int offset = offset(entry.key(), groupBy, startDate);
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("label", entry.label());
      row.put("current", entry.total());
      row.put("previous", prevByOffset.get(offset));
      row.put("currentLabel", "week".equals(groupBy)
          ? weekSpan(startDate, endDate, Integer.parseInt(entry.key())) : entry.label());
      row.put("previousLabel", previousLabelFor(offset, groupBy, prevStart, prevEnd));
      out.add(row);
    }
    return out;
  }

  private static int offset(String key, String groupBy, LocalDate periodStart) {
    return switch (groupBy) {
      case "hour" -> {
        LocalDateTime dt = LocalDate.parse(key.substring(0, 10)).atTime(
            Integer.parseInt(key.substring(11, 13)), 0);
        yield (int) java.time.Duration.between(periodStart.atStartOfDay(), dt).toHours();
      }
      case "week" -> Integer.parseInt(key);
      case "month" -> {
        String[] parts = key.split("-");
        int year = Integer.parseInt(parts[0]);
        int month = Integer.parseInt(parts[1]);
        yield (year * 12 + month) - (periodStart.getYear() * 12 + periodStart.getMonthValue());
      }
      default -> (int) (LocalDate.parse(key).toEpochDay() - periodStart.toEpochDay());
    };
  }

  private static String previousLabelFor(int offset, String groupBy,
                                         LocalDate prevStart, LocalDate prevEnd) {
    return switch (groupBy) {
      case "hour" -> prevStart.atStartOfDay().plusHours(offset).format(MON_DD_HHMM);
      case "week" -> weekSpan(prevStart, prevEnd, offset);
      case "month" -> prevStart.plusMonths(offset).withDayOfMonth(1).format(MON_YYYY);
      default -> prevStart.plusDays(offset).format(MON_DD);
    };
  }

  /** _heatmap: 24 hour-rows x day-columns; cells null until data; 3dp. */
  private Map<String, Object> heatmap(Map<LocalDateTime, Double> cur,
                                      LocalDate start, LocalDate end) {
    List<LocalDate> dates = new ArrayList<>();
    for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
      dates.add(d);
    }
    Double[][] matrix = new Double[24][dates.size()];
    double maxVal = 0.0;
    for (Map.Entry<LocalDateTime, Double> e : cur.entrySet()) {
      int c = dates.indexOf(e.getKey().toLocalDate());
      if (c >= 0) {
        int r = e.getKey().getHour();
        double v = PyRound.round((matrix[r][c] == null ? 0.0 : matrix[r][c]) + e.getValue(), 3);
        matrix[r][c] = v;
        maxVal = Math.max(maxVal, v);
      }
    }
    List<List<Double>> rows = new ArrayList<>();
    for (Double[] row : matrix) {
      rows.add(java.util.Arrays.asList(row));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("dateLabels", dates.stream().map(d -> d.format(MON_DD)).toList());
    out.put("hourLabels", java.util.stream.IntStream.range(0, 24)
        .mapToObj(h -> String.format("%02d:00", h)).toList());
    out.put("matrix", rows);
    out.put("maxValue", PyRound.round(maxVal, 3));
    return out;
  }

  private List<Map<String, Object>> summary(Map<LocalDateTime, Double> cur,
                                            Map<LocalDateTime, Double> prev,
                                            double curTotal, double prevTotal, long days,
                                            double tariff, String symbol) {
    double curPeak = peak(cur, false).value();
    double prevPeak = peak(prev, false).value();
    double curAvg = days != 0 ? PyRound.round(curTotal / days, 2) : 0.0;
    double prevAvg = days != 0 ? PyRound.round(prevTotal / days, 2) : 0.0;
    return List.of(
        summaryRow("Total Consumption", curTotal, prevTotal, "kWh", false),
        summaryRow("Average Daily", curAvg, prevAvg, "kWh", false),
        summaryRow("Peak Hour", curPeak, prevPeak, "kWh", false),
        summaryRow("Estimated Cost", PyRound.round(curTotal * tariff, 2),
            PyRound.round(prevTotal * tariff, 2), symbol, true));
  }

  /** _summary_row: {:,.2f} formats, 'x.x% lower/higher' / 'no prior data' / '—'. */
  private static Map<String, Object> summaryRow(String metric, double cur, double prev,
                                                String unit, boolean currency) {
    // PARITY: Python's format() rounds half-even — pre-round before Java's half-up %f
    String curFmt = currency
        ? unit + String.format(Locale.US, "%,.2f", PyRound.round(cur, 2))
        : String.format(Locale.US, "%,.2f %s", PyRound.round(cur, 2), unit);
    String prevFmt = currency
        ? unit + String.format(Locale.US, "%,.2f", PyRound.round(prev, 2))
        : String.format(Locale.US, "%,.2f %s", PyRound.round(prev, 2), unit);
    double diff = cur - prev;
    boolean lower = diff < 0;
    String change;
    if (prev != 0) {
      change = String.format(Locale.US, "%.1f%% ",
          PyRound.round(Math.abs(diff) / prev * 100, 1)) + (lower ? "lower" : "higher");
    } else if (cur != 0) {
      change = "no prior data";
    } else {
      change = "—";
    }
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("metric", metric);
    row.put("current", curFmt);
    row.put("previous", prevFmt);
    row.put("change", change);
    row.put("improved", lower && prev > 0);
    return row;
  }

  private Map<String, Object> byPeriod(Map<LocalDateTime, Double> cur, String groupBy,
                                       LocalDate start, LocalDate end) {
    Map<String, String> titles = Map.of(
        "hour", "Consumption by Hour", "day", "Consumption by Day",
        "week", "Consumption by Week", "month", "Consumption by Month");
    List<Map<String, Object>> rows = new ArrayList<>();
    for (SeriesEntry entry : series(cur, groupBy, start)) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("label", "week".equals(groupBy)
          ? weekSpan(start, end, Integer.parseInt(entry.key())) : entry.label());
      row.put("kwh", entry.total());
      rows.add(row);
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("title", titles.getOrDefault(groupBy, "Consumption by Day"));
    out.put("rows", rows);
    return out;
  }

  /** _alerts: hourly (sorted) then daily (sorted), strict >, {:,.1f}, first 20. */
  private List<Map<String, Object>> alerts(Map<LocalDateTime, Double> cur,
                                           EnergySettingsDto settings) {
    List<Map<String, Object>> alerts = new ArrayList<>();
    Double hourlyThr = settings.highHourlyThreshold() == null
        ? null : settings.highHourlyThreshold().doubleValue();
    Double dailyThr = settings.highDailyThreshold() == null
        ? null : settings.highDailyThreshold().doubleValue();
    if (hourlyThr != null) {
      for (Map.Entry<LocalDateTime, Double> e : new TreeMap<>(cur).entrySet()) {
        if (e.getValue() > hourlyThr) {
          alerts.add(Map.of(
              "title", "High hourly consumption",
              "when", e.getKey().format(MON_DD_COMMA_HHMM),
              "value", String.format(Locale.US, "%,.1f kWh", PyRound.round(e.getValue(), 1))));
        }
      }
    }
    if (dailyThr != null) {
      Map<LocalDate, Double> daily = new TreeMap<>();
      for (Map.Entry<LocalDateTime, Double> e : cur.entrySet()) {
        daily.merge(e.getKey().toLocalDate(), e.getValue(), Double::sum);
      }
      for (Map.Entry<LocalDate, Double> e : daily.entrySet()) {
        if (e.getValue() > dailyThr) {
          alerts.add(Map.of(
              "title", "High daily consumption",
              "when", e.getKey().format(MON_DD),
              "value", String.format(Locale.US, "%,.1f kWh", PyRound.round(e.getValue(), 1))));
        }
      }
    }
    return alerts.size() > 20 ? alerts.subList(0, 20) : alerts;
  }

  /** _data_quality: distinct populated hours vs days*24. */
  private Map<String, Object> dataQuality(Map<LocalDateTime, Double> cur, long days) {
    long expected = days * 24;
    int available = cur.size();
    long missing = Math.max(expected - available, 0);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("completenessPct",
        expected != 0 ? PyRound.round((double) available / expected * 100, 1) : 0.0);
    out.put("availableRecords", available);
    out.put("expectedRecords", expected);
    out.put("missingHours", missing);
    out.put("missingPct",
        expected != 0 ? PyRound.round((double) missing / expected * 100, 1) : 0.0);
    out.put("lastReceived", cur.isEmpty() ? "—"
        : cur.keySet().stream().max(LocalDateTime::compareTo).orElseThrow()
            .format(MON_DD_COMMA_HHMM));
    out.put("source", "Energy Meter");
    return out;
  }

  private static Map<LocalDate, double[]> dailyTotals(Map<LocalDateTime, Double> hourly) {
    Map<LocalDate, double[]> daily = new TreeMap<>();
    for (Map.Entry<LocalDateTime, Double> entry : hourly.entrySet()) {
      double[] totalAndCount = daily.computeIfAbsent(entry.getKey().toLocalDate(),
          ignored -> new double[2]);
      totalAndCount[0] += entry.getValue();
      totalAndCount[1] += 1;
    }
    return daily;
  }

  private record Sheet(String name, List<List<Object>> rows) {}

  private static byte[] xlsx(List<Sheet> sheets) {
    try {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
        put(zip, "[Content_Types].xml", contentTypes(sheets.size()));
        put(zip, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);
        put(zip, "xl/workbook.xml", workbook(sheets));
        put(zip, "xl/_rels/workbook.xml.rels", workbookRels(sheets.size()));
        for (int i = 0; i < sheets.size(); i++) {
          put(zip, "xl/worksheets/sheet" + (i + 1) + ".xml", worksheet(sheets.get(i)));
        }
      }
      return out.toByteArray();
    } catch (Exception e) {
      throw new ProjectAppService.BadRequestException("Could not export energy data");
    }
  }

  private static void put(ZipOutputStream zip, String name, String body) throws java.io.IOException {
    zip.putNextEntry(new ZipEntry(name));
    zip.write(body.getBytes(StandardCharsets.UTF_8));
    zip.closeEntry();
  }

  private static String contentTypes(int sheetCount) {
    StringBuilder xml = new StringBuilder("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        """);
    for (int i = 1; i <= sheetCount; i++) {
      xml.append("  <Override PartName=\"/xl/worksheets/sheet").append(i)
          .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>\n");
    }
    return xml.append("</Types>\n").toString();
  }

  private static String workbook(List<Sheet> sheets) {
    StringBuilder xml = new StringBuilder("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets>
        """);
    for (int i = 0; i < sheets.size(); i++) {
      xml.append("    <sheet name=\"").append(escapeAttr(sheets.get(i).name()))
          .append("\" sheetId=\"").append(i + 1).append("\" r:id=\"rId")
          .append(i + 1).append("\"/>\n");
    }
    return xml.append("  </sheets>\n</workbook>\n").toString();
  }

  private static String workbookRels(int sheetCount) {
    StringBuilder xml = new StringBuilder("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        """);
    for (int i = 1; i <= sheetCount; i++) {
      xml.append("  <Relationship Id=\"rId").append(i)
          .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
          .append(i).append(".xml\"/>\n");
    }
    return xml.append("</Relationships>\n").toString();
  }

  private static String worksheet(Sheet sheet) {
    StringBuilder xml = new StringBuilder("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
        """);
    for (int r = 0; r < sheet.rows().size(); r++) {
      xml.append("    <row r=\"").append(r + 1).append("\">");
      List<Object> row = sheet.rows().get(r);
      for (int c = 0; c < row.size(); c++) {
        Object value = row.get(c);
        if (value == null) {
          continue;
        }
        String ref = col(c) + (r + 1);
        if (value instanceof Number) {
          xml.append("<c r=\"").append(ref).append("\"><v>").append(value).append("</v></c>");
        } else {
          xml.append("<c r=\"").append(ref).append("\" t=\"inlineStr\"><is><t>")
              .append(escapeText(String.valueOf(value))).append("</t></is></c>");
        }
      }
      xml.append("</row>\n");
    }
    return xml.append("  </sheetData>\n</worksheet>\n").toString();
  }

  private static String col(int index) {
    StringBuilder out = new StringBuilder();
    int n = index;
    do {
      out.insert(0, (char) ('A' + (n % 26)));
      n = n / 26 - 1;
    } while (n >= 0);
    return out.toString();
  }

  private static String escapeText(String value) {
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }

  private static String escapeAttr(String value) {
    return escapeText(value).replace("\"", "&quot;");
  }

  private static String slug(String value) {
    String slug = value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
        .replaceAll("(^-+|-+$)", "");
    return slug.isBlank() ? "project" : slug;
  }

  /** _range_label: en-dash; year on the right (both sides when years differ). */
  static String rangeLabel(LocalDate start, LocalDate end) {
    if (start.getYear() == end.getYear()) {
      return start.format(MON_DD) + " – " + end.format(MON_DD) + ", " + end.getYear();
    }
    return start.format(MON_DD) + ", " + start.getYear() + " – "
        + end.format(MON_DD) + ", " + end.getYear();
  }

  /** Python isoformat() of localtime(now()) — seconds present, micros when != 0. */
  private static String pyIso(ZonedDateTime local) {
    String base = local.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
    int micros = local.getNano() / 1000;
    if (micros != 0) {
      base += String.format(".%06d", micros);
    }
    return base + local.getOffset();
  }

  private LocalDate parseDate(String value, LocalDate fallback) {
    if (value == null || value.isBlank()) {
      return fallback;
    }
    try {
      return LocalDate.parse(value);
    } catch (Exception e) {
      throw new ProjectAppService.BadRequestException("Invalid date format. Use YYYY-MM-DD");
    }
  }
}
