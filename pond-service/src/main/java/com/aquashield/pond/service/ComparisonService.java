package com.aquashield.pond.service;

import com.aquashield.pond.domain.Entities.PondTreatment;
import com.aquashield.pond.domain.Pond;
import com.aquashield.pond.repo.Repos.PondRepository;
import com.aquashield.pond.repo.Repos.PondTreatmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * PARITY port of PondComparisonService. The FROZEN contract: exactly 4 parameters in
 * fixed order; camelCase payloads; grouping auto-resolution by inclusive span
 * (<=1 hourly, <=31 daily, <=90 weekly, else monthly); shared X-axis grid with EVERY
 * bucket present (zero-filled); pct diff = 0 when denominator is 0.
 *
 * [XSVC] All metric values and chart series derive from sensor readings, which now live
 * in Ingestion's store. Until the Ingestion read path (GetReadings) exists, those values
 * are SERVED ZERO-FILLED — structurally identical to a pond with no readings, which the
 * monolith also zero-filled. Pure pond data (identity, treatments, dateRange, grid) is
 * fully real. Tracked as a cross-service dependency.
 */
@Service
public class ComparisonService {

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

  public ComparisonService(PondRepository ponds, PondTreatmentRepository treatments) {
    this.ponds = ponds;
    this.treatments = treatments;
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

  /** PARITY (_pct_diff): round((a-b)/b*100); 0 when b == 0. */
  static long pctDiff(double a, double b) {
    if (b == 0) {
      return 0;
    }
    return Math.round((a - b) / b * 100);
  }

  /** PARITY (_safe_avg): 0.0 for empty/all-null; rounded 2dp. */
  static double safeAvg(List<Double> values) {
    List<Double> usable = values.stream().filter(v -> v != null).toList();
    if (usable.isEmpty()) {
      return 0.0;
    }
    double avg = usable.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    return Math.round(avg * 100.0) / 100.0;
  }

  /**
   * PARITY (_bucket_by_period): the shared X-axis grid — every bucket present.
   * Labels: hourly "MMM dd HH:00"; daily/weekly "MMM dd" (weekly anchored Monday);
   * monthly "MMM yyyy" (anchored day 1).
   */
  static List<String> bucketLabels(LocalDate start, LocalDate end, String grouping) {
    List<String> labels = new ArrayList<>();
    DateTimeFormatter dayFmt = DateTimeFormatter.ofPattern("MMM dd", Locale.ENGLISH);
    switch (grouping) {
      case "hourly" -> {
        for (int h = 0; h < 24; h++) {
          labels.add(start.format(dayFmt) + String.format(" %02d:00", h));
        }
      }
      case "daily" -> {
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
          labels.add(d.format(dayFmt));
        }
      }
      case "weekly" -> {
        LocalDate anchor = start.minusDays(start.getDayOfWeek().getValue() - 1L); // Monday
        for (LocalDate d = anchor; !d.isAfter(end); d = d.plusWeeks(1)) {
          labels.add(d.format(dayFmt));
        }
      }
      case "monthly" -> {
        LocalDate anchor = start.withDayOfMonth(1);
        for (LocalDate d = anchor; !d.isAfter(end); d = d.plusMonths(1)) {
          labels.add(d.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
              + " " + d.getYear());
        }
      }
      default -> throw new IllegalArgumentException("unresolved grouping: " + grouping);
    }
    return labels;
  }

  // ---------- payloads (camelCase, exact FE contract) ----------

  @Transactional(readOnly = true)
  public Map<String, Object> listPondOptions(UUID projectId) {
    List<Map<String, Object>> options = new ArrayList<>();
    for (Pond pond : ponds.findByProjectIdOrderByNameAsc(projectId)) {
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("pondId", pond.getPondId().toString());
      entry.put("name", pond.getName());
      entry.put("companyName", metaText(pond, "company_name"));
      entry.put("gpsLocation", metaText(pond, "gps_location"));
      entry.put("treatments", activeTreatments(pond.getPondId()));
      // [XSVC] reading-derived flags — zero/null until Ingestion GetReadings exists
      entry.put("hasSensorData", false);
      entry.put("firstReadingAt", null);
      entry.put("lastReadingAt", null);
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
    List<String> grid = bucketLabels(start, end, resolved);

    List<Map<String, Object>> metrics = new ArrayList<>();
    List<Map<String, Object>> charts = new ArrayList<>();
    for (ParameterDef p : PARAMETERS) {
      // [XSVC] values zero-filled until the Ingestion read path lands (structurally
      // identical to the monolith's no-readings case)
      Map<String, Object> metric = new LinkedHashMap<>();
      metric.put("parameter", p.code());
      metric.put("label", p.label());
      metric.put("unit", p.unit());
      metric.put("pondAValue", 0.0);
      metric.put("pondBValue", 0.0);
      metric.put("difference", 0.0);
      metric.put("percentDifference", 0L);
      metric.put("lowerIsBetter", p.lowerIsBetter());
      metrics.add(metric);

      List<Map<String, Object>> data = new ArrayList<>();
      for (String label : grid) {
        data.add(Map.of("label", label, "seriesA", 0.0, "seriesB", 0.0));
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

  private static String metaText(Pond pond, String key) {
    return pond.getMetadata() == null ? "" : pond.getMetadata().path(key).asText("");
  }
}
