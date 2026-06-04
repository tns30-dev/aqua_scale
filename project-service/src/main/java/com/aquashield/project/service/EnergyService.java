package com.aquashield.project.service;

import com.aquashield.api.ingestion.v1.GetReadingsRequest;
import com.aquashield.api.ingestion.v1.IngestionReadServiceGrpc;
import com.aquashield.api.ingestion.v1.ReadingRow;
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

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Energy settings + dashboard (PARITY: module_project/services/energy_dashboard.py,
 * line-for-line port — formerly the [XSVC] zero-data stub).
 *
 * Readings come through Ingestion GetReadings (project-wide selector, electricity only —
 * the monolith filtered sensor_readings by project_id + electricity__isnull=False).
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
  private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

  private final ProjectEnergySettingRepository energySettings;
  private final IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion;
  private final ZoneId zone;

  public EnergyService(ProjectEnergySettingRepository energySettings,
                       IngestionReadServiceGrpc.IngestionReadServiceBlockingStub ingestion,
                       @Value("${aquashield.timezone:Asia/Singapore}") String timezone) {
    this.energySettings = energySettings;
    this.ingestion = ingestion;
    this.zone = ZoneId.of(timezone);
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

  // ---------- dashboard (energy_dashboard.py port) ----------

  @Transactional(readOnly = true)
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

    Map<LocalDateTime, Double> cur = hourly(projectId, start, end);
    Map<LocalDateTime, Double> prev = hourly(projectId, prevStart, prevEnd);
    double curTotal = PyRound.round(cur.values().stream().mapToDouble(Double::doubleValue).sum(), 3);
    double prevTotal = PyRound.round(prev.values().stream().mapToDouble(Double::doubleValue).sum(), 3);

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("lastUpdated", pyIso(ZonedDateTime.now(zone)));
    body.put("dateRangeLabel", rangeLabel(start, end));
    body.put("kpis", kpis(cur, curTotal, prevTotal, days, tariff, symbol));
    body.put("trend", trend(cur, prev, groupBy));
    body.put("trendCurrentLabel", "Current period");
    body.put("trendPreviousLabel", "Previous period");
    body.put("heatmap", heatmap(cur, start, end));
    body.put("summary", summary(cur, prev, curTotal, prevTotal, days, tariff, symbol));
    body.put("byPeriod", byPeriod(cur, groupBy));
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
      var resp = ingestion.getReadings(GetReadingsRequest.newBuilder()
          .setProjectId(projectId.toString())
          .setStart(from.toString())
          .setEnd(to.toString())
          .addParameters("electricity")
          .build());
      for (ReadingRow row : resp.getRowsList()) {
        Double kwh = row.getValuesMap().get("electricity");
        if (kwh == null) {
          continue; // electricity__isnull=False parity
        }
        LocalDateTime hour = ZonedDateTime
            .ofInstant(Instant.parse(row.getMeasuredAt()), zone)
            .toLocalDateTime().withMinute(0).withSecond(0).withNano(0);
        buckets.merge(hour, kwh, Double::sum);
      }
    } catch (Exception e) {
      log.warn("Energy readings fetch failed project={} — serving empty: {}",
          projectId, e.toString());
    }
    return buckets;
  }

  private Map<String, Object> kpis(Map<LocalDateTime, Double> cur, double curTotal,
                                   double prevTotal, long days, double tariff, String symbol) {
    long hours = days * 24;
    Peak peak = peak(cur);
    double pct = prevTotal != 0
        ? PyRound.round((curTotal - prevTotal) / prevTotal * 100, 1) : 0.0;
    Map<String, Object> kpis = new LinkedHashMap<>();
    kpis.put("totalKwh", curTotal);
    kpis.put("estimatedCost", PyRound.round(curTotal * tariff, 2));
    kpis.put("tariffPerKwh", PyRound.round(tariff, 4));
    kpis.put("currencySymbol", symbol);
    kpis.put("avgKwhPerDay", days != 0 ? PyRound.round(curTotal / days, 2) : 0.0);
    kpis.put("avgKwhPerHour", hours != 0 ? PyRound.round(curTotal / hours, 2) : 0.0);
    kpis.put("peakHourKwh", peak.value());
    kpis.put("peakHourLabel", peak.label());
    kpis.put("changeVsPreviousPct", pct);
    kpis.put("costChange", PyRound.round((curTotal - prevTotal) * tariff, 2));
    kpis.put("compareLabel", "vs previous " + days + " day" + (days != 1 ? "s" : ""));
    return kpis;
  }

  private record Peak(String label, double value) {}

  /** _peak: first max in insertion order (monolith dict order); empty -> ('—', 0.0). */
  private static Peak peak(Map<LocalDateTime, Double> hourly) {
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
    return new Peak(bestHour.format(HHMM), PyRound.round(best, 2));
  }

  private record Bucket(String key, String label) {}

  /** _bucket: (sort_key, label) for a local hour datetime under group_by. */
  private static Bucket bucket(LocalDateTime dt, String groupBy) {
    return switch (groupBy) {
      case "hour" -> new Bucket(
          dt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH")), dt.format(MON_DD_HHMM));
      case "week" -> {
        int week = dt.get(WeekFields.ISO.weekOfWeekBasedYear());
        int year = dt.get(WeekFields.ISO.weekBasedYear());
        yield new Bucket(String.format("%d-W%02d", year, week), "W" + week);
      }
      case "month" -> new Bucket(dt.format(DateTimeFormatter.ofPattern("yyyy-MM")),
          dt.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH)
              + " " + dt.getYear());
      default -> new Bucket(dt.format(DateTimeFormatter.ISO_LOCAL_DATE), dt.format(MON_DD));
    };
  }

  private record SeriesEntry(String key, String label, double total) {}

  /** _series: chronological hours -> first-seen bucket order, totals rounded 3dp. */
  private static List<SeriesEntry> series(Map<LocalDateTime, Double> hourly, String groupBy) {
    Map<String, double[]> agg = new LinkedHashMap<>();
    Map<String, String> labels = new LinkedHashMap<>();
    for (Map.Entry<LocalDateTime, Double> e : new TreeMap<>(hourly).entrySet()) {
      Bucket b = bucket(e.getKey(), groupBy);
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

  /** _trend: current buckets zipped with previous BY INDEX; labels from current. */
  private List<Map<String, Object>> trend(Map<LocalDateTime, Double> cur,
                                          Map<LocalDateTime, Double> prev, String groupBy) {
    List<SeriesEntry> curS = series(cur, groupBy);
    List<SeriesEntry> prevS = series(prev, groupBy);
    List<Map<String, Object>> out = new ArrayList<>();
    for (int i = 0; i < curS.size(); i++) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("label", curS.get(i).label());
      row.put("current", curS.get(i).total());
      row.put("previous", i < prevS.size() ? prevS.get(i).total() : 0.0);
      out.add(row);
    }
    return out;
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
    double curPeak = peak(cur).value();
    double prevPeak = peak(prev).value();
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

  private Map<String, Object> byPeriod(Map<LocalDateTime, Double> cur, String groupBy) {
    Map<String, String> titles = Map.of(
        "hour", "Consumption by Hour", "day", "Consumption by Day",
        "week", "Consumption by Week", "month", "Consumption by Month");
    List<Map<String, Object>> rows = new ArrayList<>();
    for (SeriesEntry entry : series(cur, groupBy)) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("label", entry.label());
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
