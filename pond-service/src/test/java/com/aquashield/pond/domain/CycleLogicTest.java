package com.aquashield.pond.domain;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** PARITY ORACLES 1-3 + display-name strings (module_pond.Cycle). */
class CycleLogicTest {

  private static Cycle cycle(LocalDate start, LocalDate end, String status) {
    Cycle c = new Cycle(UUID.randomUUID(), start, status, null);
    ReflectionTestUtils.setField(c, "endDate", end);
    return c;
  }

  private static final LocalDate TODAY = LocalDate.of(2026, 6, 10);

  // Oracle #1 — ongoing: today-based, 1-BASED
  @Test
  void currentDay_ongoing() {
    assertThat(cycle(TODAY.minusDays(9), null, "ongoing").currentDay(TODAY)).isEqualTo(10);
    assertThat(cycle(TODAY, null, "ongoing").currentDay(TODAY)).isEqualTo(1);
  }

  // Oracle #2 — completed: end-date based
  @Test
  void currentDay_completed() {
    assertThat(cycle(LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 10), "completed")
        .currentDay(TODAY)).isEqualTo(10);
  }

  // Oracle #3 — no start -> 0; terminated without end_date -> 0
  @Test
  void currentDay_zeroCases() {
    assertThat(cycle(null, null, "ongoing").currentDay(TODAY)).isZero();
    assertThat(cycle(TODAY.minusDays(5), null, "terminated").currentDay(TODAY)).isZero();
  }

  // duration_days falls back to today when no end_date regardless of status
  @Test
  void durationDays_fallsBackToToday() {
    assertThat(cycle(TODAY.minusDays(4), null, "terminated").durationDays(TODAY)).isEqualTo(5);
  }

  // PARITY display-name strings
  @Test
  void displayName_strings() {
    assertThat(cycle(LocalDate.of(2026, 1, 15), LocalDate.of(2026, 4, 20), "completed")
        .displayName()).isEqualTo("Cycle Jan 2026 - Apr 2026");
    assertThat(cycle(LocalDate.of(2026, 1, 15), null, "ongoing").displayName())
        .isEqualTo("Cycle Jan 2026 - Ongoing");
    assertThat(cycle(null, null, "ongoing").displayName()).isEqualTo("Unknown Cycle");
  }
}
