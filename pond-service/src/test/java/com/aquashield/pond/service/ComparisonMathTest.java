package com.aquashield.pond.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** PARITY ORACLES 11/12/14-partial (PondComparisonService math + grid). */
class ComparisonMathTest {

  private static final LocalDate D = LocalDate.of(2026, 6, 1);

  // Oracle #11 — grouping auto-resolution by inclusive span
  @Test
  void groupingResolution() {
    assertThat(ComparisonService.resolveGrouping("auto", D, D)).isEqualTo("hourly");      // span 1
    assertThat(ComparisonService.resolveGrouping("auto", D, D.plusDays(30))).isEqualTo("daily");   // 31
    assertThat(ComparisonService.resolveGrouping("auto", D, D.plusDays(31))).isEqualTo("weekly");  // 32
    assertThat(ComparisonService.resolveGrouping("auto", D, D.plusDays(89))).isEqualTo("weekly");  // 90
    assertThat(ComparisonService.resolveGrouping("auto", D, D.plusDays(90))).isEqualTo("monthly"); // 91
    assertThat(ComparisonService.resolveGrouping("hourly", D, D.plusDays(365))).isEqualTo("hourly"); // explicit wins
  }

  // Oracle #12 — pct diff zero-denominator + safe average semantics
  @Test
  void pctDiff_andSafeAvg() {
    assertThat(ComparisonService.pctDiff(5, 0)).isZero();          // denom 0 -> 0
    assertThat(ComparisonService.pctDiff(10, 5)).isEqualTo(100);
    assertThat(ComparisonService.safeAvg(List.of())).isEqualTo(0.0);
    assertThat(ComparisonService.safeAvg(Arrays.asList(null, 2.0, 4.0))).isEqualTo(3.0);
    assertThat(ComparisonService.bucketAvg(Arrays.asList(null, null))).isNull();
    assertThat(ComparisonService.bucketAvg(Arrays.asList(null, 2.0, 4.0))).isEqualTo(3.0);
  }

  // Oracle #14 partial — bucket grid: every bucket present, label formats, anchors
  @Test
  void bucketGrid() {
    assertThat(List.copyOf(ComparisonService.bucketGrid(D, D, "hourly").values()))
        .hasSize(24).startsWith("Jun 01 00:00").endsWith("Jun 01 23:00");
    // PARITY FIX vs the stub era: multi-day hourly enumerates EVERY hour of the span
    // (monolith cursor runs to end_date 23:59:59.999999)
    assertThat(ComparisonService.bucketGrid(D, D.plusDays(1), "hourly")).hasSize(48);
    assertThat(List.copyOf(ComparisonService.bucketGrid(D, D.plusDays(2), "daily").values()))
        .containsExactly("Jun 01", "Jun 02", "Jun 03");
    // weekly anchored Monday: Jun 1 2026 IS a Monday
    assertThat(List.copyOf(
        ComparisonService.bucketGrid(D.plusDays(2), D.plusDays(15), "weekly").values()))
        .containsExactly("Jun 01", "Jun 08", "Jun 15");
    assertThat(List.copyOf(ComparisonService.bucketGrid(LocalDate.of(2026, 5, 20),
        LocalDate.of(2026, 7, 2), "monthly").values()))
        .containsExactly("May 2026", "Jun 2026", "Jul 2026");
  }

  // CPython round parity now backs the math helpers
  @Test
  void bankersRounding() {
    assertThat(ComparisonService.pctDiff(5.5, 4.0)).isEqualTo(38);   // 37.5 -> even
    assertThat(ComparisonService.safeAvg(List.of(0.10, 0.20))).isEqualTo(0.15);
  }

  // second-round dynamic parameter contract
  @Test
  void parameterCatalogue_canonicalAndDefaultOrder() {
    assertThat(ComparisonService.DEFAULT_PARAMETERS)
        .containsExactly("ammonia", "dissolved_oxygen", "turbidity", "ph");
    assertThat(ComparisonService.CANONICAL_ORDER)
        .startsWith("ammonia", "dissolved_oxygen", "turbidity", "ph", "alkalinity")
        .doesNotContain("electricity");
    assertThat(ComparisonService.unknownParameters(List.of("ph", "unobtainium", "ammonia")))
        .containsExactly("unobtainium");
  }
}
