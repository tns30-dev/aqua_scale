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
  }

  // Oracle #14 partial — bucket grid: every bucket present, label formats, anchors
  @Test
  void bucketGrid() {
    assertThat(ComparisonService.bucketLabels(D, D, "hourly"))
        .hasSize(24).startsWith("Jun 01 00:00").endsWith("Jun 01 23:00");
    assertThat(ComparisonService.bucketLabels(D, D.plusDays(2), "daily"))
        .containsExactly("Jun 01", "Jun 02", "Jun 03");
    // weekly anchored Monday: Jun 1 2026 IS a Monday
    assertThat(ComparisonService.bucketLabels(D.plusDays(2), D.plusDays(15), "weekly"))
        .containsExactly("Jun 01", "Jun 08", "Jun 15");
    assertThat(ComparisonService.bucketLabels(LocalDate.of(2026, 5, 20),
        LocalDate.of(2026, 7, 2), "monthly"))
        .containsExactly("May 2026", "Jun 2026", "Jul 2026");
  }

  // frozen parameter contract
  @Test
  void parameterCatalogue_frozenOrder() {
    assertThat(ComparisonService.PARAMETERS).extracting(ComparisonService.ParameterDef::code)
        .containsExactly("ammonium", "dissolved_oxygen", "turbidity", "electricity");
  }
}
